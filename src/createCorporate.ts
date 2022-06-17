import * as Joi from 'joi';
import fetch from 'node-fetch';
import {
  corsSuccessResponse,
  runWarm,
  corsErrorResponse,
  Auth0Token,
  MutationCreateCorporateArgs,
} from './utils';
import { Response } from './utils/lambda-response';

type EventWithAuth = {
  authToken: string;
  authTokenDecoded: Auth0Token;
} & AWSLambda.APIGatewayEvent;

const schema = Joi.object({
  badge: Joi.string().required(),
  phone: Joi.string().required(),
  company: Joi.string().required(),
  division: Joi.string().optional(),
  name: Joi.string().optional()
});

const createCorporate = async (event: EventWithAuth): Promise<Response> => {
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
    return corsErrorResponse({
      status: '400',
      message: 'Missing event body',
    });
  }

  const body = JSON.parse(event.body);
  console.log('body', body);
  const input: MutationCreateCorporateArgs = body.input;
  console.log('input', input);
  const { error, value } = schema.validate(input);
  console.log('value', value);

  if (error) {
    return corsErrorResponse({
      status: '400',
      message: error,
    });
  }
  console.log('corporate');
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
      return corsErrorResponse({
        status: '500',
        message: 'Error getting machine to machine token',
      });
    }

    const body: any = {
      connection: 'sms',
      phone_verified: true,
      phone_number: value.phone,
      app_metadata: {
        badge: value.badge,
        company: value.company,
      }
    };

    if (value.name && value.name.length > 1) {
      body.name = value.name;
    }

    if (value.division && value.division.length > 1) {
      body.app_metadata.division = value.division;
    }

    console.log('body', body);
    const createResponse = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${data.access_token}`,
          'cache-control': 'no-cache',
        },
        body: JSON.stringify(body),
      }
    );

    const json = await createResponse.json();
    return corsSuccessResponse({ user_id: json.user_id });
  } catch (error) {
    return corsErrorResponse({
      status: '500',
      message: error.message,
    });
  }
};

export default runWarm(createCorporate);
