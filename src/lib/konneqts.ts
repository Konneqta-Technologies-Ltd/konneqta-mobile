import { supabase } from '@/lib/supabase';

/**
 * Mobile client for the konneqta web app's Konneqt exchange API
 * (POST /api/konneqts, GET /api/konneqts/status). The routes authenticate
 * with the caller's Supabase access token (Authorization: Bearer).
 */

const SITE_URL = 'https://www.konneqta.com';

export type ConnectStatus = 'idle' | 'requested' | 'konneqted';

async function authedFetch(path: string, init?: RequestInit) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const res = await fetch(`${SITE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    connected?: boolean;
    requested?: boolean;
    status?: string;
    error?: string;
  };

  return { res, data };
}

/** Cosmetic pre-check so the Connect button shows the right state. */
export async function getConnectionStatus(targetUsername: string): Promise<ConnectStatus> {
  try {
    const { res, data } = await authedFetch(
      `/api/konneqts/status?targetUsername=${encodeURIComponent(targetUsername)}`
    );
    if (!res.ok) return 'idle';
    if (data.connected === true) return 'konneqted';
    if (data.requested === true) return 'requested';
  } catch {
    // Pre-check only — the API corrects on connect.
  }
  return 'idle';
}

export type SendKonneqtResult =
  | { status: 'konneqted'; message: string }
  | { status: 'requested'; message: string };

/**
 * Send a Konneqt exchange request (consent flow — the other person accepts
 * or rejects; mutual intent auto-accepts server-side).
 */
export async function sendKonneqt(
  targetUsername: string,
  source: string
): Promise<SendKonneqtResult> {
  const { res, data } = await authedFetch('/api/konneqts', {
    method: 'POST',
    body: JSON.stringify({ targetUsername, source }),
  });

  if (!res.ok) {
    throw new Error(data.error || 'Could not connect. Please try again.');
  }

  if (data.status === 'konneqted') {
    return { status: 'konneqted', message: "You're now Konneqted." };
  }
  if (data.status === 'request_pending') {
    return {
      status: 'requested',
      message: 'You already have a pending request with this person.',
    };
  }
  return {
    status: 'requested',
    message: "Request sent — we'll let you know when they accept.",
  };
}
