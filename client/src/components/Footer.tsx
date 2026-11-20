import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/auth';
import './footer.css';

interface FooterLink { to: string; label: string; }
interface FooterColumn { heading: string; links: FooterLink[]; }

const COLUMNS: FooterColumn[] = [
  {
    heading: 'Explore',
    links: [
      { to: '/explore', label: 'Species explorer' },
      { to: '/stories', label: 'Stories' },
      { to: '/maps', label: 'Maps' },
      { to: '/research', label: 'Research' },
      { to: '/risk-predictor', label: 'Risk predictor' },
    ],
  },
  {
    heading: 'Travel Kenya',
    links: [
      { to: '/tourism', label: 'Tourism hub' },
      { to: '/ai/tour-guide', label: 'AI tour guide' },
      { to: '/destinations/nairobi', label: 'Nairobi' },
      { to: '/destinations/maasai-mara', label: 'Maasai Mara' },
      { to: '/destinations/diani-beach', label: 'Diani Beach' },
    ],
  },
  {
    heading: 'WorldSphere',
    links: [
      { to: '/ai', label: 'AI assistants' },
      { to: '/communities', label: 'Communities' },
      { to: '/expeditions', label: 'Expeditions' },
      { to: '/about', label: 'About us' },
    ],
  },
];

const Footer = () => {
  const { isAuthenticated, user } = useAuth();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <Container>
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <img className="footer__brand-logo" src="/WorldSphere-Logo-Package/WorldSphere-Logo.png" alt="WorldSphere" />
            <p>
              A digital sanctuary for the planet&apos;s biodiversity, with a Kenya travel guide alongside it.
              Explore species, plan trips and learn what it takes to protect them.
            </p>

            <div className="site-footer__cta">
              {isAuthenticated ? (
                <>
                  <p className="site-footer__cta-text">Signed in as {user?.name.split(' ')[0]}.</p>
                  <Link to="/profile" className="site-footer__button">Open your workspace</Link>
                </>
              ) : (
                <>
                  <p className="site-footer__cta-text">Save trips, favorites, budgets and AI plans with a free account.</p>
                  <div className="site-footer__cta-actions">
                    <Link to="/signup" className="site-footer__button">Create account</Link>
                    <Link to="/login" className="site-footer__link-inline">Log in</Link>
                  </div>
                </>
              )}
            </div>
          </div>

          {COLUMNS.map(column => (
            <nav key={column.heading} className="site-footer__column" aria-labelledby={`footer-${column.heading.replace(/\s+/g, '-').toLowerCase()}`}>
              <h2 id={`footer-${column.heading.replace(/\s+/g, '-').toLowerCase()}`} className="site-footer__heading">{column.heading}</h2>
              <ul>
                {column.links.map(link => (
                  <li key={link.to}><Link to={link.to}>{link.label}</Link></li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="site-footer__bottom">
          <p>&copy; {year} WorldSphere. All rights reserved.</p>
          <p className="site-footer__credits">
            Species data from{' '}
            <a href="https://www.gbif.org" target="_blank" rel="noopener noreferrer">GBIF<span className="visually-hidden"> (opens in a new tab)</span></a>
            {' · '}Maps &copy;{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors<span className="visually-hidden"> (opens in a new tab)</span></a>
          </p>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
