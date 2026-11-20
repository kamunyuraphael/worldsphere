import { API_BASE_URL } from './apiConfig';

/** Cached IUCN Red List totals served by the server (`GET /stats/iucn`). */
export interface IucnStats {
  generated_at: string;
  cached_at: string;
  red_list_version?: string | null;
  scope_code: number;
  partial: boolean;
  /** kingdom → Red List category code → number of assessed species */
  by_kingdom: Record<string, Record<string, number>>;
  /** system (Terrestrial/Freshwater/Marine) → category code → number */
  by_system: Record<string, Record<string, number>>;
  note?: string;
}

/** Resolves to null when the server has no IUCN data yet (503) so the page can simply omit the section. */
export const fetchIucnStats = async (): Promise<IucnStats | null> => {
  const res = await fetch(`${API_BASE_URL}/stats/iucn`);
  if (res.status === 503 || res.status === 404) return null;
  if (!res.ok) throw new Error(`IUCN statistics request failed (${res.status}).`);
  return res.json() as Promise<IucnStats>;
};
