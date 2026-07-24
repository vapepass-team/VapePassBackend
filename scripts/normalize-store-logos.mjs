/**
 * One-off migration: convert absolute store logo URLs into root-relative paths.
 *
 * Logos uploaded before this change baked in whichever API_PUBLIC_URL was
 * active at upload time (often http://localhost:5000), which no other machine
 * can load. Relative paths are resolved per environment on read instead.
 *
 * Usage: node scripts/normalize-store-logos.mjs [--apply]
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import Store from '../src/models/Store.js';

const apply = process.argv.includes('--apply');

await mongoose.connect(env.mongoUri);

const stores = await Store.find({ logo: { $ne: null } })
  .select('name logo')
  .lean();

const changes = [];

for (const store of stores) {
  const raw = String(store.logo || '').trim();
  if (!raw || raw.startsWith('/') || !/^https?:\/\//i.test(raw)) continue;

  let url;
  try {
    url = new URL(raw);
  } catch {
    continue;
  }

  // Cloudinary (or any real CDN) URLs are already portable
  if (!url.pathname.startsWith('/uploads/')) continue;

  changes.push({ id: store._id, name: store.name, from: raw, to: url.pathname });
}

if (!changes.length) {
  console.log('No absolute upload URLs found — nothing to migrate.');
} else {
  for (const change of changes) {
    console.log(`${change.name}\n  ${change.from}\n  → ${change.to}`);
  }

  if (apply) {
    for (const change of changes) {
      await Store.updateOne({ _id: change.id }, { $set: { logo: change.to } });
    }
    console.log(`\nUpdated ${changes.length} store(s).`);
  } else {
    console.log(`\n${changes.length} store(s) would change. Re-run with --apply to write.`);
  }
}

await mongoose.disconnect();
