import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { timeAgo } from '../components/communities/timeAgo';
import { useAuth } from '../context/auth';
import { CommunitiesApiError, createReply, deleteReply, deleteThread, fetchThread, reportReply, reportThread, type ThreadDetail } from '../services/communitiesApi';
import { notify } from '../utils/notifications';

const CircleThread = () => {
  const { slug = '', id = '' } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;
    fetchThread(slug, id)
      .then(data => { if (alive) { setThread(data); setError(null); } })
      .catch(err => { if (alive) setError({ message: err instanceof Error ? err.message : 'Could not load this discussion.', status: err instanceof CommunitiesApiError ? err.status : undefined }); });
    return () => { alive = false; };
  }, [slug, id, attempt, isAuthenticated]);

  const back = <Link to={`/communities/${slug}`} className="circle-back"><ArrowLeft size={15} aria-hidden="true" /> Back to circle</Link>;

  if (!isAuthenticated && !loading) {
    return (
      <section className="page-shell"><div className="container">{back}
        <header className="page-head">
          <h1 className="page-head__title">Members only</h1>
          <p className="page-head__lede">Sign in and join this circle to read its discussions.</p>
        </header>
        <button type="button" className="circle-join" onClick={() => navigate('/login', { state: { from: `/communities/${slug}/threads/${id}` } })}>Sign in</button>
      </div></section>
    );
  }

  if (error && !thread) {
    const locked = error.status === 403;
    return (
      <section className="page-shell"><div className="container">{back}
        {error.status === 404 || locked ? (
          <header className="page-head">
            <h1 className="page-head__title">{locked ? 'Members only' : 'Discussion not found'}</h1>
            <p className="page-head__lede">{locked ? 'Join this circle to read and join its discussions.' : 'This discussion may have been deleted.'}</p>
          </header>
        ) : (
          <div className="dash__error" role="alert"><div>{error.message}</div><button type="button" className="dash__retry" onClick={() => setAttempt(n => n + 1)}>Try again</button></div>
        )}
      </div></section>
    );
  }

  if (!thread) {
    return <section className="page-shell"><div className="container">{back}<div className="circle-skeleton circle-skeleton--hero" role="status" aria-label="Loading discussion" /></div></section>;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !reply.trim()) return;
    setBusy(true);
    try {
      const created = await createReply(slug, thread.id, reply.trim());
      setThread({ ...thread, replies: [...thread.replies, created], replyCount: thread.replyCount + 1 });
      setReply('');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not post your reply.', 'error');
    } finally { setBusy(false); }
  };

  const removeThread = async () => {
    if (!window.confirm('Delete this discussion and all its replies?')) return;
    try { await deleteThread(slug, thread.id); notify('Discussion deleted.'); navigate(`/communities/${slug}`); }
    catch (err) { notify(err instanceof Error ? err.message : 'Could not delete the discussion.', 'error'); }
  };

  const report = async (kind: 'thread' | 'reply', replyId?: number) => {
    if (!window.confirm('Report this post to the circle? It is hidden automatically once several members report it.')) return;
    try {
      if (kind === 'thread') await reportThread(slug, thread.id); else await reportReply(slug, thread.id, replyId!);
      notify('Thanks, your report was sent.');
    } catch (err) { notify(err instanceof Error ? err.message : 'Could not send your report.', 'error'); }
  };

  const removeReply = async (replyId: number) => {
    if (!window.confirm('Delete this reply?')) return;
    try {
      await deleteReply(slug, thread.id, replyId);
      setThread({ ...thread, replies: thread.replies.filter(r => r.id !== replyId), replyCount: thread.replyCount - 1 });
    } catch (err) { notify(err instanceof Error ? err.message : 'Could not delete the reply.', 'error'); }
  };

  return (
    <section className="page-shell">
      <div className="container circle-thread-page">
        {back}
        <article className="circle-post">
          <h1 className="page-head__title">{thread.title}</h1>
          <p className="circle-post__meta">{thread.author} · {timeAgo(thread.createdAt)}</p>
          {thread.hidden && <p className="circle-hidden" role="status">Members reported this discussion, so only you can see it right now.</p>}
          <p className="circle-post__body">{thread.body}</p>
          {!thread.mine && <button type="button" className="circle-link" onClick={() => report('thread')}>Report</button>}
          {thread.mine && <button type="button" className="circle-link circle-link--danger" onClick={removeThread}>Delete discussion</button>}
        </article>

        <h2 className="section-sub">{thread.replies.length === 1 ? '1 reply' : `${thread.replies.length} replies`}</h2>
        <ul className="circle-replies">
          {thread.replies.map(r => (
            <li key={r.id}>
              <p className="circle-post__meta">{r.author} · {timeAgo(r.createdAt)}</p>
              {r.hidden && <p className="circle-hidden" role="status">Members reported this reply, so only you can see it right now.</p>}
              <p className="circle-post__body">{r.body}</p>
              {!r.mine && <button type="button" className="circle-link" onClick={() => report('reply', r.id)}>Report</button>}
              {r.mine && <button type="button" className="circle-link circle-link--danger" onClick={() => removeReply(r.id)}>Delete reply</button>}
            </li>
          ))}
        </ul>

        <form className="circle-form" onSubmit={submit}>
          <label htmlFor="reply-body">Add a reply</label>
          <textarea id="reply-body" value={reply} maxLength={4000} rows={4} onChange={e => setReply(e.target.value)} required />
          <div className="circle-form__actions"><button type="submit" className="circle-join" disabled={busy || !reply.trim()}>{busy ? 'Posting…' : 'Post reply'}</button></div>
        </form>
      </div>
    </section>
  );
};

export default CircleThread;
