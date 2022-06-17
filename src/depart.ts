import * as Joi from 'joi';
import {
  successResponse,
  runWarm,
  errorResponse,
  MutationRouteDepartActionArgs,
  RouteDepartMutationOutput,
  RouteDepartMutationVariables,
  Auth0Token,
} from './utils';
import { Response } from './utils/lambda-response';
import execute from './utils/execute';
import validateToken from './utils/validateToken';

const RouteDepartMutation = `mutation RouteDepartMutation($id: uuid!, $driver_id: String!) {
  update_routes_by_pk(pk_columns: {id: $id}, _set: {driver_id: $driver_id, departed: true}) {
    id
    driver_id
    departed
  }
}`;

type EventWithAuth = {
  authToken: string;
  authTokenDecoded: Auth0Token;
} & AWSLambda.APIGatewayEvent;

const schema = Joi.object({
  id: Joi.string().uuid(),
});

const depart = async (event: EventWithAuth): Promise<Response> => {
  if (!process.env.HASURA_ADMIN_SECRET) {
    throw new Error('Missing HASURA_ADMIN_SECRET environment variable');
  }

  if (!event.body) {
    return errorResponse({
      status: "400",
      message: 'Missing event body',
    });
  }

  const body = JSON.parse(event.body);
  const input: MutationRouteDepartActionArgs = body.input;

  const { error, value } = schema.validate(input);

  if (error) {
    return errorResponse({
      status: "400",
      message: error,
    });
  }

  const { data, errors } = await execute<
    RouteDepartMutationVariables,
    RouteDepartMutationOutput
  >(
    RouteDepartMutation,
    { id: value.id, driver_id: event.authTokenDecoded.sub },
    { headers: { 'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET } }
  );

  // if Hasura operation errors, then throw error
  if (errors) {
    return errorResponse({
      status: "400",
      message: errors[0].message,
    });
  }
  return successResponse(data.update_routes_by_pk);
};

export default runWarm(validateToken(depart));
