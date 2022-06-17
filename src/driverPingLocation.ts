import * as Joi from 'joi';
import {
  successResponse,
  runWarm,
  errorResponse,
  DriverPingLocationActionVariables,
  Auth0Token,
  MutationDriverPingLocationActionArgs,
  DriverPingLocationMutationOutput,
} from './utils';
import { Response } from './utils/lambda-response';
import execute from './utils/execute';
import validateToken from './utils/validateToken';

const DriverPingLocationAction = `mutation DriverPingLocationMutation($current_location: geography!, $route_id: uuid = "") {
  update_routes_by_pk(pk_columns: {id: $route_id}, _set: {current_location: $current_location}) {
    current_location
    id
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
    }),
  }),
});

const schema = Joi.object({
  route_id: Joi.string().uuid(),
  current_location: PointSchema,
});

const driverPingLocation = async (event: EventWithAuth): Promise<Response> => {
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
  const input: MutationDriverPingLocationActionArgs = body.input;

  const { error, value } = schema.validate(input);

  if (error) {
    return errorResponse({
      status: '400',
      message: error,
    });
  }

  const { data, errors } = await execute<
    DriverPingLocationActionVariables,
    DriverPingLocationMutationOutput
  >(
    DriverPingLocationAction,
    {
      current_location: value.current_location,
      route_id: value.route_id,
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
  return successResponse(data.update_routes_by_pk);
};

export default runWarm(validateToken(driverPingLocation));
