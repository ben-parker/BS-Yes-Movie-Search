import { $fetch, type FetchOptions } from 'ofetch';

export function fetchArr<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
  options?: Pick<FetchOptions, 'method' | 'body' | 'signal'>,
) {
  if (!baseUrl || !apiKey) {
    throw new Error('Arr service URL or API key is not configured');
  }

  return $fetch<T>(path, {
    ...options,
    baseURL: `${baseUrl.replace(/\/+$/, '')}/api/v3`,
    headers: { 'X-Api-Key': apiKey },
  });
}
