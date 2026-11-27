import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import { joinCircle, leaveCircle, type Circle } from '../../services/communitiesApi';
import { notify } from '../../utils/notifications';

interface Props {
  circle: Circle;
  /** Called with the updated circle (new member count, joined flag) after a join or leave. */
  onChange: (circle: Circle) => void;
}

const JoinButton = ({ circle, onChange }: Props) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setBusy(true);
    try {
      const updated = circle.joined ? await leaveCircle(circle.slug) : await joinCircle(circle.slug);
      onChange(updated);
      notify(updated.joined ? `You joined ${updated.name}.` : `You left ${updated.name}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Something went wrong. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={`circle-join ${circle.joined ? 'circle-join--joined' : ''}`}
      onClick={toggle}
      disabled={busy}
      aria-busy={busy}
    >
      {busy ? <Loader2 size={15} className="circle-join__spin" aria-hidden="true" /> : circle.joined ? <Check size={15} aria-hidden="true" /> : null}
      <span>{circle.joined ? 'Joined' : isAuthenticated ? 'Join circle' : 'Sign in to join'}</span>
    </button>
  );
};

export default JoinButton;
