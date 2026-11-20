import fs from 'node:fs';

/**
 * Pulls every local `/images/...` string literal out of a generated data
 * file (src/data/*.generated.ts). These files are plain
 * `export const x = { ...literal JSON-shaped object... }` — no expressions,
 * no template strings — so a regex over quoted string values is safe and
 * far simpler than a real TS parse.
 */
export function extractLocalImagePaths(fileText) {
  const matches = fileText.matchAll(/"(\/images\/[^"]+)"/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

/** `/images/tourism/Nairobi/Bomas%20of%20Kenya/hero%20image.jpg` -> absolute filesystem path under public/. */
export function localPathToFsPath(publicRoot, urlPath) {
  return `${publicRoot}${decodeURIComponent(urlPath)}`;
}

/**
 * Turns a decoded local path into a stable, readable Cloudinary public_id
 * (no extension — Cloudinary infers format on delivery).
 *   /images/tourism/Nairobi/Bomas of Kenya/hero image.jpg
 *   -> worldsphere/tourism/nairobi/bomas-of-kenya/hero-image
 */
export function toPublicId(urlPath, { prefix = 'worldsphere' } = {}) {
  const decoded = decodeURIComponent(urlPath);
  const withoutExt = decoded.replace(/\.[a-z0-9]+$/i, '');
  const slug = withoutExt
    .split('/')
    .filter(Boolean)
    .filter((segment) => segment !== 'images') // drop the leading "images" segment; "tourism/..." is descriptive enough
    .map((segment) =>
      segment
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .join('/');
  return `${prefix}/${slug}`;
}

export function readManifestFile(path) {
  return fs.readFileSync(path, 'utf8');
}
