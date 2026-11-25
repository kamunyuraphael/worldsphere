/**
 * Free hosting plans put idle services to sleep, so the first request after a
 * quiet period can take 30-60 seconds. This module:
 *  - warms both services in the background when the site loads, and
 *  - exposes `apiFetch`, a fetch wrapper that flags "waking up" when a request
 *    is still pending after a few seconds so the UI can explain the wait.
 */
import { API_BASE_URL, ML_API_URL } from './apiConfig';

const SLOW_AFTER_MS = 4000;
const listeners = new Set<() => void>();
let slowRequests = 0;

const emit = () => listeners.forEach(listener => listener());

export const subscribeServerWaking = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const isServerWaking = () => slowRequests > 0;

export const apiFetch: typeof fetch = async (input, init) => {
  let flagged = false;
  const timer = window.setTimeout(() => { flagged = true; slowRequests += 1; emit(); }, SLOW_AFTER_MS);
  try {
    return await fetch(input, init);
  } finally {
    window.clearTimeout(timer);
    if (flagged) { slowRequests -= 1; emit(); }
  }
};

let warmed = false;
/** Fire-and-forget pings so the services are awake by the time someone clicks. */
export const warmServers = () => {
  if (warmed || !import.meta.env.PROD) return;
  warmed = true;
  for (const base of new Set([API_BASE_URL, ML_API_URL])) {
    fetch(`${base}/health`, { method: 'GET', cache: 'no-store' }).catch(() => undefined);
  }
};
