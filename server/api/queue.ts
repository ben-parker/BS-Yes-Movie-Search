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

interface QueuePage {
  records?: QueueRecord[];
  pageSize?: number;
  totalRecords?: number;
}

const processQueue = (service: string, records: QueueRecord[]) => {
  return records.map(item => {
    const totalSize = item.size;
    const sizeLeft = item.sizeleft;
    const progress = totalSize > 0 ? ((totalSize - sizeLeft) / totalSize) * 100 : 0;

    return {
      id: `${service}:${item.id}`,
      downloadId: item.downloadId || item.id,
      title: item.title,
      status: item.status,
      timeleft: item.timeleft,
      progress: Math.min(100, Math.max(0, progress)),
      isQueued: item.status.toLowerCase() === 'queued',
    };
  });
};

const getQueue = async (service: string, baseUrl: string, apiKey: string) => {
  if (!baseUrl || !apiKey) {
    console.warn(`${service} URL or API key is not configured.`);
    return [];
  }

  const pageSize = 100;
  const records = new Map<number, QueueRecord>();
  for (let page = 1; ; page++) {
    const queue = await fetchArr<QueuePage>(baseUrl, apiKey, `/queue?page=${page}&pageSize=${pageSize}`);
    if (!queue.records?.length) break;

    for (const item of queue.records) records.set(item.id, item);
    if (page * (queue.pageSize || pageSize) >= (queue.totalRecords ?? records.size)) break;
  }

  return processQueue(service, [...records.values()]);
};

const downloadPriority = (status: string, progress: number) => {
  if (status.toLowerCase() !== 'downloading') return 2;

  // The queue can report 'downloading' for items that have yet to transfer any bytes.
  return progress > 0 && progress < 100 ? 0 : 1;
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  try {
    const [radarrQueue, sonarrQueue] = await Promise.all([
      getQueue('Radarr', config.radarrUrl, config.radarrApiKey),
      getQueue('Sonarr', config.sonarrUrl, config.sonarrApiKey),
    ]);
    // Preserve each provider's order among entries with the same priority.
    return [...radarrQueue, ...sonarrQueue].sort((a, b) =>
      downloadPriority(a.status, a.progress) - downloadPriority(b.status, b.progress)
    );
  } catch {
    console.error('Error fetching queues');
    return [];
  }
});

