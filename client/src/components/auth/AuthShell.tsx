import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { tourismImageManifest } from '../../data/tourismImages.generated';
import './auth.css';

/** Parks whose hero photos (hosted on Cloudinary) can sit beside the form. */
const SCENES = {
  amboseli: { place: 'Amboseli' },
  'maasai-mara': { place: 'Maasai Mara' },
} as const;

export type AuthScene = keyof typeof SCENES;

interface AuthShellProps {
  scene: AuthScene;
  title: string;
  lede: string;
  /** Short list of what an account saves; shown on the photo from tablet width up. */
  benefits?: string[];
  children: ReactNode;
  footer: ReactNode;
}

/** Two-column sign-in / sign-up layout: a captioned photograph beside the form. */
export const AuthShell = ({ scene, title, lede, benefits, children, footer }: AuthShellProps) => {
  const { place } = SCENES[scene];
  const hero = tourismImageManifest[scene].hero;

  return (
    <section className="page-shell auth-shell">
      <div className="auth-shell__inner">
        <aside className="auth-photo">
          {hero && <img className="auth-photo__image" src={hero} alt="" decoding="async" fetchPriority="high" />}
          <div className="auth-photo__caption">
            <p className="auth-photo__place">{place}, Kenya</p>
            {benefits && benefits.length > 0 && (
              <ul className="auth-photo__benefits" aria-label="What your account saves">
                {benefits.map(item => <li key={item}>{item}</li>)}
              </ul>
            )}
            <Link className="auth-photo__link" to={`/destinations/${scene}`}>Read the {place} guide</Link>
          </div>
        </aside>

        <div className="auth-main">
          <h1 className="auth-title">{title}</h1>
          <p className="auth-lede">{lede}</p>
          {children}
          <p className="auth-switch">{footer}</p>
          <p className="auth-guest"><Link to="/explore">Just looking? Keep exploring without an account</Link></p>
        </div>
      </div>
    </section>
  );
};
