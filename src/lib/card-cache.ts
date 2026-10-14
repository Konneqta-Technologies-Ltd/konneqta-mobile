import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Offline card snapshot — the owner's card data persisted on-device so My Card
 * renders with ZERO network (better than the web's localStorage + service
 * worker approach: the binary is always installed, and the session persists).
 *
 * Same shape/semantics as the web's lib/offline/card-snapshot.ts. Privacy:
 * lives only on the owner's device and is cleared on logout.
 */

const CARD_SNAPSHOT_KEY = 'kq_offline_card_v1';

export type CachedCardProfile = {
  username: string;
  full_name: string | null;
  job_title: string | null;
  company: string | null;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  logo_url: string | null;
  qr_code_url: string | null;
};

export type CachedSocialLink = { platform: string; url: string; label?: string | null };

export type CardSnapshot = {
  version: 1;
  savedAt: string;
  profile: CachedCardProfile;
  socialLinks: CachedSocialLink[];
};

/** Write-through cache — called after every successful My Card load/onboarding. */
export async function saveCardSnapshot(
  profile: CachedCardProfile,
  socialLinks: CachedSocialLink[]
): Promise<void> {
  try {
    const snapshot: CardSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      profile,
      socialLinks,
    };
    await AsyncStorage.setItem(CARD_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage can fail (quota, etc.) — never break the app over the cache.
  }
}

/** Instant offline read. Returns null when absent or malformed. */
export async function readCardSnapshot(): Promise<CardSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(CARD_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CardSnapshot;
    if (parsed?.version !== 1 || !parsed.profile?.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Privacy: cleared on logout, like the web app. */
export async function clearCardSnapshot(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CARD_SNAPSHOT_KEY);
  } catch {
    // Non-fatal.
  }
}
