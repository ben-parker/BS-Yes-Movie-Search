import { useStorage } from 'nitropack/runtime';
import { fetchProvider } from './provider-cache';

const baseURL = 'https://api4.thetvdb.com/v4';
const storage = useStorage('tvdb');

async function getToken(apiKey: string, signal: AbortSignal) {
  const cached = await storage.getItem<{ token: string; expires: number }>('token');
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;

  const { data } = await fetchProvider<{ data: { token: string } }>('tvdb', `${baseURL}/login`, {
    method: 'POST',
    body: { apikey: apiKey },
    signal,
  });
  const token = data.data.token;
  const { exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  await storage.setItem('token', { token, expires: exp * 1000 });
  return token;
}

export async function fetchTvdb<T>(path: string, apiKey: string, signal: AbortSignal, params?: Record<string, string>) {
  const token = await getToken(apiKey, signal);
  return fetchProvider<T>('tvdb', `${baseURL}${path}`, {
    params,
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
}
