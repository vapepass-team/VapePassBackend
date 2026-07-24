/**
 * Resolves stored asset references (store logos) into absolute URLs.
 *
 * Locally uploaded files are persisted as root-relative paths so a single
 * database row stays valid across environments. Legacy rows that baked in a
 * loopback host are healed on read, since those URLs are unreachable from any
 * machine other than the one that uploaded them.
 */

import { env } from '../config/env.js';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

export function getPublicApiBase() {
  const base = String(env.apiPublicUrl || `http://localhost:${env.port}`).replace(/\/+$/, '');
  // API_PUBLIC_URL falls back to CLIENT_URL, which points at the frontend port
  if (base.includes('localhost:3000')) {
    return `http://localhost:${env.port}`;
  }
  return base;
}

export function resolveAssetUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (raw.startsWith('/')) return `${getPublicApiBase()}${raw}`;
  if (!/^https?:\/\//i.test(raw)) return raw;

  try {
    const url = new URL(raw);
    if (LOOPBACK_HOSTS.has(url.hostname) && url.pathname.startsWith('/uploads/')) {
      return `${getPublicApiBase()}${url.pathname}`;
    }
  } catch {
    return raw;
  }

  return raw;
}

/** Applies logo resolution to a plain (lean) store object */
export function withResolvedStoreAssets(store) {
  if (!store) return store;
  if (!store.logo) return store;
  return { ...store, logo: resolveAssetUrl(store.logo) };
}
