import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Lock } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Discussions from '../components/communities/Discussions';
import JoinButton from '../components/communities/JoinButton';
import { CIRCLE_ICON, catalogFor, memberLabel } from '../components/communities/circleMeta';
import WildlifeCard from '../components/WildlifeCard';
import { useAuth } from '../context/auth';
import { CommunitiesApiError, fetchCircle, type CircleDetail as Detail } from '../services/communitiesApi';

const FEATURED = 6;

const CircleDetail = () => {
  const { slug = '' } = useParams();
  const { isAuthenticated, user } = useAuth();
  const [circle, setCircle] = useState<Detail | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchCircle(slug)
      .then(data => { if (alive) { setCircle(data); setError(null); } })
      .catch(err => { if (alive) setError({ message: err instanceof Error ? err.message : 'Could not load this circle.', status: err instanceof CommunitiesApiError ? err.status : undefined }); });
    return () => { alive = false; };
  }, [slug, attempt, isAuthenticated, user?.id]);

  // After a join or leave, refetch so the roster appears or disappears with the new state.
  const changed = useCallback(() => setAttempt(n => n + 1), []);

  if (error?.status === 404) {
    return (
      <section className="page-shell"><div className="container">
        <header className="page-head">
          <h1 className="page-head__title">Circle not found</h1>
          <p className="page-head__lede">That circle doesn't exist. <Link to="/communities">See all circles</Link>.</p>
        </header>
      </div></section>
    );
  }

  if (!circle) {
    return (
      <section className="page-shell"><div className="container">
        {error
          ? <div className="dash__error" role="alert"><div>{error.message}</div><button type="button" className="dash__retry" onClick={() => setAttempt(n => n + 1)}>Try again</button></div>
          : <div className="circle-skeleton circle-skeleton--hero" role="status" aria-label="Loading circle" />}
      </div></section>
    );
  }

  const Icon = CIRCLE_ICON[circle.category];
  const catalog = catalogFor(circle.category);

  return (
    <section className="page-shell">
      <div className="container">
        <Link to="/communities" className="circle-back"><ArrowLeft size={15} aria-hidden="true" /> All circles</Link>

        <header className="circle-hero">
          <span className="tile__icon circle-hero__icon"><Icon size={26} strokeWidth={1.75} aria-hidden="true" /></span>
          <div className="circle-hero__text">
            <h1 className="page-head__title">{circle.name}</h1>
            <p className="page-head__lede">{circle.description}</p>
            <p className="circle-hero__meta">{memberLabel(circle.memberCount)} · {catalog.length} catalog entries</p>
          </div>
          <JoinButton circle={circle} onChange={changed} />
        </header>

        <h2 className="section-sub">From the catalog</h2>
        <div className="circle-featured">
          {catalog.slice(0, FEATURED).map(entry => <WildlifeCard key={`${entry.category}-${entry.id}`} entry={entry} />)}
        </div>
        <p className="circle-more"><Link to={`/stories?category=${circle.category}`}>See all {catalog.length} entries</Link></p>

        {circle.joined && <Discussions slug={circle.slug} />}

        <h2 className="section-sub">Members</h2>
        {circle.members ? (
          <ul className="circle-roster" aria-label={`Members of ${circle.name}`}>
            {circle.members.map(member => (
              <li key={`${member.name}-${member.joinedAt}`}>
                <span className="circle-roster__avatar" aria-hidden="true">{member.name.trim().charAt(0).toUpperCase()}</span>
                <span className="circle-roster__name">{member.name}</span>
                <span className="circle-roster__date">Joined {new Date(member.joinedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="circle-locked">
            <Lock size={18} aria-hidden="true" />
            <p>{isAuthenticated ? 'Join this circle to see who is in it.' : 'Sign in and join this circle to see who is in it.'}</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default CircleDetail;
