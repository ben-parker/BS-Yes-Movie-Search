import { createError, defineEventHandler, readBody } from 'h3';
import { fetchArr } from '../utils/arr-fetch';
import { getAiredEpisodes, movieHasFile, type ArrMovie, type ArrSeries } from '../utils/arr-library';

const sendToRadarr = async (movie, config) => {
  const { radarrUrl, radarrApiKey } = config;
  if (movie.arrId !== undefined) {
    const existing = await fetchArr<ArrMovie>(radarrUrl, radarrApiKey, `/movie/${movie.arrId}`);
    if (existing.tmdbId !== movie.id) throw new Error('Movie ID does not match');
    if (!movieHasFile(existing)) {
      await fetchArr(radarrUrl, radarrApiKey, '/command', {
        method: 'POST',
        body: { name: 'MoviesSearch', movieIds: [existing.id] },
      });
    }
    return existing.id;
  }

  const payload = {
    tmdbId: movie.id,
    title: movie.title,
    year: Number(movie.year),
    qualityProfileId: config.radarrQualityProfileId,
    rootFolderPath: config.radarrRootFolderPath,
    monitored: true,
    addOptions: {
      searchForMovie: true,
    },
  };

  const added = await fetchArr<ArrMovie>(radarrUrl, radarrApiKey, '/movie', {
    method: 'POST',
    body: payload,
  });
  return added.id;
};

const sendToSonarr = async (tvShow, config) => {
  const { sonarrUrl, sonarrApiKey } = config;
  if (tvShow.arrId !== undefined) {
    const existing = await fetchArr<ArrSeries>(sonarrUrl, sonarrApiKey, `/series/${tvShow.arrId}`);
    if (existing.tvdbId !== tvShow.id) throw new Error('Series ID does not match');
    const episodes = await getAiredEpisodes(sonarrUrl, sonarrApiKey, existing.id, tvShow.seasons);
    const episodeIds = episodes.filter(episode => !episode.hasFile).map(episode => episode.id);
    if (episodeIds.length) {
      await fetchArr(sonarrUrl, sonarrApiKey, '/command', {
        method: 'POST',
        body: { name: 'EpisodeSearch', episodeIds },
      });
    }
    return existing.id;
  }

  const seasonsToMonitor = tvShow.seasons.map(seasonNumber => ({
    seasonNumber,
    monitored: true,
  }));

  const payload = {
    tvdbId: tvShow.id,
    title: tvShow.title,
    qualityProfileId: config.sonarrQualityProfileId,
    rootFolderPath: config.sonarrRootFolderPath,
    monitored: true,
    seasons: seasonsToMonitor,
    addOptions: {
      searchForMissingEpisodes: true,
    },
  };

  const added = await fetchArr<ArrSeries>(sonarrUrl, sonarrApiKey, '/series', {
    method: 'POST',
    body: payload,
  });
  return added.id;
};

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { type, ...item } = body ?? {};
  if (type !== 'movie' && type !== 'tv') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid download type' });
  }
  if (item.arrId !== undefined && (!Number.isSafeInteger(item.arrId) || item.arrId <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid library ID' });
  }
  if (type === 'tv' && (!Array.isArray(item.seasons) || !item.seasons.length ||
      !item.seasons.every(season => Number.isSafeInteger(season) && season > 0))) {
    throw createError({ statusCode: 400, statusMessage: 'Select at least one TV season' });
  }

  const config = useRuntimeConfig(event);

  try {
    const arrId = type === 'movie' ? await sendToRadarr(item, config) : await sendToSonarr(item, config);
    return { status: 'ok', arrId };
  } catch {
    console.error(`Error submitting ${type} download`);
    throw createError({ statusCode: 502, statusMessage: 'Download service unavailable' });
  }
});
