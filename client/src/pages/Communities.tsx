import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import JoinButton from '../components/communities/JoinButton';
import { CIRCLE_ICON, catalogFor, memberLabel } from '../components/communities/circleMeta';
import { useAuth } from '../context/auth';
import { fetchCircles, type Circle } from '../services/communitiesApi';

const Communities = () => {
  const { isAuthenticated, user } = useAuth();
  const [circles, setCircles] = useState<Circle[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  // Reload when someone signs in or out so the "Joined" state matches the account.
  useEffect(() => {
    let alive = true;
    fetchCircles()
      .then(data => { if (alive) { setCircles(data); setError(''); } })
      .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'Could not load communities.'); });
    return () => { alive = false; };
  }, [attempt, isAuthenticated, user?.id]);

  const replace = useCallback((updated: Circle) =>
    setCircles(current => current?.map(c => (c.slug === updated.slug ? updated : c)) ?? current), []);

  return (
    <section className="page-shell">
      <div className="container">
        <header className="page-head">
          <p className="kicker">Communities</p>
          <h1 className="page-head__title">Explore together</h1>
          <p className="page-head__lede">
            Circles of explorers, researchers, and conservationists gathered around
            the species and places they care about. Join one to see who else is in it.
          </p>
        </header>

        {error && !circles && (
          <div className="dash__error" role="alert">
            <div>{error}</div>
            <button type="button" className="dash__retry" onClick={() => setAttempt(n => n + 1)}>Try again</button>
          </div>
        )}

        {!circles && !error && (
          <div className="tile-grid mb-5" role="status" aria-label="Loading communities">
            {[0, 1, 2].map(i => <div key={i} className="tile circle-skeleton" />)}
          </div>
        )}

        {circles && (
          <div className="tile-grid mb-5">
            {circles.map((circle, i) => {
              const Icon = CIRCLE_ICON[circle.category];
              return (
                <Reveal key={circle.slug} delay={i * 0.07}>
                  <article className="tile circle-card">
                    <span className="tile__icon"><Icon size={22} strokeWidth={1.75} aria-hidden="true" /></span>
                    <h2 className="tile__title"><Link to={`/communities/${circle.slug}`} className="circle-card__link">{circle.name}</Link></h2>
                    <p className="tile__desc">{circle.description}</p>
                    <div className="tile__stats">
                      <span>{memberLabel(circle.memberCount)}</span>
                      <span>{catalogFor(circle.category).length} entries</span>
                    </div>
                    <div className="circle-card__actions">
                      <JoinButton circle={circle} onChange={replace} />
                      <Link to={`/communities/${circle.slug}`} className="tile__more">Open circle <ArrowRight size={15} strokeWidth={2} aria-hidden="true" /></Link>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        )}

        <Reveal>
          <aside className="circle-soon">
            <MessageCircle size={20} strokeWidth={1.75} aria-hidden="true" />
            <div>
              <h2 className="circle-soon__title">Discussions are coming</h2>
              <p>Threads and replies are next. Members of a circle will be the first to post when they open.</p>
            </div>
          </aside>
        </Reveal>
      </div>
    </section>
  );
};

export default Communities;
