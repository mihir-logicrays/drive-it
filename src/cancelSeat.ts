import * as Joi from 'joi';
import {
  successResponse,
  runWarm,
  errorResponse,
  CancelSeatActionVariables,
  Auth0Token,
  MutationCancelSeatActionArgs,
  CancelSeatMutationOutput,
} from './utils';
import { Response } from './utils/lambda-response';
import execute from './utils/execute';
import validateToken from './utils/validateToken';

const CancelSeatAction = `mutation CancelSeatMutation($route_id: uuid!, $user_id: String!) {
  delete_route_stop_user(where: {route_id: {_eq: $route_id}, user_id: {_eq: $user_id}}) {
    affected_rows
  }
}`;

type EventWithAuth = {
  authToken: string;
  authTokenDecoded: Auth0Token;
} & AWSLambda.APIGatewayEvent;

const schema = Joi.object({
  route_id: Joi.string().uuid(),
});

const cancelSeat = async (event: EventWithAuth): Promise<Response> => {
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
  const input: MutationCancelSeatActionArgs = body.input;

  const { error, value } = schema.validate(input);

  if (error) {
    return errorResponse({
      status: '400',
      message: error,
    });
  }

  const { data, errors } = await execute<
    CancelSeatActionVariables,
    CancelSeatMutationOutput
  >(
    CancelSeatAction,
    {
      user_id: event.authTokenDecoded.sub,
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
  return successResponse(data.delete_route_stop_user);
};

export default runWarm(validateToken(cancelSeat));
