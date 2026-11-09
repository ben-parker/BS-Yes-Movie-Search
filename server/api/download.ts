import { createError, defineEventHandler, readBody } from 'h3';
import { fetchArr } from '../utils/arr-fetch';

const sendToRadarr = async (movie, config) => {
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

  await fetchArr(config.radarrUrl, config.radarrApiKey, '/movie', {
    method: 'POST',
    body: payload,
  });
};

const sendToSonarr = async (tvShow, config) => {
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

  await fetchArr(config.sonarrUrl, config.sonarrApiKey, '/series', {
    method: 'POST',
    body: payload,
  });
};

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { type, ...item } = body ?? {};
  if (type !== 'movie' && type !== 'tv') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid download type' });
  }

  const config = useRuntimeConfig(event);

  try {
    if (type === 'movie') {
      await sendToRadarr(item, config);
    } else {
      await sendToSonarr(item, config);
    }
  } catch {
    console.error(`Error submitting ${type} download`);
    throw createError({ statusCode: 502, statusMessage: 'Download service unavailable' });
  }

  return { status: 'ok' };
});
