import type { UnsplashCredit as UnsplashCreditData } from '../data/unsplashCredits.generated';
import './UnsplashCredit.css';

interface Props {
  credit?: UnsplashCreditData;
  /** Use on a dark/photo background where the default translucent-dark chip would be low-contrast. */
  variant?: 'dark' | 'light';
}

/**
 * Required by Unsplash's API Guidelines wherever a photo obtained through
 * their API is displayed: a visible credit linking to the photographer's
 * profile and to Unsplash, both carrying utm_source/utm_medium (already
 * baked into `credit.profileUrl` by scripts/refresh-unsplash-credits.mjs).
 * Renders nothing if there's no name yet (see unsplashCredits.generated.ts).
 */
const UnsplashCredit = ({ credit, variant = 'dark' }: Props) => {
  if (!credit?.name) return null;
  return (
    <span className={`unsplash-credit unsplash-credit--${variant}`}>
      Photo by <a href={credit.profileUrl} target="_blank" rel="noopener noreferrer">{credit.name}</a> on{' '}
      <a href={`https://unsplash.com/?utm_source=worldsphere&utm_medium=referral`} target="_blank" rel="noopener noreferrer">Unsplash</a>
    </span>
  );
};

export default UnsplashCredit;
