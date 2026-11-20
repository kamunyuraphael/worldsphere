/**
 * Backend base URLs.
 *  - API_BASE_URL → `server/`     (accounts, favorites, AI chat; PostgreSQL)
 *  - ML_API_URL   → `ml-service/` (conservation-risk model + insights)
 */
const normalize = (value: string) => value.replace(/\/+$/, '');

const requireInProd = (name: string, value: string | undefined, fallback: string): string => {
  const configured = value?.trim();
  if (!configured && import.meta.env.PROD) {
    throw new Error(`WorldSphere configuration error: ${name} is required for production builds.`);
  }
  return normalize(configured || fallback);
};

export const API_BASE_URL = requireInProd('VITE_API_URL', import.meta.env.VITE_API_URL, 'http://localhost:8000');
export const ML_API_URL = requireInProd('VITE_ML_API_URL', import.meta.env.VITE_ML_API_URL, 'http://localhost:8001');
