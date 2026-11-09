import { defineEventHandler } from 'h3';
import { fetchArr } from '../utils/arr-fetch';

interface QueueRecord {
  id: number;
  downloadId?: string;
  title: string;
  status: string;
  timeleft?: string;
  size: number;
  sizeleft: number;
}

const processQueue = (records: QueueRecord[]) => {
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

const getQueue = async (service: string, baseUrl: string, apiKey: string) => {
  if (!baseUrl || !apiKey) {
    console.warn(`${service} URL or API key is not configured.`);
    return [];
  }

  const queue = await fetchArr<{ records?: QueueRecord[] }>(baseUrl, apiKey, '/queue');
  return processQueue(queue.records || []);
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  try {
    const [radarrQueue, sonarrQueue] = await Promise.all([
      getQueue('Radarr', config.radarrUrl, config.radarrApiKey),
      getQueue('Sonarr', config.sonarrUrl, config.sonarrApiKey),
    ]);
    return [...radarrQueue, ...sonarrQueue];
  } catch {
    console.error('Error fetching queues');
    return [];
  }
});

