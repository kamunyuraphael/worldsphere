#!/usr/bin/env node
/**
 * Uploads every locally-hosted tourism photo (public/images/tourism/**) to
 * Cloudinary, and writes a migration map of {localPath: cloudinaryUrl}.
 *
 * These are NOT Unsplash photos — nothing here touches Unsplash's API or
 * hotlinking rules. This is purely: stop shipping 50MB of images in the git
 * repo / Vite build, and get Cloudinary's resizing + format negotiation
 * (matching src/utils/cloudinary.ts, already used for the encyclopedia).
 *
 * Usage:
 *   node scripts/import-tourism-images.mjs            # dry run (default) — no network calls, no writes
 *   node scripts/import-tourism-images.mjs --apply     # actually uploads and writes the migration map
 *
 * Required env (see .env.example):
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signCloudinaryParams } from './lib/cloudinary-sign.mjs';
import { extractLocalImagePaths, toPublicId } from './lib/local-image-manifest.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const APPLY = process.argv.includes('--apply');
const MANIFEST_FILES = ['src/data/tourismImages.generated.ts', 'src/data/nairobiAttractionImages.generated.ts'];
const MIGRATION_MAP_PATH = path.join(ROOT, 'scripts', '.tourism-image-migration-map.json');

function loadUniqueLocalPaths() {
  const all = new Set();
  for (const relFile of MANIFEST_FILES) {
    const text = fs.readFileSync(path.join(ROOT, relFile), 'utf8');
    for (const p of extractLocalImagePaths(text)) all.add(p);
  }
  return [...all];
}

async function uploadOne({ urlPath, cloudName, apiKey, apiSecret }) {
  const fsPath = path.join(ROOT, 'public', decodeURIComponent(urlPath));
  const publicId = toPublicId(urlPath);
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { public_id: publicId, overwrite: true, timestamp };
  const signature = signCloudinaryParams(paramsToSign, apiSecret);

  const form = new FormData();
  form.set('file', new Blob([fs.readFileSync(fsPath)]), path.basename(fsPath));
  form.set('public_id', publicId);
  form.set('overwrite', 'true');
  form.set('timestamp', String(timestamp));
  form.set('api_key', apiKey);
  form.set('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(`Cloudinary upload failed for ${publicId}: ${body.error?.message ?? res.status}`);
  return body.secure_url;
}

async function main() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  const localPaths = loadUniqueLocalPaths();
  console.log(`Found ${localPaths.length} unique local tourism images across ${MANIFEST_FILES.length} manifests.`);

  const missing = localPaths.filter((p) => !fs.existsSync(path.join(ROOT, 'public', decodeURIComponent(p))));
  if (missing.length) {
    console.error(`Aborting: ${missing.length} referenced file(s) do not exist on disk:`);
    missing.forEach((p) => console.error('  ', p));
    process.exitCode = 1;
    return;
  }

  if (!APPLY) {
    console.log('\nDRY RUN — no network calls, no files written. Pass --apply to actually upload.\n');
    for (const p of localPaths.slice(0, 8)) console.log(`  ${p}  ->  ${toPublicId(p)}`);
    if (localPaths.length > 8) console.log(`  ... and ${localPaths.length - 8} more`);
    return;
  }

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set to --apply.');
  }

  const migrationMap = fs.existsSync(MIGRATION_MAP_PATH) ? JSON.parse(fs.readFileSync(MIGRATION_MAP_PATH, 'utf8')) : {};
  let done = 0;
  for (const urlPath of localPaths) {
    if (migrationMap[urlPath]) { done++; continue; } // already migrated in a previous run — skip re-uploading
    process.stdout.write(`Uploading (${done + 1}/${localPaths.length}) ${urlPath} ... `);
    try {
      migrationMap[urlPath] = await uploadOne({ urlPath, cloudName, apiKey, apiSecret });
      console.log('ok');
    } catch (err) {
      console.log('FAILED');
      console.error(err.message);
      fs.writeFileSync(MIGRATION_MAP_PATH, JSON.stringify(migrationMap, null, 2));
      console.error(`Progress saved to ${MIGRATION_MAP_PATH} — re-run to resume from here.`);
      process.exitCode = 1;
      return;
    }
    done++;
    fs.writeFileSync(MIGRATION_MAP_PATH, JSON.stringify(migrationMap, null, 2)); // save after every file, not just at the end
  }
  console.log(`\nDone. ${done}/${localPaths.length} images now mapped in ${MIGRATION_MAP_PATH}.`);
  console.log('Next: node scripts/rewrite-generated-manifests.mjs --apply');
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
