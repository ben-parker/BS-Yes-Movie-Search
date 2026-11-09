import { createError, defineEventHandler, getQuery } from 'h3';
import { $fetch } from 'ofetch';
import { useStorage } from 'nitropack/runtime';
import { fetchArr } from '../utils/arr-fetch';

const tvdbStorage = useStorage('tvdb');

const getLibraryIds = async (baseUrl: string, apiKey: string, path: string, idField: 'tmdbId' | 'tvdbId') => {
  if (!baseUrl || !apiKey) return new Set<number>();

  try {
    const records = await fetchArr<Partial<Record<typeof idField, number>>[]>(baseUrl, apiKey, path);
    return new Set(records.map(record => record[idField]));
  } catch {
    console.error(`Error fetching library at ${path}`);
    return new Set<number>();
  }
};

const getTvdbToken = async (config) => {
  const cachedToken = await tvdbStorage.getItem('token');
  if (cachedToken && cachedToken.expires > Date.now()) {
    return cachedToken.token;
  }
  const response = await $fetch('https://api4.thetvdb.com/v4/login', {
    method: 'POST',
    body: { apikey: config.thetvdbApiKey },
  });
  const token = response.data.token;
  const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  const expires = decodedToken.exp * 1000;
  await tvdbStorage.setItem('token', { token, expires });
  return token;
};

const searchTmdb = async (query, config) => {
  const tmdbApiUrl = 'https://api.themoviedb.org/3/search/movie';
  const [data, libraryIds] = await Promise.all([
    $fetch(tmdbApiUrl, { params: { api_key: config.tmdbApiKey, query: query } }),
    getLibraryIds(config.radarrUrl, config.radarrApiKey, '/movie', 'tmdbId')
  ]);

  const topTenRelevant = data.results
    .filter(m => m.release_date)
    .slice(0, 10);

  const sortedByYear = topTenRelevant.sort((a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime());

  return sortedByYear.map(movie => {
    const inLibrary = libraryIds.has(movie.id);
    return {
      id: movie.id,
      title: movie.title,
      year: movie.release_date.slice(0, 4),
      overview: movie.overview,
      posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      inLibrary: inLibrary,
    };
  });
};

const searchTheTvDb = async (query, config) => {
  const [token, libraryIds] = await Promise.all([
    getTvdbToken(config),
    getLibraryIds(config.sonarrUrl, config.sonarrApiKey, '/series', 'tvdbId')
  ]);
  
  const thetvdbApiUrl = 'https://api4.thetvdb.com/v4';
  const searchData = await $fetch(`${thetvdbApiUrl}/search`, {
    params: { query, type: 'series' },
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const topTenRelevant = searchData.data
    .filter(s => s.year)
    .slice(0, 10);

  const detailedShows = await Promise.all(
    topTenRelevant.map(async (show) => {
      try {
        const extendedData = await $fetch(`${thetvdbApiUrl}/series/${show.tvdb_id}/extended`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return { ...show, seasons: extendedData.data.seasons };
      } catch {
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
  const { type, query } = getQuery(event);
  if (!query) return [];
  const config = useRuntimeConfig(event);
  try {
    if (type === 'movie') return await searchTmdb(query, config);
    return await searchTheTvDb(query, config);
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Search service unavailable' });
  }
});


