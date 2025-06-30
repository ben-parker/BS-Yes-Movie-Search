import { defineEventHandler } from 'h3';
import { $fetch } from 'ofetch';

const processQueue = (records) => {
  return records.map(item => {
    const totalSize = item.size;
    const sizeLeft = item.sizeleft;
    const progress = totalSize > 0 ? ((totalSize - sizeLeft) / totalSize) * 100 : 0;

    return {
      downloadId: item.downloadId || item.id,
      title: item.title,
      status: item.status,
      timeleft: item.timeleft,
      progress: progress,
      isQueued: item.status.toLowerCase() === 'queued',
    };
  });
};

const getRadarrQueue = async () => {
  const config = useRuntimeConfig();
  if (!config.radarrUrl || !config.radarrApiKey) {
    console.warn('Radarr URL or API key is not configured.');
    return [];
  }
  const queue = await $fetch(`${config.radarrUrl}/api/v3/queue`, {
    headers: { 'X-Api-Key': config.radarrApiKey },
  });
  return processQueue(queue.records || []);
};

const getSonarrQueue = async () => {
  const config = useRuntimeConfig();
  if (!config.sonarrUrl || !config.sonarrApiKey) {
    console.warn('Sonarr URL or API key is not configured.');
    return [];
  }
  const queue = await $fetch(`${config.sonarrUrl}/api/v3/queue`, {
    headers: { 'X-Api-Key': config.sonarrApiKey },
  });
  return processQueue(queue.records || []);
};

export default defineEventHandler(async () => {
  try {
    const [radarrQueue, sonarrQueue] = await Promise.all([
      getRadarrQueue(),
      getSonarrQueue(),
    ]);
    return [...radarrQueue, ...sonarrQueue];
  } catch (error) {
    console.error('Error fetching queues:', error);
    return [];
  }
});

