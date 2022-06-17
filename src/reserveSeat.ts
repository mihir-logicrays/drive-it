import * as Joi from 'joi';
import {
  successResponse,
  runWarm,
  errorResponse,
  ReserveSeatActionVariables,
  Auth0Token,
  MutationReserveSeatActionArgs,
  ReserveSeatMutationOutput,
} from './utils';
import { Response } from './utils/lambda-response';
import execute from './utils/execute';
import validateToken from './utils/validateToken';

const ReserveSeatAction = `mutation ReserveSeatMutation($user_id: String = "", $route_id: uuid = "", $desired_dropoff: geography = "", $desired_dropoff_address: String = "", $desired_pickup: geography = "", $desired_pickup_address: String = "") {
  insert_route_stop_user_one(
    object: {
      user_id: $user_id, 
      route_id: $route_id,
      desired_pickup: $desired_pickup,
      desired_pickup_address: $desired_pickup_address,
      desired_dropoff: $desired_dropoff,
      desired_dropoff_address: $desired_dropoff_address
    }
  ) {
    route_id
    user_id
  }
}`;

type EventWithAuth = {
  authToken: string;
  authTokenDecoded: Auth0Token;
} & AWSLambda.APIGatewayEvent;

const PointSchema = Joi.object({
  type: Joi.string().valid('Point'),
  coordinates: Joi.array().items(Joi.number()).min(2).max(2),
  crs: Joi.object({
    type: Joi.string().valid('name'),
    properties: Joi.object({
      name: Joi.string().valid('EPSG:4326'),
    })
  })
});

const schema = Joi.object({
  route_id: Joi.string().uuid(),
  desired_dropoff: PointSchema,
  desired_dropoff_address: Joi.string(),
  desired_pickup: PointSchema,
  desired_pickup_address: Joi.string(),
});

const stopDone = async (event: EventWithAuth): Promise<Response> => {
  if (!process.env.HASURA_ADMIN_SECRET) {
    throw new Error('Missing HASURA_ADMIN_SECRET environment variable');
  }

  if (!event.body) {
    return errorResponse({
      status: '400',
      message: 'Missing event body',
    });
  }

  const body = JSON.parse(event.body);
  const input: MutationReserveSeatActionArgs = body.input;

  const { error, value } = schema.validate(input);

  if (error) {
    return errorResponse({
      status: '400',
      message: error,
    });
  }

  const { data, errors } = await execute<
    ReserveSeatActionVariables,
    ReserveSeatMutationOutput
    >(
    ReserveSeatAction,
    {
      user_id: event.authTokenDecoded.sub,
      route_id: value.route_id,
      desired_dropoff: value.desired_dropoff,
      desired_dropoff_address: value.desired_dropoff_address,
      desired_pickup: value.desired_pickup,
      desired_pickup_address: value.desired_pickup_address,
    },
    { headers: { 'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET } }
  );

  // if Hasura operation errors, then throw error
  if (errors) {
    return errorResponse({
      status: '400',
      message: errors[0].message,
    });
  }
  return successResponse(data.insert_route_stop_user_one);
};

export default runWarm(validateToken(stopDone));
