import { createError, defineEventHandler, getQuery } from 'h3';
import { $fetch } from 'ofetch';
import { useStorage } from 'nitropack/runtime';
import { fetchArr } from '../utils/arr-fetch';

const tvdbStorage = useStorage('tvdb');
const maxTmdbPage = 500;

const getLibraryIds = async (baseUrl: string, apiKey: string, path: string, idField: 'tmdbId' | 'tvdbId', signal: AbortSignal) => {
  if (!baseUrl || !apiKey) return new Set<number>();

  try {
    const librarySignal = AbortSignal.any([signal, AbortSignal.timeout(3000)]);
    const records = await fetchArr<Partial<Record<typeof idField, number>>[]>(baseUrl, apiKey, path, {
      signal: librarySignal,
    });
    return new Set(records.map(record => record[idField]));
  } catch {
    signal.throwIfAborted();
    console.error(`Error fetching library at ${path}`);
    return new Set<number>();
  }
};

const getTvdbToken = async (config, signal: AbortSignal) => {
  const cachedToken = await tvdbStorage.getItem('token');
  if (cachedToken && cachedToken.expires > Date.now()) {
    return cachedToken.token;
  }
  const response = await $fetch('https://api4.thetvdb.com/v4/login', {
    method: 'POST',
    body: { apikey: config.thetvdbApiKey },
    signal,
  });
  const token = response.data.token;
  const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  const expires = decodedToken.exp * 1000;
  await tvdbStorage.setItem('token', { token, expires });
  return token;
};

const searchTmdb = async (query, config, page: number, signal: AbortSignal) => {
  const [data, libraryIds] = await Promise.all([
    $fetch('https://api.themoviedb.org/3/search/movie', {
      params: { api_key: config.tmdbApiKey, query, page },
      signal,
    }),
    getLibraryIds(config.radarrUrl, config.radarrApiKey, '/movie', 'tmdbId', signal),
  ]);

  const results = data.results.map(movie => ({
    id: movie.id,
    title: movie.title,
    year: movie.release_date?.slice(0, 4) || null,
    overview: movie.overview,
    posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
    inLibrary: libraryIds.has(movie.id),
  }));

  return { results, hasMore: page < Math.min(data.total_pages, maxTmdbPage) };
};

const searchTheTvDb = async (query, config, signal: AbortSignal) => {
  const [token, libraryIds] = await Promise.all([
    getTvdbToken(config, signal),
    getLibraryIds(config.sonarrUrl, config.sonarrApiKey, '/series', 'tvdbId', signal)
  ]);
  
  const thetvdbApiUrl = 'https://api4.thetvdb.com/v4';
  const searchData = await $fetch(`${thetvdbApiUrl}/search`, {
    params: { query, type: 'series' },
    signal,
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const topTenRelevant = searchData.data
    .filter(s => s.year)
    .slice(0, 10);

  const detailedShows = await Promise.all(
    topTenRelevant.map(async (show) => {
      try {
        const extendedData = await $fetch(`${thetvdbApiUrl}/series/${show.tvdb_id}/extended`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal,
        });
        return { ...show, seasons: extendedData.data.seasons };
      } catch {
        signal.throwIfAborted();
        console.error(`Failed to fetch extended data for ${show.name}`);
        return { ...show, seasons: [] };
      }
    })
  );

  const sortedByYear = detailedShows.sort((a, b) => parseInt(b.year, 10) - parseInt(a.year, 10));

  return sortedByYear.map(show => {
    const seasons = Array.isArray(show.seasons)
      ? [...new Set(show.seasons
          .filter(s => s.type?.name === 'Aired Order' && s.number > 0)
          .map(s => s.number))]
          .sort((a, b) => a - b)
      : [];

    const tvdbId = parseInt(show.tvdb_id, 10);
    const inLibrary = libraryIds.has(tvdbId);
    return {
      id: tvdbId,
      title: show.name,
      year: show.year,
      overview: show.overview ?? 'No description available.',
      posterUrl: show.image_url || null,
      seasons: seasons,
      inLibrary: inLibrary,
    };
  });
};

export default defineEventHandler(async (event) => {
  const { type, query, page: requestedPage } = getQuery(event);
  const paginated = type === 'movie' && requestedPage !== undefined;
  const page = paginated ? Number(requestedPage) : 1;
  if (!Number.isInteger(page) || page < 1 || page > maxTmdbPage) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid movie search page' });
  }
  if (!query) return paginated ? { results: [], hasMore: false } : [];

  const config = useRuntimeConfig(event);
  const controller = new AbortController();
  const abortSearch = () => controller.abort();
  event.node.res.once('close', abortSearch);
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]);

  try {
    if (type === 'movie') {
      const result = await searchTmdb(query, config, page, signal);
      return paginated ? result : result.results;
    }
    return await searchTheTvDb(query, config, signal);
  } catch {
    controller.abort();
    throw createError({ statusCode: 502, statusMessage: 'Search service unavailable' });
  } finally {
    event.node.res.off('close', abortSearch);
  }
});
