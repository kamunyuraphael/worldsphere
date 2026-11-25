import { useSyncExternalStore } from 'react';
import { Loader2 } from 'lucide-react';
import { isServerWaking, subscribeServerWaking } from '../services/serverStatus';

/** Explains long first requests instead of leaving buttons frozen with no feedback. */
const ServerWakeNotice = () => {
  const waking = useSyncExternalStore(subscribeServerWaking, isServerWaking, () => false);
  if (!waking) return null;
  return (
    <div className="wake-notice" role="status" aria-live="polite">
      <Loader2 size={18} className="wake-notice__spin" aria-hidden="true" />
      <span>
        Waking the server up. The first request after a quiet spell can take up to a minute; no need to refresh.
      </span>
    </div>
  );
};
export default ServerWakeNotice;
