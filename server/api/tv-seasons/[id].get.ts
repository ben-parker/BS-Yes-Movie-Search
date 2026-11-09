import { createError, defineEventHandler, getRouterParam } from 'h3';
import { cachedProvider } from '../../utils/provider-cache';
import { fetchTvdb } from '../../utils/tvdb';

type SeriesDetails = { data: { seasons?: { number: number; type?: { name?: string } }[] } };

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid TV series ID' });
  }

  const { thetvdbApiKey } = useRuntimeConfig(event);
  const controller = new AbortController();
  const abortRequest = () => controller.abort();
  event.node.res.once('close', abortRequest);
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]);
  try {
    return await cachedProvider('tvdb', ['seasons', id], async () => {
      const response = await fetchTvdb<SeriesDetails>(`/series/${id}/extended`, thetvdbApiKey, signal);
      const airedSeasons = (response.data.data.seasons ?? [])
        .filter(season => season.type?.name === 'Aired Order' && season.number > 0)
        .map(season => season.number);
      const value = [...new Set(airedSeasons)].sort((a, b) => a - b);
      return { ...response, value };
    }, seasons => seasons.length ? 3600 : 60);
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'TV seasons unavailable' });
  } finally {
    event.node.res.off('close', abortRequest);
  }
});
