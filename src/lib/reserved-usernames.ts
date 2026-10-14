/**
 * Usernames that can never be claimed.
 *
 * Mirrors the reserved list in the konneqta web app (lib/reserved-usernames.ts):
 * the DB trigger list PLUS the Next.js route segments sharing the /<name>
 * namespace. KEEP IN SYNC with the web app.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'edit',
  'api',
  'auth',
  'onboarding',
  'post-login',
  'admin',
  'konneqta',
  'vcard',
  'signature',
  'share',
  'settings',
  'offline',
  'manifest',
  'sw',
  'banners',
  'icons',
  'favicon.ico',
  '_next',
  'login',
  'signup',
  'forgot-password',
  'terms',
  'privacy',
  'refund',
  'contact',
  'waitlist',
  'payment',
  'konneqts',
  'home',
  'reset-password',
  'verify-reset',
  'callback',
  'serwist',
  'referral',
]);

/** True when the username is reserved and must not be claimed. */
export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username);
}
