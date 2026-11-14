import { createError, defineEventHandler, getQuery } from 'h3';
import { fetchArr } from '../utils/arr-fetch';
import { getAiredEpisodes, movieHasFile, type ArrMovie } from '../utils/arr-library';

interface QueueRecord {
  id: number;
  downloadId?: string;
  title: string;
  status: string;
  timeleft?: string;
  size: number;
  sizeleft: number;
  movieId?: number;
  seriesId?: number;
  seasonNumber?: number;
  trackedDownloadState?: string;
}

interface QueuePage {
  records?: QueueRecord[];
  pageSize?: number;
  totalRecords?: number;
}

type TrackedDownload = { type: 'movie'; arrId: number } | { type: 'tv'; arrId: number; seasons: number[] };

function readTrackedDownloads(value: unknown): TrackedDownload[] {
  if (value === undefined) return [];
  try {
    const requests = typeof value === 'string' ? JSON.parse(value) : null;
    if (Array.isArray(requests) && requests.every(request =>
      request && Number.isSafeInteger(request.arrId) && request.arrId > 0 &&
      (request.type === 'movie' || (request.type === 'tv' && Array.isArray(request.seasons) &&
        request.seasons.length > 0 && request.seasons.every(season => Number.isSafeInteger(season) && season > 0)))
    )) return requests;
  } catch {
    // Malformed JSON is an invalid tracking query.
  }
  throw createError({ statusCode: 400, statusMessage: 'Invalid tracked downloads' });
}

const processQueue = (service: string, records: QueueRecord[]) => {
  return records.map(item => {
    const totalSize = item.size;
    const sizeLeft = item.sizeleft;
    const progress = totalSize > 0 ? ((totalSize - sizeLeft) / totalSize) * 100 : 0;
    const status = item.status.toLowerCase();
    const state = item.trackedDownloadState?.toLowerCase();

    return {
      id: `${service}:${item.id}`,
      type: service === 'Radarr' ? 'movie' as const : 'tv' as const,
      arrId: item.movieId ?? item.seriesId,
      season: item.seasonNumber,
      downloadId: item.downloadId || item.id,
      title: item.title,
      status: item.status,
      timeleft: item.timeleft,
      progress: Math.min(100, Math.max(0, progress)),
      isQueued: status === 'queued',
      transferring: (status === 'downloading' && progress > 0) || status === 'completed' ||
        state === 'importpending' || state === 'importing' || state === 'imported',
      blocked: status === 'failed' || state === 'failed' || state === 'importblocked' || state === 'ignored',
    };
  });
};

const getQueue = async (service: string, baseUrl: string, apiKey: string) => {
  if (!baseUrl || !apiKey) {
    console.warn(`${service} URL or API key is not configured.`);
    return [];
  }

  const pageSize = 100;
  const signal = AbortSignal.timeout(5000);
  const records = new Map<number, QueueRecord>();
  for (let page = 1; ; page++) {
    const queue = await fetchArr<QueuePage>(baseUrl, apiKey, `/queue?page=${page}&pageSize=${pageSize}`, { signal });
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

async function checkImport(request: TrackedDownload, config: ReturnType<typeof useRuntimeConfig>) {
  const signal = AbortSignal.timeout(5000);
  if (request.type === 'movie') {
    const movie = await fetchArr<ArrMovie>(config.radarrUrl, config.radarrApiKey, `/movie/${request.arrId}`, { signal });
    return movieHasFile(movie);
  }

  const episodes = await getAiredEpisodes(config.sonarrUrl, config.sonarrApiKey, request.arrId, request.seasons, signal);
  return episodes.length > 0 && episodes.every(episode => episode.hasFile);
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const tracked = readTrackedDownloads(query.tracked);
  const config = useRuntimeConfig(event);
  const [radarr, sonarr, imports] = await Promise.all([
    getQueue('Radarr', config.radarrUrl, config.radarrApiKey).catch(() => null),
    getQueue('Sonarr', config.sonarrUrl, config.sonarrApiKey).catch(() => null),
    Promise.all(tracked.map(request => checkImport(request, config).catch(() => null))),
  ]);

  // Preserve each provider's order among entries with the same priority.
  const entries = [...(radarr ?? []), ...(sonarr ?? [])].sort((a, b) =>
    downloadPriority(a.status, a.progress) - downloadPriority(b.status, b.progress)
  );
  if (query.tracked === undefined) return entries;
  return { entries, imports, unavailable: { movie: radarr === null, tv: sonarr === null } };
});

