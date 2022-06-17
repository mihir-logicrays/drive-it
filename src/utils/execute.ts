import fetch from 'node-fetch';
import { HasuraError } from './types';

const execute: <OperationInputType, OperationResponseType>(
  operation: string,
  variables: OperationInputType,
  options?: { headers: { [key: string]: string } }
) => Promise<{ data: OperationResponseType; errors: HasuraError[] }> = async (
  operation,
  variables,
  options
) => {
  if (!process.env.HASURA_URL) {
    throw new Error('Missing HASURA_URL environment variable');
  }

  const fetchResponse = await fetch(process.env.HASURA_URL, {
    method: 'POST',
    body: JSON.stringify({
      query: operation,
      variables,
    }),
    headers: options?.headers,
  });
  const data = await fetchResponse.json();
  console.log('DEBUG: ', JSON.stringify(data));
  return data;
};

export default execute;
