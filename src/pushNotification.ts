import {
  runWarm,
  successResponse,
  corsErrorResponse,
  Auth0Token,
  StopQueryVariables,
} from './utils';
import execute from './utils/execute';
import firebase from './utils/firebase';

const pickUpNotificationAction = `query Stops{
    stops(where: {eta: {_gt: "now"}}) {
      id
      eta
      route_stop_users_by_pickup_stop_id{
        user_id
        user{
          fcm_token 
        }
      }
    }
  }`;

type EventWithAuth = {
  authToken: string;
  authTokenDecoded: Auth0Token;
} & AWSLambda.APIGatewayEvent;

const pickUpNotification = async (event: EventWithAuth) => {
  if (!process.env.HASURA_ADMIN_SECRET) {
    throw new Error('Missing HASURA_ADMIN_SECRET environment variable');
  }

  if (!event.body) {
    return corsErrorResponse({
      status: '400',
      message: 'Missing event body',
    });
  }

  try {
    const challengeResult = await execute<{}, StopQueryVariables>(
      pickUpNotificationAction,
      {},
      {
        headers: {
          'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET,
        },
      }
    );

    const hoursBefore = new Date();
    hoursBefore.setHours(new Date().getHours() + 1);
    const fcmToken: string[] = [];
    if (challengeResult.data) {
      challengeResult.data.stops.forEach((stop: any) => {
        const date1 = new Date(stop.eta);
        if (
          hoursBefore.toUTCString().slice(0, 22) ===
          date1.toUTCString().slice(0, 22)
        ) {
          stop.route_stop_users_by_pickup_stop_id.forEach((item: any) => {
            if (item.user.fcm_token != null) {
              fcmToken.push(item.user.fcm_token);
            }
          });
        }
      });
    }

    if (fcmToken.length > 0) {
      const message = {
        notification: {
          title: 'DRIVE-IT',
          body: 'your ride is ready in a hour.',
        },
      };
      console.log(fcmToken);
      try {
        firebase
          .messaging()
          .sendToDevice(fcmToken, message, { priority: 'high' });
      } catch (err) {
        console.log(err);
      }
    }
    return successResponse({
      messaege: 'Notification sent sucessfully!',
      fcmToken: fcmToken,
    });
  } catch (error) {
    console.log(error);
  }
};
export default runWarm(pickUpNotification);
