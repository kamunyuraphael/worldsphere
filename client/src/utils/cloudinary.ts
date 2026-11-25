/**
 * This helper takes your raw Cloudinary URL and injects 
 * optimization parameters (resizing, cropping, and quality).
 */
export const getOptimizedImage = (url: string, type: 'card' | 'hero' | 'thumb' = 'card') => {
  if (!url) return '';
  
  // 1. Identify where to inject the parameters
  // Cloudinary URLs look like: .../upload/v12345/folder/image.jpg
  const splitUrl = url.split('/upload/');
  const baseUrl = splitUrl[0] + '/upload/';
  const imagePath = splitUrl[1];

  // 2. Define transformation strings based on the UI needs
  const transformations = (() => {
    switch (type) {
    case 'hero':
      // High quality, wide, optimized for large screens
      return 'c_fill,w_1600,h_900,g_auto,q_auto,f_auto/';
    case 'card':
      // Perfect 3:2 ratio for your grid cards
      return 'c_fill,w_800,h_533,g_auto,q_auto,f_auto/';
    case 'thumb':
      // Small square for search results or footer
      return 'c_fill,w_150,h_150,g_auto,q_auto,f_auto/';
    default:
      return 'q_auto,f_auto/';
    }
  })();

  // 3. Return the modified URL
  return `${baseUrl}${transformations}${imagePath}`;
};

/**
 * Helpers for serving Cloudinary images at the size a screen actually needs.
 * Works on any res.cloudinary.com image URL, with or without an existing
 * transformation segment, and leaves every other URL untouched.
 */
const CLOUDINARY_IMAGE = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?:(?:[a-z]{1,3}_[^/,]+,?)+\/)?(.+)$/;

export const isCloudinary = (url: string) => CLOUDINARY_IMAGE.test(url);

/** Same image, resized to `width` px (never upscaled), best format and automatic quality. */
export const cldUrl = (url: string, width: number): string => {
  const match = CLOUDINARY_IMAGE.exec(url);
  return match ? `${match[1]}f_auto,q_auto,w_${width},c_limit/${match[2]}` : url;
};

export const cldSrcSet = (url: string, widths: readonly number[]): string | undefined =>
  isCloudinary(url) ? widths.map(w => `${cldUrl(url, w)} ${w}w`).join(', ') : undefined;
