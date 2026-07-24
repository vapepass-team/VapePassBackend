/**
 * Resolves public API / asset URLs for the current environment.
 *
 * Local uploads are stored as root-relative paths (`/uploads/...`) so one
 * database row works in every environment. Loopback absolute URLs left by
 * older builds are normalized back to relative paths on read.
 *
 * Embed script URLs must never expose localhost to production customers, so
 * getPublicApiBase prefers API_PUBLIC_URL when it is a real public host, and
 * otherwise falls back to the origin of the incoming API request.
 */

import { env } from '../config/env.js';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function isLoopbackUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  try {
    const url = new URL(raw.includes('://') ? raw : `http://${raw}`);
    return LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return /localhost|127\.0\.0\.1/i.test(raw);
  }
}

/**
 * Public origin of the API from the incoming request (Railway / reverse proxy).
 * Returns null for loopback hosts so we never "fix" a misconfig with another.
 */
export function getRequestPublicOrigin(req) {
  if (!req) return null;

  const forwardedHost = String(
    req.get?.('x-forwarded-host') || req.headers?.['x-forwarded-host'] || ''
  )
    .split(',')[0]
    .trim();
  const host = (
    forwardedHost || String(req.get?.('host') || req.headers?.host || '')
  )
    .split(',')[0]
    .trim();

  if (!host) return null;

  const hostname = host.replace(/:\d+$/, '').toLowerCase();
  if (LOOPBACK_HOSTS.has(hostname)) return null;

  const forwardedProto = String(
    req.get?.('x-forwarded-proto') || req.headers?.['x-forwarded-proto'] || ''
  )
    .split(',')[0]
    .trim()
    .toLowerCase();
  const proto = forwardedProto || (req.secure ? 'https' : 'http');

  return `${proto}://${host}`.replace(/\/+$/, '');
}

/**
 * Absolute public base for the API (no trailing slash).
 * @param {{ requestOrigin?: string|null }} [options]
 */
export function getPublicApiBase(options = {}) {
  const configured = String(env.apiPublicUrl || '').trim().replace(/\/+$/, '');
  const requestOrigin = String(options.requestOrigin || '').trim().replace(/\/+$/, '');

  // Explicit production/staging URL wins when it is not a loopback address
  if (configured && !isLoopbackUrl(configured) && !configured.includes('localhost:3000')) {
    return configured;
  }

  // Misconfigured production (API_PUBLIC_URL left as localhost) — use the host
  // the client actually reached so embed scripts stay customer-ready
  if (requestOrigin && !isLoopbackUrl(requestOrigin)) {
    return requestOrigin;
  }

  if (configured) {
    // CLIENT_URL was historically used as a fallback and points at the frontend
    if (configured.includes('localhost:3000')) {
      return `http://localhost:${env.port}`;
    }
    return configured;
  }

  return `http://localhost:${env.port}`;
}

/**
 * Portable asset reference for JSON responses.
 * - Local uploads → root-relative `/uploads/...` (never localhost)
 * - Cloudinary / CDN → absolute HTTPS left unchanged
 */
export function toPortableAssetUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (raw.startsWith('/')) return raw;

  if (!/^https?:\/\//i.test(raw)) return raw;

  try {
    const url = new URL(raw);
    if (LOOPBACK_HOSTS.has(url.hostname.toLowerCase()) && url.pathname.startsWith('/uploads/')) {
      return url.pathname;
    }
  } catch {
    return raw;
  }

  return raw;
}

/** Absolute URL for a stored asset (emails, server-side rendering, etc.) */
export function resolveAssetUrl(value, options = {}) {
  const portable = toPortableAssetUrl(value);
  if (!portable) return null;

  if (portable.startsWith('/')) {
    return `${getPublicApiBase(options)}${portable}`;
  }

  return portable;
}

/** Applies portable logo normalization to a plain (lean) store object */
export function withResolvedStoreAssets(store) {
  if (!store) return store;
  if (!store.logo) return store;
  return { ...store, logo: toPortableAssetUrl(store.logo) };
}
