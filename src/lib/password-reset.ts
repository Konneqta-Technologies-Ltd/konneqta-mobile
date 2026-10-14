import Joi from 'joi';

/**
 * Mobile client for the konneqta web app's password-reset API
 * (same endpoints + ZeptoMail emails as the desktop):
 *
 *   POST /api/auth/request-reset    { email }            → { ok: true }
 *   POST /api/auth/verify-reset     { email, otp }       → sets kq_reset_session cookie
 *   POST /api/auth/update-password  { password, ... }    → reads the cookie
 *
 * React Native exposes Set-Cookie on the response (unlike browsers), so the
 * reset session cookie is captured after verification and replayed manually
 * on the update call — the httpOnly cookie never needs to be "managed".
 */

const SITE_URL = 'https://www.konneqta.com';
const RESET_COOKIE_NAME = 'kq_reset_session';
const SESSION_TTL_MS = 10 * 60 * 1000; // matches SESSION_TTL_MINUTES server-side

export const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .required()
  .messages({
    'string.empty': 'Email is required',
    'string.email': 'Please enter a valid email address',
  });

export const resetPasswordSchema = Joi.object({
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 6 characters',
    }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'string.empty': 'Please confirm your password',
      'any.only': 'Passwords do not match',
    }),
});

let resetSessionCookie: string | null = null;
let resetSessionExpiresAt = 0;

async function postJson(path: string, body: Record<string, unknown>, extraHeaders?: Record<string, string>) {
  const res = await fetch(`${SITE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; verified?: boolean; error?: string };
  return { res, data };
}

/** Step 1 — email a 6-digit code. Always succeeds for real emails (anti-enumeration). */
export async function requestReset(email: string): Promise<void> {
  const { res, data } = await postJson('/api/auth/request-reset', { email });
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || 'We could not send the reset code. Please try again.');
  }
}

/** Step 2 — verify the 6-digit code; stores the reset session for step 3. */
export async function verifyReset(email: string, otp: string): Promise<void> {
  const { res, data } = await postJson('/api/auth/verify-reset', { email, otp });
  if (!res.ok) {
    throw new Error(data.error || 'Verification failed. Please try again.');
  }

  const setCookie = res.headers.get('set-cookie');
  const match = setCookie?.match(new RegExp(`${RESET_COOKIE_NAME}=([^;]+)`));
  if (!match) {
    throw new Error('Verified, but the reset session could not be established. Please try again.');
  }

  resetSessionCookie = match[1];
  resetSessionExpiresAt = Date.now() + SESSION_TTL_MS;
}

/** Step 3 — set the new password using the verified reset session. */
export async function updatePassword(password: string, confirmPassword: string): Promise<void> {
  if (!resetSessionCookie || Date.now() > resetSessionExpiresAt) {
    resetSessionCookie = null;
    throw new Error('Your reset session has expired. Please request a new code.');
  }

  const { res, data } = await postJson(
    '/api/auth/update-password',
    { password, confirmPassword },
    { Cookie: `${RESET_COOKIE_NAME}=${resetSessionCookie}` },
  );

  if (!res.ok) {
    throw new Error(data.error || 'Could not update password. Please try again.');
  }

  resetSessionCookie = null;
}
