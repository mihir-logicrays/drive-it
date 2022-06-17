import * as Joi from 'joi';
import fetch from 'node-fetch';
import {
  successResponse,
  runWarm,
  errorResponse,
  Auth0Token,
  MutationUpdateProfileActionArgs,
  UpdateProfileVariables,
  UpdateProfileActionOutput,
} from './utils';
import { Response } from './utils/lambda-response';
import execute from './utils/execute';
import validateToken from './utils/validateToken';

const UpdateProfileAction = `mutation UpdateProfileMutation($id: String!,$email: String, $name: String, $fcm_token: String) {
  update_users_by_pk(pk_columns: {id: $id}, _set: {email: $email, name: $name, fcm_token: $fcm_token}) {
    id
  }
}`;

type EventWithAuth = {
  authToken: string;
  authTokenDecoded: Auth0Token;
} & AWSLambda.APIGatewayEvent;

const schema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().optional(),
  email: Joi.string().email().optional(),
  fcm_token: Joi.string().optional(),
});

const updateProfile = async (event: EventWithAuth): Promise<Response> => {
  if (!process.env.AUTH0_DOMAIN) {
    throw new Error('Missing AUTH0_DOMAIN environment variable');
  }

  if (!process.env.AUTH0_CLIENT_ID) {
    throw new Error('Missing AUTH0_CLIENT_ID environment variable');
  }

  if (!process.env.AUTH0_CLIENT_SECRET) {
    throw new Error('Missing AUTH0_CLIENT_SECRET environment variable');
  }

  if (!event.body) {
    return errorResponse({
      status: '400',
      message: 'Missing event body',
    });
  }

  const body = JSON.parse(event.body);
  const input: MutationUpdateProfileActionArgs = body.input;
  console.log('input', input);

  const { error, value } = schema.validate(input);
  console.log('value', value);

  if (error) {
    return errorResponse({
      status: '400',
      message: error,
    });
  }

  if (value.name || value.email) {
    try {
      const tokenFetchResponse = await fetch(
        `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: process.env.AUTH0_CLIENT_ID,
            client_secret: process.env.AUTH0_CLIENT_SECRET,
            audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
          }),
        }
      );
      const data = await tokenFetchResponse.json();

      if (!data.access_token) {
        return errorResponse({
          status: '500',
          message: 'Error getting machine to machine token',
        });
      }

      const body: {
        name?: string;
        user_metadata?: { email?: string; fcm_token?: string };
      } = {};

      if (value.name) {
        body.name = value.name;
      }

      if (value.email) {
        body.user_metadata = {
          email: value.email,
        };
      }

      if (value.fcm_token) {
        body.user_metadata = {
          fcm_token: value.fcm_token,
        };
      }

      const patchResponse = await fetch(
        `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${value.id}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${data.access_token}`,
            'cache-control': 'no-cache',
          },
          body: JSON.stringify(body),
        }
      );
      await execute<UpdateProfileVariables, UpdateProfileActionOutput>(
        UpdateProfileAction,
        {
          id: value.id,
          name: value.name,
          fcm_token: value.fcm_token,
        },
        {
          headers: {
            'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET!,
          },
        }
      );

      console.log(await patchResponse.json());
    } catch (error) {
      return errorResponse({
        status: '500',
        message: error.message,
      });
    }
  }

  return successResponse({ id: value.id });
};

export default runWarm(validateToken(updateProfile));
