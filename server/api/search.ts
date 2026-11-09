import { createError, defineEventHandler, getQuery } from 'h3';
import { fetchArr } from '../utils/arr-fetch';
import { cachedProvider, fetchProvider } from '../utils/provider-cache';
import { fetchTvdb } from '../utils/tvdb';

const maxTmdbPage = 500;
const languageNames = new Intl.DisplayNames('en', { type: 'language', fallback: 'none' });
type Config = ReturnType<typeof useRuntimeConfig>;
type MovieSearch = {
  results: {
    id: number;
    title: string;
    release_date?: string;
    original_language?: string;
    overview: string;
    poster_path?: string;
  }[];
  total_pages: number;
};
type TvSearch = {
  data: {
    tvdb_id: string;
    name: string;
    year?: string;
    overview?: string;
    image_url?: string;
    studios?: string[];
    network?: string;
  }[];
};

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

const searchTmdb = async (query: string, config: Config, page: number, signal: AbortSignal) => {
  const [movies, libraryIds] = await Promise.all([
    cachedProvider('tmdb', ['search', query, page], async () => {
      const response = await fetchProvider<MovieSearch>('tmdb', 'https://api.themoviedb.org/3/search/movie', {
        params: { api_key: config.tmdbApiKey, query, page },
        signal,
      });
      const results = response.data.results.map(movie => ({
        id: movie.id,
        title: movie.title,
        year: movie.release_date?.slice(0, 4) || null,
        language: /^[a-z]{2}$/i.test(movie.original_language ?? '')
          ? languageNames.of(movie.original_language!) ?? null
          : null,
        overview: movie.overview,
        posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      }));
      return { ...response, value: { results, hasMore: page < Math.min(response.data.total_pages, maxTmdbPage) } };
    }, movies => movies.results.length ? 600 : 60),
    getLibraryIds(config.radarrUrl, config.radarrApiKey, '/movie', 'tmdbId', signal),
  ]);

  return { ...movies, results: movies.results.map(movie => ({ ...movie, inLibrary: libraryIds.has(movie.id) })) };
};

const searchTheTvDb = async (query: string, config: Config, signal: AbortSignal) => {
  const [shows, libraryIds] = await Promise.all([
    cachedProvider('tvdb', ['search', query], async () => {
      const response = await fetchTvdb<TvSearch>('/search', config.thetvdbApiKey, signal, { query, type: 'series' });
      const value = response.data.data
        .filter(show => show.year)
        .slice(0, 10)
        .sort((a, b) => Number(b.year) - Number(a.year))
        .map(show => ({
          id: Number(show.tvdb_id),
          title: show.name,
          year: show.year,
          overview: show.overview ?? 'No description available.',
          posterUrl: show.image_url || null,
          studio: show.studios?.find(name => name.trim())?.trim() || show.network?.trim() || null,
        }));
      return { ...response, value };
    }, shows => shows.length ? 600 : 60),
    getLibraryIds(config.sonarrUrl, config.sonarrApiKey, '/series', 'tvdbId', signal),
  ]);
  return shows.map(show => ({ ...show, inLibrary: libraryIds.has(show.id) }));
};

export default defineEventHandler(async (event) => {
  const { type, query: requestedQuery, page: requestedPage } = getQuery(event);
  const query = typeof requestedQuery === 'string' ? requestedQuery.trim() : '';
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
