import { fetchArr } from './arr-fetch';

export interface ArrMovie {
  id: number;
  tmdbId: number;
  hasFile?: boolean;
  movieFileId?: number;
}

export interface ArrSeries {
  id: number;
  tvdbId: number;
  statistics?: { episodeFileCount?: number };
}

interface ArrEpisode {
  id: number;
  seasonNumber: number;
  airDateUtc?: string;
  hasFile: boolean;
}

export function movieHasFile(movie?: ArrMovie) {
  return movie?.hasFile ?? ((movie?.movieFileId ?? 0) > 0);
}

export async function getAiredEpisodes(url: string, apiKey: string, seriesId: number, seasons: number[], signal?: AbortSignal) {
  const episodes = await fetchArr<ArrEpisode[]>(url, apiKey, `/episode?seriesId=${seriesId}`, { signal });
  const now = Date.now();
  return episodes.filter(episode =>
    seasons.includes(episode.seasonNumber) && Date.parse(episode.airDateUtc ?? '') <= now
  );
}
