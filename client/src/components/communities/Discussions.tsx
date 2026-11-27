import { useEffect, useState, type FormEvent } from 'react';
import { MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createThread, fetchThreads, type Thread } from '../../services/communitiesApi';
import { notify } from '../../utils/notifications';
import { timeAgo } from './timeAgo';

const TITLE_MAX = 120;
const BODY_MAX = 4000;

/** Members-only discussion list and "start a discussion" form for one circle. */
const Discussions = ({ slug }: { slug: string }) => {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchThreads(slug)
      .then(data => { if (alive) { setThreads(data); setError(null); } })
      .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'Could not load discussions.'); });
    return () => { alive = false; };
  }, [slug, attempt]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || title.trim().length < 3 || !body.trim()) return;
    setBusy(true);
    try {
      const created = await createThread(slug, { title: title.trim(), body: body.trim() });
      setThreads(current => [created, ...(current ?? [])]);
      setTitle(''); setBody(''); setOpen(false);
      notify('Discussion posted.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not post your discussion.', 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="circle-discuss">
      <div className="circle-discuss__head">
        <h2 className="section-sub">Discussions</h2>
        {!open && <button type="button" className="circle-join" onClick={() => setOpen(true)}>Start a discussion</button>}
      </div>

      {open && (
        <form className="circle-form" onSubmit={submit}>
          <label htmlFor="thread-title">Title</label>
          <input id="thread-title" value={title} maxLength={TITLE_MAX} onChange={e => setTitle(e.target.value)} required minLength={3} autoFocus />
          <label htmlFor="thread-body">What do you want to share or ask?</label>
          <textarea id="thread-body" value={body} maxLength={BODY_MAX} rows={5} onChange={e => setBody(e.target.value)} required />
          <div className="circle-form__actions">
            <button type="submit" className="circle-join" disabled={busy}>{busy ? 'Posting…' : 'Post discussion'}</button>
            <button type="button" className="circle-link" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}

      {error ? (
        <div className="dash__error" role="alert"><div>{error}</div><button type="button" className="dash__retry" onClick={() => setAttempt(n => n + 1)}>Try again</button></div>
      ) : !threads ? (
        <div className="circle-skeleton circle-skeleton--row" role="status" aria-label="Loading discussions" />
      ) : threads.length === 0 ? (
        <div className="circle-locked"><MessageSquare size={18} aria-hidden="true" /><p>No discussions yet. Start the first one.</p></div>
      ) : (
        <ul className="circle-threads">
          {threads.map(t => (
            <li key={t.id}>
              <Link to={`/communities/${slug}/threads/${t.id}`} className="circle-thread">
                <span className="circle-thread__title">{t.title}{t.hidden && <em className="circle-thread__flag"> (hidden, under review)</em>}</span>
                <span className="circle-thread__meta">{t.author} · {t.replyCount === 1 ? '1 reply' : `${t.replyCount} replies`} · active {timeAgo(t.lastActivity)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Discussions;
