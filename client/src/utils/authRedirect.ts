export const AUTH_RETURN_KEY = 'worldsphere_auth_return';

/** Only allow same-site paths so a crafted link can't bounce someone to another site after login. */
export const safeReturnPath = (value: unknown): string | null =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : null;

const readStored = (): string | null => {
  try {
    return safeReturnPath(sessionStorage.getItem(AUTH_RETURN_KEY));
  } catch {
    return null;
  }
};

/** Where to send someone after signing in; clears the stored return path. */
export const consumeReturnPath = (routeState: unknown, fallback = '/profile'): string => {
  const fromState = safeReturnPath((routeState as { from?: unknown } | null)?.from);
  const stored = readStored();
  try {
    sessionStorage.removeItem(AUTH_RETURN_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
  return fromState ?? stored ?? fallback;
};

/** True when the visitor was sent here because a page needed them to sign in. */
export const hasReturnPath = (routeState: unknown): boolean =>
  safeReturnPath((routeState as { from?: unknown } | null)?.from) !== null || readStored() !== null;
