import crypto from 'node:crypto';

/**
 * Cloudinary signed-upload signature.
 *
 * Algorithm (per Cloudinary's own docs, verified against their published
 * test vector: signing "public_id=sample_image&timestamp=1315060510" with
 * secret "abcd" must produce "b4ad47fb4e25c7bf5f92a20089f9db59bc302313"):
 *   1. Take every param EXCEPT file, cloud_name, resource_type, api_key, signature.
 *   2. Sort those params by key, ascending.
 *   3. Join as "key=value" pairs with "&".
 *   4. Append the api_secret directly (no separator).
 *   5. SHA-1 hash the result, hex-encoded.
 */
export function signCloudinaryParams(params, apiSecret) {
  const toSign = Object.keys(params)
    .filter((key) => !['file', 'cloud_name', 'resource_type', 'api_key', 'signature'].includes(key))
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

// Self-check against Cloudinary's own documented example, run whenever this
// module is imported, so a future refactor that breaks the algorithm fails
// loudly instead of silently uploading with bad signatures.
const KNOWN_GOOD = 'b4ad47fb4e25c7bf5f92a20089f9db59bc302313';
const actual = signCloudinaryParams({ public_id: 'sample_image', timestamp: 1315060510 }, 'abcd');
if (actual !== KNOWN_GOOD) {
  throw new Error(`Cloudinary signature self-check failed: got ${actual}, expected ${KNOWN_GOOD}`);
}
