import {
  runWarm,
  Auth0Token,
  corsErrorResponse,
  GetPathsQueryOutput,
  GetRouteQueryOutput,
  GetRouteVariables,
  isDropOffMutationVariables,
  isDropOffMutationOutput,
  isPickupMutationVariables,
  isPickupMutationOutput,
  updateRouteVariables,
  updateRouteOutput,
  errorResponse,
  successResponse,
  GetPathsVariables,
} from './utils';
import { Response } from './utils/lambda-response';
import execute from './utils/execute';
import distanceInMeter from 'haversine-distance';
import inPolygon from 'point-in-polygon-hao';
import firebase from './utils/firebase';
import mailer from './utils/mail';

// Maximum distance cover in polygon
const maxDistance = 450;

// Max unmatched user limit
const maxUnmatchedUser = 30;

// Get routes and its all related area and user data into below graphQL
const getRoutesAction = `query routes($times: timestamptz){
  routes(where: {is_configured_route: {_eq: false},departure_time: {_lte: $times}}) {
    id
    origin_area {
      geography
    }
    destination_area {
      geography
    }
    route_stop_users {
      user_id
      desired_pickup
      desired_dropoff
      user {
        fcm_token
      }
    }
  }
}`;

/**
 * ***************************************************************
 * Set General configuration and AUthentication for getPath file
 * Set this configuration for Hasure and AWS lambda
 * ***************************************************************
 */
type EventWithAuth = {
  authToken: string;
  authTokenDecoded: Auth0Token;
} & AWSLambda.APIGatewayEvent;

const getPaths = async (event: EventWithAuth): Promise<Response> => {
  if (!process.env.HASURA_ADMIN_SECRET) {
    throw new Error('Missing HASURA_ADMIN_SECRET environment variable');
  }

  if (!event.body) {
    return corsErrorResponse({
      status: '400',
      message: 'Missing event body',
    });
  }

  const curruntTime = new Date();
  curruntTime.setHours(new Date().getHours() + 1);

  const { data, errors } = await execute<
    GetRouteVariables,
    GetRouteQueryOutput
  >(
    getRoutesAction,
    {
      times: curruntTime,
    },
    {
      headers: {
        'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET,
      },
    }
  );

  // if Hasura operation errors, then throw error
  if (errors) {
    return errorResponse({
      status: '400',
      message: errors[0].message,
    });
  }

  data.routes.forEach(async (_route: any) => {
    const pickupPath = await selectPath('pickup', _route);
    const dropoffPath = await selectPath('dropoff', _route);

    if (dropoffPath.length > 0) {
      dropoffPath.forEach((_path: { stopId: string }) => {
        pickupPath.push({ stopId: _path.stopId, index: pickupPath.length });
      });
    }
    if (pickupPath.length > 0) {
      updateRoute(_route.id, JSON.stringify(pickupPath));
    }
  });

  return successResponse(data);
};
export default runWarm(getPaths);

/**
 * ****************************************************************************************************
 * This is use to set the Highest path of pickup and dropoff
 *
 * @param   {string}          is_dropoff  if is_dropoff false then PICKUP else DROPOFF
 * @param   {any<any>}        route [route origin_area, destination_area geography and its route users]
 *
 * ****************************************************************************************************
 */
async function selectPath(type: string, route: any): Promise<any> {
  const is_dropoff = type == 'pickup' ? false : true;
  const pathData = await getRoutePaths(is_dropoff, route.id);
  const routeUsers = route.route_stop_users;

  if (pathData.paths.length > 0 && pathData.stops.length > 0) {
    const paths = pathData.paths[0];
    const pathStops = JSON.parse(paths.stops);
    const stops = pathData.stops;

    const matchedUserCount: number[] = [];
    const users: any = [];

    // Get desired pickup and desired dropoff cooordinate
    const polygonCordinates = is_dropoff
      ? route.destination_area.geography.coordinates
      : route.origin_area.geography.coordinates;

    // Users objects should include the 3 nearest stops to him, ordered by distance.
    routeUsers.forEach((_user: any) => {
      const desiredLocation = is_dropoff
        ? _user.desired_dropoff.coordinates
        : _user.desired_pickup.coordinates;

      if (inPolygon(desiredLocation, polygonCordinates)) {
        // Desired Location latitude longitude
        const desiredLocationLatLong = {
          latitude: desiredLocation[0],
          longitude: desiredLocation[1],
        };

        // userStopsDistance define types
        const userStopsDistance: {
          stopId: any;
          cordindates: any;
          distance: number;
        }[] = [];

        // Compare the stop with user location and Get nearest location stops
        stops.forEach((_stop: { id: string; location: any }) => {
          const stopLocationCordindates = _stop.location.coordinates;
          const stopLatLong = {
            latitude: stopLocationCordindates[0],
            longitude: stopLocationCordindates[1],
          };
          const distance = distanceInMeter(desiredLocationLatLong, stopLatLong);
          if (distance <= maxDistance) {
            const obj = {
              stopId: _stop.id,
              cordindates: stopLocationCordindates,
              distance: distance,
            };
            userStopsDistance.push(obj);
          }
        });

        // 1. Set sort index on stops and get 3 nearest stop
        // 2. Get the user object ( route_id, nearest stop etc.. ) collection into users variable
        userStopsDistance.sort((a, b) => (a.distance > b.distance ? 1 : -1));
        const nearStops = userStopsDistance.slice(0, 3);

        if (nearStops.length > 0) {
          _user['nearestStop'] = nearStops;
          _user['route_id'] = paths.routes_id;
          users.push(_user);

          // 1. Get path tables stop object
          // 2. Check that desired stop locations available or not in stop table
          // 3. Get matched and unmatched users
          pathStops.forEach((_pathStop: any, index: number) => {
            matchedUserCount[index] = matchedUserCount[index]
              ? matchedUserCount[index]
              : 0;
            _pathStop.forEach((_stop: { stopId: any }) => {
              const userExists = nearStops.some(
                (nStop) => nStop.stopId === _stop.stopId
              );
              if (userExists) {
                matchedUserCount[index] += 1;
              }
            });
          });
        }
      }
    });

    // Get highest path index
    const highestPathIndex = matchedUserCount.reduce(
      (iMax, x, i, arr) => (x > arr[iMax] ? i : iMax),
      0
    );

    const totalusers = users.length;
    const unmatchedUsers = totalusers - matchedUserCount[highestPathIndex];
    const unmatchedUsersPercentage = (unmatchedUsers * 100) / totalusers;

    if (unmatchedUsersPercentage >= maxUnmatchedUser) {
      // send mail to admin
      const mailObj = {
        routeId: route.id,
        type: type,
        unmatchedUsersCount: unmatchedUsersPercentage,
      };
      sendMailNotification(mailObj);
    }

    // Get highest path array
    const highestPath = pathStops[highestPathIndex];

    // Update pickup_stop_id and dropoff_stop_id into route_stop_user table
    // So passanger user location will be fix after running whole process
    const finalStops: any[] = [];
    users.forEach((_user: any) => {
      const finalStop = userFinalStops(_user, highestPath);
      const fcmToken = _user.user.fcm_token;
      if (is_dropoff) {
        updateRouteDropoffStopUserMutation(finalStop);
      } else {
        updateRoutePickupStopUserMutation(finalStop);
      }
      finalStops.push(finalStop);
      if (fcmToken !== null && fcmToken !== '') {
        const message = {
          notification: {
            title: 'DRIVE-IT',
            body: 'Final stop notification.',
          },
        };
        try {
          firebase
            .messaging()
            .sendToDevice(fcmToken, message, { priority: 'high' });
        } catch (err) {
          console.log(err);
        }
      }
    });

    return createPaths(finalStops, highestPath, stops);
  }
  return [];
}

function createPaths(finalStops: any, highestPath: any, stops: any) {
  const finalPath: { stopId: string; index: number }[] = [];
  const startPoint = getStopsById(stops, highestPath[0].stopId);
  const startPointCordinates = {
    latitude: startPoint.location.coordinates[0],
    longitude: startPoint.location.coordinates[1],
  };

  finalStops.forEach((_stop: any) => {
    const stopExist = highestPath.some(
      (paths: { stopId: string }) => paths.stopId === _stop.stopId
    );
    if (!_stop.inHPath && !stopExist) {
      highestPath.push({ stopId: _stop.stopId, index: highestPath.length });
    }
  });

  const newPaths: any[] = [];
  highestPath.forEach((_stop: any) => {
    const endPoint = getStopsById(stops, _stop.stopId);
    const endPointCordinates = {
      latitude: endPoint.location.coordinates[0],
      longitude: endPoint.location.coordinates[1],
    };
    newPaths.push({
      stopId: _stop.stopId,
      distance: distanceInMeter(startPointCordinates, endPointCordinates),
    });
  });

  newPaths.sort((a: { distance: string }, b: { distance: string }) =>
    a.distance > b.distance ? 1 : -1
  );

  newPaths.forEach((_stop: { stopId: string }, index: number) => {
    finalPath.push({ stopId: _stop.stopId, index: index });
  });
  return finalPath;
}

function getStopsById(stops: any, stopId: string) {
  return stops.find((o: { id: string }) => o.id === stopId);
}

function userFinalStops(user: any, highestPath: any) {
  for (const stop of user.nearestStop) {
    const exists = highestPath.some(
      (paths: any) => paths.stopId === stop.stopId
    );
    if (exists) {
      const nearStop = {
        distance: stop.distance,
        stopId: stop.stopId,
        stopCordindates: stop.cordindates,
        routeId: user.route_id,
        userId: user.user_id,
        inHPath: true,
      };
      return nearStop;
    }
  }
  const nearStop = {
    distance: user.nearestStop[0].distance,
    stopId: user.nearestStop[0].stopId,
    stopCordindates: user.nearestStop[0].cordindates,
    routeId: user.route_id,
    userId: user.user_id,
    inHPath: false,
  };
  return nearStop;
}

/**
 * ***********************************************************
 * get paths and all stops
 *
 * @param   {boolean}       isDropoff  [isDropoff true/false]
 * @param   {any<any>}      routeId    [routeId uuid]
 *
 * ***********************************************************
 */
async function getRoutePaths(isDropoff: boolean, routeId: any): Promise<any> {
  if (!process.env.HASURA_ADMIN_SECRET) {
    throw new Error('Missing HASURA_ADMIN_SECRET environment variable');
  }
  const getPathsAction = `query pathStops($is_dropoff: Boolean!, $routeId: uuid!) {
    paths(where: {is_dropoff: {_eq: $is_dropoff}, routes_id: {_eq: $routeId}}) {
      id
      routes_id
      stops
    }
    stops(where: {is_dropoff: {_eq: $is_dropoff}, route_id: {_eq: $routeId}}) {
      id
      location
    }
  }`;
  const { data, errors } = await execute<
    GetPathsVariables,
    GetPathsQueryOutput
  >(
    getPathsAction,
    {
      is_dropoff: isDropoff,
      routeId: routeId,
    },
    {
      headers: {
        'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET,
      },
    }
  );

  // if Hasura operation errors, then throw error
  if (errors) {
    return errorResponse({
      status: '400',
      message: errors[0].message,
    });
  }
  return data;
}

/**
 * ******************************************************
 * Update dropoff_stop_id by using the graphQL execution
 *
 * @param   {string}     userId  [userId]
 * @param   {string}     routeId  [routeId]
 * @param   {string}     stopId  [stopId]
 *
 * ******************************************************
 */
async function updateRouteDropoffStopUserMutation(userData: any): Promise<any> {
  if (!process.env.HASURA_ADMIN_SECRET) {
    throw new Error('Missing HASURA_ADMIN_SECRET environment variable');
  }

  // Update dropoff_stop_id of passanger into route_stop_user table
  const updateRouteDropoffStopsAction = `mutation updateRouteDropoffStopsMutation($route_id: uuid!, $user_id: String!, $dropoff_stop_id : uuid!){
    update_route_stop_user(where: {route_id: {_eq :$route_id} ,user_id: {_eq: $user_id}}, _set : {dropoff_stop_id: $dropoff_stop_id}){
      affected_rows
    }
  }`;

  const { data, errors } = await execute<
    isDropOffMutationVariables,
    isDropOffMutationOutput
  >(
    updateRouteDropoffStopsAction,
    {
      route_id: userData.routeId,
      user_id: userData.userId,
      dropoff_stop_id: userData.stopId,
    },
    {
      headers: {
        'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET,
      },
    }
  );

  // if Hasura operation errors, then throw error
  if (errors) {
    return errorResponse({
      status: '400',
      message: errors[0].message,
    });
  }
  return data;
}

/**
 * *****************************************************
 * Update pickup_stop_id by using the graphQL execution
 *
 * @param   {string}     userId  [userId]
 * @param   {string}     routeId  [routeId]
 * @param   {string}     stopId  [stopId]
 *
 * *****************************************************
 */
async function updateRoutePickupStopUserMutation(userData: {
  userId: string;
  routeId: string;
  stopId: string;
}): Promise<any> {
  if (!process.env.HASURA_ADMIN_SECRET) {
    throw new Error('Missing HASURA_ADMIN_SECRET environment variable');
  }

  // Update pickup_stop_id of passanger into route_stop_user table
  const updateRoutePickupStopsAction = `mutation updateRoutePickupStopsMutation($route_id: uuid!, $user_id: String!, $pickup_stop_id : uuid!){
    update_route_stop_user(where: {route_id: {_eq :$route_id} ,user_id: {_eq: $user_id}}, _set : {pickup_stop_id: $pickup_stop_id}){
      affected_rows
    }
  }`;

  const { data, errors } = await execute<
    isPickupMutationVariables,
    isPickupMutationOutput
  >(
    updateRoutePickupStopsAction,
    {
      route_id: userData.routeId,
      user_id: userData.userId,
      pickup_stop_id: userData.stopId,
    },
    {
      headers: {
        'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET,
      },
    }
  );

  // if Hasura operation errors, then throw error
  if (errors) {
    return errorResponse({
      status: '400',
      message: errors[0].message,
    });
  }
  return data;
}

/**
 * ***********************************************************************
 * Update isConfigPath as true when whole process doen for specific route
 *
 * @param   {string<any>}   id  [id description]
 *
 * ***********************************************************************
 */
async function updateRoute(id: string, highest_path: string): Promise<any> {
  if (!process.env.HASURA_ADMIN_SECRET) {
    throw new Error('Missing HASURA_ADMIN_SECRET environment variable');
  }

  // Update and set route configuration as true
  const routeConfigAction = `mutation updateRouteMutation($id: uuid!, $final_highest_path: String!) {
    update_routes_by_pk(pk_columns: {id: $id}, _set: {is_configured_route: true, final_highest_path: $final_highest_path}) {
      id
    }
  }`;

  const { data, errors } = await execute<
    updateRouteVariables,
    updateRouteOutput
  >(
    routeConfigAction,
    {
      id: id,
      final_highest_path: highest_path,
    },
    {
      headers: {
        'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET,
      },
    }
  );

  // if Hasura operation errors, then throw error
  if (errors) {
    return errorResponse({
      status: '400',
      message: errors[0].message,
    });
  }
  return data;
}

/**
 * *************************************************
 * sendMail admin
 *
 * @param   {[type]}  mailObj  [mailObj description]
 *
 * @return  {[type]}           [return description]
 * *************************************************
 */
async function sendMailNotification(mailObj: {
  routeId: any;
  type: string;
  unmatchedUsersCount: number;
}) {
  const msg = `${mailObj.unmatchedUsersCount}% unmatched for RouteId: ${mailObj.routeId} - ${mailObj.type}`;
  const info = await mailer.sendMail({
    from: 'info@lrdevteam.com',
    to: 'info@lrdevteam.com',
    subject: 'Unmatched user notification',
    text: msg,
  });
  return info.messageId;
}
