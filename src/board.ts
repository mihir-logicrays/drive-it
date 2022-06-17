import * as Joi from 'joi';
import {
  successResponse,
  runWarm,
  errorResponse,
  BoardActionVariables,
  Auth0Token,
  MutationBoardActionArgs,
  BoardMutationOutput,
  ChallengeQueryOutput,
  ChallengeQueryVariables,
} from './utils';
import { Response } from './utils/lambda-response';
import execute from './utils/execute';
import validateToken from './utils/validateToken';

const BoardAction = `mutation BoardMutation($user_id: String!, $route_id: uuid!) {
  update_route_stop_user_by_pk(pk_columns: {route_id: $route_id, user_id: $user_id}, _set: {boarded: true}) {
    route_id
    user_id
    boarded
  }
}
`;

const ChallengeQuery = `query ChallengeQuery($user_id: String!, $route_id: uuid!) {
  route_stop_user_by_pk(route_id: $route_id, user_id: $user_id) {
    route {
      car {
        id
        qr
      }
    }
  }
}
`;

type EventWithAuth = {
  authToken: string;
  authTokenDecoded: Auth0Token;
} & AWSLambda.APIGatewayEvent;

const schema = Joi.object({
  route_id: Joi.string().uuid(),
  challenge: Joi.string(),
});

const board = async (event: EventWithAuth): Promise<Response> => {
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
  const input: MutationBoardActionArgs = body.input;

  const { error, value } = schema.validate(input);

  if (error) {
    return errorResponse({
      status: '400',
      message: error,
    });
  }

  const challengeResult = await execute<
    ChallengeQueryVariables,
    ChallengeQueryOutput
  >(
    ChallengeQuery,
    {
      user_id: event.authTokenDecoded.sub,
      route_id: value.route_id,
    },
    { headers: { 'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET } }
  );

  if (
    challengeResult.data.route_stop_user_by_pk.route.car.id !== value.challenge
  ) {
    return errorResponse({
      status: '400',
      message: 'Invalid challenge',
    });
  }

  const { data, errors } = await execute<
    BoardActionVariables,
    BoardMutationOutput
  >(
    BoardAction,
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
  return successResponse(data.update_route_stop_user_by_pk);
};

export default runWarm(validateToken(board));
