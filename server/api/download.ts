import { defineEventHandler, readBody } from 'h3';
import { $fetch } from 'ofetch';

const sendToRadarr = async (movie) => {
  const config = useRuntimeConfig();
  if (!config.radarrApiKey) {
    throw new Error('Radarr API key is not configured.');
  }

  const payload = {
    tmdbId: movie.id,
    title: movie.original_title,
    year: parseInt(movie.release_date.slice(0, 4)),
    qualityProfileId: config.radarrQualityProfileId,
    rootFolderPath: config.radarrRootFolderPath,
    monitored: true,
    addOptions: {
      searchForMovie: true,
    },
  };

  await $fetch(`${config.radarrUrl}/movie`, {
    method: 'POST',
    headers: {
      'X-Api-Key': config.radarrApiKey,
    },
    body: payload,
  });
};

const sendToSonarr = async (tvShow) => {
  const config = useRuntimeConfig();
  if (!config.sonarrApiKey) {
    throw new Error('Sonarr API key is not configured.');
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

  await $fetch(`${config.sonarrUrl}/api/v3/series`, {
    method: 'POST',
    headers: {
      'X-Api-Key': config.sonarrApiKey,
    },
    body: payload,
  });
};

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { type, ...item } = body;

  try {
    if (type === 'movie') {
      await sendToRadarr(item);
    } else if (type === 'tv') {
      await sendToSonarr(item);
    } else {
      throw new Error('Invalid type specified');
    }
    return { status: 'ok' };
  } catch (error) {
    console.error(`Error processing download request: ${error.message}`);
    return { status: 'error', message: error.message };
  }
});
