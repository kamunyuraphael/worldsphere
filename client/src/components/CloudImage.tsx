import { useCallback, useState, type ImgHTMLAttributes } from 'react';
import { cldSrcSet, cldUrl, isCloudinary } from '../utils/cloudinary';

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> {
  src: string;
  /** Candidate widths (px) offered to the browser. */
  widths?: readonly number[];
  /** Above-the-fold images load eagerly with high priority. */
  priority?: boolean;
}

const DEFAULT_WIDTHS = [480, 800, 1200, 1600] as const;

/**
 * An <img> that asks Cloudinary for right-sized files (srcset), lazy-loads,
 * and fades in over a soft placeholder so cards don't pop in blank.
 */
const CloudImage = ({ src, widths = DEFAULT_WIDTHS, sizes = '(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw', priority, className, onLoad, ...rest }: Props) => {
  const [loaded, setLoaded] = useState(false);
  // Images served from cache can finish before React attaches onLoad.
  const ref = useCallback((img: HTMLImageElement | null) => { if (img?.complete && img.naturalWidth > 0) setLoaded(true); }, []);
  const cloud = isCloudinary(src);
  return (
    <img
      {...rest}
      ref={ref}
      className={`cimg ${loaded ? 'cimg--loaded' : ''} ${className ?? ''}`.trim()}
      src={cloud ? cldUrl(src, widths[Math.min(1, widths.length - 1)]) : src}
      srcSet={cloud ? cldSrcSet(src, widths) : undefined}
      sizes={cloud ? sizes : undefined}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      onLoad={event => { setLoaded(true); onLoad?.(event); }}
    />
  );
};

export default CloudImage;
