import { errorResponse } from './lambda-response';
import jwksClient from 'jwks-rsa';
import jwt from 'jsonwebtoken';

const validateToken =
  (lambdaFunc: AWSLambda.Handler): AWSLambda.Handler =>
  async (event, context, callback) => {
    if (!process.env.AUTH0_DOMAIN) {
      throw new Error('Missing AUTH0_DOMAIN environment variable');
    }

    const authHeader =
      event.headers.Authorization || event.headers.authorization;
    let authToken: string | null = null;

    if (authHeader) {
      const authHeaderParts = authHeader.split(' ');
      if (authHeaderParts[0] === 'Bearer' && authHeaderParts[1]) {
        authToken = authHeaderParts[1];
      }
    }

    if (!authToken) {
      return errorResponse({
        message: 'Missing authentication token',
      });
    }

    const client = jwksClient({
      jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
    });

    try {
      event.authToken = authToken;
      event.authTokenDecoded = await new Promise((resolve, reject) => {
        jwt.verify(
          // TODO: Figure out why TypeScript can't "see" the if() guard up there and get rid of the "as"
          authToken as string,
          (header, callback) => {
            client.getSigningKey(header.kid, (err, key) => {
              if (err) throw new Error(err.message);
              const signingKey = key.getPublicKey();
              callback(null, signingKey);
            });
          },
          {
            algorithms: ['RS256'],
            issuer: `https://${process.env.AUTH0_DOMAIN}/`,
          },
          (err, decoded) => {
            if (err) reject(err);
            resolve(decoded);
          }
        );
      });
    } catch (e) {
      return errorResponse({
        status: "401",
        message: e.message,
      });
    }

    return lambdaFunc(event, context, callback);
  };

export default validateToken;
