import { useSyncExternalStore } from 'react';
import { isServerWaking, subscribeServerWaking } from '../services/serverStatus';

/**
 * A small animated globe that appears while the server is slow to answer (free-tier cold start).
 * No visible text: screen readers get a polite status instead.
 */
const ServerWakeIndicator = () => {
  const waking = useSyncExternalStore(subscribeServerWaking, isServerWaking, () => false);
  if (!waking) return null;
  return (
    <div className="wake-figure" role="status" aria-live="polite">
      <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" focusable="false">
        <circle className="wake-figure__ring" cx="20" cy="20" r="11" />
        <ellipse className="wake-figure__meridian" cx="20" cy="20" rx="4.5" ry="11" />
        <path className="wake-figure__meridian" d="M9 20h22" />
        <g className="wake-figure__orbit">
          <circle className="wake-figure__dot" cx="20" cy="3.5" r="3" />
        </g>
      </svg>
      <span className="visually-hidden">Connecting to the server. This can take up to a minute.</span>
    </div>
  );
};
export default ServerWakeIndicator;
