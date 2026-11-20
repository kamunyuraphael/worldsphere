#!/usr/bin/env node
/**
 * Second half of the tourism-image migration: replaces every local
 * `/images/...` path in the generated manifests with the Cloudinary URL
 * recorded by `import-tourism-images.mjs`, leaving everything else in each
 * file (structure, keys, comments) untouched.
 *
 * Usage:
 *   node scripts/rewrite-generated-manifests.mjs           # dry run — reports what would change
 *   node scripts/rewrite-generated-manifests.mjs --apply   # writes the files
 *
 * Run import-tourism-images.mjs --apply first — this script refuses to run
 * against a manifest that references any local path missing from the
 * migration map, so you can't end up with a file that's half-local,
 * half-Cloudinary without noticing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractLocalImagePaths } from './lib/local-image-manifest.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const APPLY = process.argv.includes('--apply');
const MANIFEST_FILES = ['src/data/tourismImages.generated.ts', 'src/data/nairobiAttractionImages.generated.ts'];
const MIGRATION_MAP_PATH = path.join(ROOT, 'scripts', '.tourism-image-migration-map.json');

function main() {
  if (!fs.existsSync(MIGRATION_MAP_PATH)) {
    throw new Error(`${MIGRATION_MAP_PATH} not found — run import-tourism-images.mjs --apply first.`);
  }
  const migrationMap = JSON.parse(fs.readFileSync(MIGRATION_MAP_PATH, 'utf8'));

  for (const relFile of MANIFEST_FILES) {
    const filePath = path.join(ROOT, relFile);
    const original = fs.readFileSync(filePath, 'utf8');
    const localPaths = extractLocalImagePaths(original);
    const unmapped = localPaths.filter((p) => !migrationMap[p]);

    if (unmapped.length) {
      console.error(`${relFile}: ${unmapped.length} path(s) have no Cloudinary URL yet — refusing to rewrite this file.`);
      unmapped.slice(0, 5).forEach((p) => console.error('  ', p));
      process.exitCode = 1;
      continue;
    }

    let rewritten = original;
    for (const localPath of localPaths) {
      // Every occurrence is a quoted string literal ("...") — replace the exact quoted form.
      rewritten = rewritten.split(`"${localPath}"`).join(`"${migrationMap[localPath]}"`);
    }

    if (!APPLY) {
      console.log(`${relFile}: would replace ${localPaths.length} local path(s) with Cloudinary URLs. (dry run)`);
      continue;
    }
    fs.writeFileSync(filePath, rewritten);
    console.log(`${relFile}: rewrote ${localPaths.length} path(s).`);
  }

  if (!APPLY) console.log('\nDry run only — pass --apply to write the files.');
}

main();
