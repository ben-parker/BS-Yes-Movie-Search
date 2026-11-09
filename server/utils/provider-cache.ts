import { createHash } from 'node:crypto';
import { $fetch, type FetchOptions } from 'ofetch';
import { useStorage } from 'nitropack/runtime';

type Provider = 'tmdb' | 'tvdb';
type RequestOptions = Pick<FetchOptions, 'method' | 'body' | 'params' | 'headers' | 'signal'>;
type Cached<T> = { value: T; expiresAt: number };

const storage = useStorage('providerCache');
const retryAfter = new Map<Provider, number>();
// Provider requests use a fixed Accept and no Origin. The cache stores decoded JSON.
const fixedVariants = new Set(['accept', 'accept-encoding', 'origin']);

function seconds(value: string | null | undefined) {
  return value && /^\d+$/.test(value) ? Number(value) : undefined;
}

function freshness(headers: Headers, fallback: number, sentAt: number, receivedAt: number) {
  const directives = new Map<string, string | undefined>();
  for (const [, name, quoted, unquoted] of (headers.get('cache-control') ?? '').matchAll(
    /(?:^|,)\s*([\w-]+)(?:\s*=\s*(?:"([^"]*)"|([^,\s]+)))?/g
  )) {
    const key = name.toLowerCase();
    // An ambiguous freshness directive should never extend the lifetime.
    directives.set(key, directives.has(key) ? '0' : quoted ?? unquoted);
  }

  const vary = (headers.get('vary') ?? '').toLowerCase().split(',').map(name => name.trim());
  if (['private', 'no-store', 'no-cache'].some(name => directives.has(name)) ||
      headers.has('set-cookie') || vary.some(name => name && !fixedVariants.has(name))) {
    return 0;
  }

  const date = Date.parse(headers.get('date') ?? '');
  const originTime = Number.isFinite(date) ? date : receivedAt;
  const age = Math.max(0, receivedAt - originTime, (seconds(headers.get('age')) ?? 0) * 1000 + receivedAt - sentAt);
  const expiry = Date.parse(headers.get('expires') ?? '');
  let lifetimeMs = fallback * 1000;
  if (directives.has('s-maxage') || directives.has('max-age')) {
    const lifetime = directives.get(directives.has('s-maxage') ? 's-maxage' : 'max-age');
    lifetimeMs = Math.min(seconds(lifetime) ?? 0, 2 ** 31) * 1000;
  } else if (headers.has('expires')) {
    lifetimeMs = Number.isFinite(expiry) ? expiry - originTime : 0;
  }
  return Math.max(0, lifetimeMs - age);
}

export async function fetchProvider<T>(provider: Provider, url: string, options: RequestOptions) {
  const blockedUntil = retryAfter.get(provider) ?? 0;
  if (blockedUntil > Date.now()) {
    throw new Error(`${provider} requests are paused`);
  }

  const response = await $fetch.raw<T>(url, { ...options, retry: 0, ignoreResponseError: true });
  const retryHeader = response.headers.get('retry-after');
  if (response.status === 429 || (response.status === 503 && retryHeader)) {
    const delay = seconds(retryHeader);
    const until = delay === undefined ? Date.parse(retryHeader ?? '') : Date.now() + delay * 1000;
    const deadline = Number.isFinite(until) ? until : Date.now() + 10_000;
    retryAfter.set(provider, Math.max(retryAfter.get(provider) ?? 0, deadline));
  }
  if (!response.ok || response._data === undefined) {
    throw new Error(`${provider} returned HTTP ${response.status}`);
  }
  return { headers: response.headers, status: response.status, data: response._data };
}

export async function cachedProvider<T>(
  provider: Provider,
  keyParts: (string | number)[],
  fetchValue: () => Promise<{ headers: Headers; status: number; value: T }>,
  lifetime: (value: T) => number,
): Promise<T> {
  const key = `${provider}:${createHash('sha256').update(JSON.stringify(keyParts)).digest('hex')}`;
  const cached = await storage.getItem<Cached<T>>(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const sentAt = Date.now();
  const { value, headers, status } = await fetchValue();
  const receivedAt = Date.now();
  const ttl = status === 200 ? freshness(headers, lifetime(value), sentAt, receivedAt) : 0;
  if (ttl > 0) {
    await storage.setItem(key, { value, expiresAt: receivedAt + ttl });
  }
  return value;
}
