import Joi from 'joi';
import {
  successResponse,
  runWarm,
  errorResponse,
  StopDoneActionVariables,
  Auth0Token,
  MutationStopDoneActionArgs,
  StopDoneMutationOutput,
} from './utils';
import { Response } from './utils/lambda-response';
import execute from './utils/execute';
import validateToken from './utils/validateToken';

const StopDoneAction = `mutation StopDoneAction($id: uuid!, $done: Boolean = true) {
  update_stops_by_pk(pk_columns: {id: $id}, _set: {done: $done}) {
    id
    done
  }
}`;

type EventWithAuth = {
  authToken: string;
  authTokenDecoded: Auth0Token;
} & AWSLambda.APIGatewayEvent;

const schema = Joi.object({
  id: Joi.string().uuid(),
  done: Joi.boolean().optional(),
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
  const input: MutationStopDoneActionArgs = body.input;

  const { error, value } = schema.validate(input);

  if (error) {
    return errorResponse({
      status: '400',
      message: error,
    });
  }

  const { data, errors } = await execute<
    StopDoneActionVariables,
    StopDoneMutationOutput
  >(
    StopDoneAction,
    { id: value.id, done: value?.done ?? true },
    { headers: { 'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET } }
  );

  // if Hasura operation errors, then throw error
  if (errors) {
    return errorResponse({
      status: '400',
      message: errors[0].message,
    });
  }
  return successResponse(data.update_stops_by_pk);
};

export default runWarm(validateToken(stopDone));
