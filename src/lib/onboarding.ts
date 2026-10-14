import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { isReservedUsername } from '@/lib/reserved-usernames';
import { supabase } from '@/lib/supabase';

/**
 * Mobile onboarding — mirrors the data written by the web app's
 * components/OnboardingForm.tsx: profiles.upsert → cards.insert (primary)
 * → profiles.active_card_id → social_links.insert → QR generation.
 */

export const BIO_MAX_CHARS = 1500; // CardBio's hard cap on the web
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

const SITE_URL = 'https://www.konneqta.com';

/** Free-tier social link cap (PLAN_LIMITS.free.maxSocialLinks on the web). */
export const MAX_SOCIAL_LINKS = 3;

export type SocialLink = { platform: string; url: string; label?: string };

/** Same platform catalogue as the web (labels only — icons are web-only). */
export const SOCIAL_PLATFORMS: { id: string; label: string; placeholder: string }[] = [
  { id: 'website', label: 'My Website', placeholder: 'https://your-site.com' },
  { id: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/you' },
  { id: 'github', label: 'GitHub', placeholder: 'https://github.com/you' },
  { id: 'twitter', label: 'X (Twitter)', placeholder: 'https://x.com/you' },
  { id: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/you' },
  { id: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@you' },
  { id: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@you' },
  { id: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/you' },
  { id: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/2348012345678' },
  { id: 'telegram', label: 'Telegram', placeholder: 'https://t.me/you' },
  { id: 'snapchat', label: 'Snapchat', placeholder: 'https://snapchat.com/add/you' },
  { id: 'reddit', label: 'Reddit', placeholder: 'https://reddit.com/u/you' },
  { id: 'calendly', label: 'Calendly', placeholder: 'https://calendly.com/you' },
  { id: 'email', label: 'Email', placeholder: 'you@email.com' },
  { id: 'other', label: 'Custom Link', placeholder: 'https://...' },
];

/** Username rules from the web: 3-20 chars, a-z 0-9 _, no trailing underscore. */
export const USERNAME_PATTERN = /^(?!.*[_]$)[a-z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, USERNAME_MAX);
}

/** Returns an error message, or null when the username is locally valid. */
export function validateUsername(username: string): string | null {
  if (username.length < USERNAME_MIN) return 'Username must be at least 3 characters';
  if (username.endsWith('_')) return "Username can't end with an underscore";
  if (!USERNAME_PATTERN.test(username)) {
    return 'Use only lowercase letters, numbers, and underscores';
  }
  if (isReservedUsername(username)) return 'This username is reserved';
  return null;
}

/** Async availability check against the profiles table. */
export async function isUsernameTaken(username: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  return Boolean(data);
}

/** Same safe-URL/e-mail guards as the web submit handler. */
function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafeEmailValue(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export type OnboardingInput = {
  userId: string;
  email: string;
  username: string;
  fullName: string;
  jobTitle: string;
  company: string;
  bio: string;
  phone: string;
  showPhone: boolean;
  avatarUri: string | null;
  socialLinks: SocialLink[];
  onStage?: (stage: string) => void;
};

export type OnboardingResult =
  | { ok: true; username: string }
  | { ok: false; message: string };

/**
 * Runs the exact write sequence the web onboarding performs:
 * avatar upload → profiles upsert → primary card insert → active_card_id
 * → social links → QR generation (fire-and-forget, desktop API).
 */
export async function submitOnboarding(input: OnboardingInput): Promise<OnboardingResult> {
  const { onStage = () => {} } = input;

  try {
    // 1. Avatar — resize to <=512px JPEG before upload (matches the web's
    //    compressImage AVATAR_OPTIONS).
    let avatarUrl = '';
    if (input.avatarUri) {
      onStage('Uploading photo...');
      const manipulated = await manipulateAsync(
        input.avatarUri,
        [{ resize: { width: 512 } }],
        { compress: 0.92, format: SaveFormat.JPEG }
      );
      const response = await fetch(manipulated.uri);
      const arrayBuffer = await response.arrayBuffer();

      const filePath = `${input.userId}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) {
        return { ok: false, message: uploadError.message };
      }

      avatarUrl = supabase.storage.from('avatars').getPublicUrl(filePath).data.publicUrl;
    }

    // 2. Create or repair the profile row (same guard: show_phone forced off
    //    when phone is empty; terms_accepted_at is the consent audit trail).
    onStage('Creating profile...');
    const phoneIsEmpty = !input.phone.trim();
    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        username: input.username,
        full_name: input.fullName,
        email: input.email,
        job_title: input.jobTitle,
        company: input.company,
        phone: input.phone,
        bio: input.bio,
        show_phone: phoneIsEmpty ? false : input.showPhone,
        avatar_url: avatarUrl,
        logo_url: '',
        terms_accepted_at: new Date().toISOString(),
        id: input.userId,
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      const msg = profileError.message.toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique constraint')) {
        return { ok: false, message: 'This username is already taken. Please choose another.' };
      }
      if (msg.includes('violates constraint') || msg.includes('character')) {
        return {
          ok: false,
          message: 'Username contains invalid characters. Please use only lowercase letters, numbers, and underscores.',
        };
      }
      return { ok: false, message: profileError.message };
    }

    // 3. Create the PRIMARY card (cards table = public-facing data).
    onStage('Creating your card...');
    const { data: cardRow, error: cardError } = await supabase
      .from('cards')
      .insert({
        owner_id: input.userId,
        slug: input.username,
        label: 'Primary',
        full_name: input.fullName,
        job_title: input.jobTitle,
        company: input.company,
        bio: input.bio,
        avatar_url: avatarUrl,
        logo_url: '',
        phone: input.phone,
        show_phone: phoneIsEmpty ? false : input.showPhone,
        is_primary: true,
        sort_order: 0,
      })
      .select('id')
      .single();

    if (cardError) {
      // Rollback best-effort: remove the profile-less card situation by
      // deleting our own profile row (RLS permitting) so a retry starts clean.
      await supabase.from('profiles').delete().eq('id', input.userId);
      return { ok: false, message: cardError.message };
    }

    const cardId = cardRow.id;

    // 3b. Point active_card_id at the new card (non-fatal on failure).
    await supabase.from('profiles').update({ active_card_id: cardId }).eq('id', input.userId);

    // 4. Insert social links (safe URLs only, same filter as the web).
    const linksToInsert = input.socialLinks
      .filter((link) => {
        const trimmed = link.url.trim();
        if (!trimmed) return false;
        return link.platform === 'email' ? isSafeEmailValue(trimmed) : isSafeHttpUrl(trimmed);
      })
      .map((link) => ({
        card_id: cardId,
        profile_id: input.userId,
        platform: link.platform,
        url: link.url.trim(),
        label: link.platform === 'other' && link.label?.trim() ? link.label.trim() : null,
      }));

    if (linksToInsert.length > 0) {
      const { error: linksError } = await supabase.from('social_links').insert(linksToInsert);
      if (linksError) {
        // Non-fatal — links can be added later.
        console.error('social_links insert error:', linksError);
      }
    }

    // 5. QR generation — delegated to the web app's server route (the qrcode
    //    lib generates PNGs server-side; native cannot). Fire-and-forget: the
    //    web tolerates a missing QR and can regenerate it any time.
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken) {
        await fetch(`${SITE_URL}/api/onboarding/generate-qr`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ username: input.username, cardId }),
        });
      }
    } catch {
      // Non-fatal — regenerate later from the profile.
    }

    return { ok: true, username: input.username };
  } catch {
    return { ok: false, message: 'Something went wrong. Please try again.' };
  }
}
