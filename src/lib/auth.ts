import { Platform } from 'react-native';

import { clearCardSnapshot } from '@/lib/card-cache';
import { supabase } from '@/lib/supabase';

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// The native module only exists in a development/production build. Importing
// it eagerly crashes the whole app in Expo Go (TurboModuleRegistry can't find
// 'RNGoogleSignin'), so it is loaded lazily on first use instead.
let googleSigninModule: GoogleSigninModule | null = null;
let moduleMissing = false;

async function getGoogleSignin(): Promise<GoogleSigninModule['GoogleSignin'] | null> {
  if (moduleMissing) return null;
  if (googleSigninModule) return googleSigninModule.GoogleSignin;

  try {
    googleSigninModule = await import('@react-native-google-signin/google-signin');
    return googleSigninModule.GoogleSignin;
  } catch {
    moduleMissing = true;
    return null;
  }
}

export type GoogleSignInResult =
  | { status: 'success' }
  | { status: 'canceled' }
  | { status: 'error'; message: string };

/**
 * Native Google sign-in: the device's Google account picker (no browser, no
 * deep links). The returned OIDC id token is exchanged with Supabase for a
 * full session via signInWithIdToken.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    if (Platform.OS === 'web') {
      // The native SDK does not apply on web — the web app keeps the classic
      // browser OAuth flow (components/SignInWithGoogle.tsx).
      return {
        status: 'error',
        message: 'Use konneqta.com to sign in with Google on the web for now.',
      };
    }

    if (!webClientId) {
      return {
        status: 'error',
        message: 'Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env.local and restart with `npx expo start -c`.',
      };
    }

    const GoogleSignin = await getGoogleSignin();
    if (!GoogleSignin) {
      return {
        status: 'error',
        message:
          'Google sign-in needs a development build — the native Google module is not available in Expo Go. Run `npx expo run:android` (Android Studio) or create an EAS development build, then open the installed app.',
      };
    }

    GoogleSignin.configure({
      webClientId,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      offlineAccess: false,
    });

    // Android: shows a helpful dialog if Google Play Services are missing.
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const result = await GoogleSignin.signIn();
    if (result.type !== 'success') {
      return { status: 'canceled' };
    }

    const idToken = result.data?.idToken;
    if (!idToken) {
      return {
        status: 'error',
        message: 'Google did not return an id token. Check EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env.local.',
      };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      return { status: 'error', message: error.message };
    }

    return { status: 'success' };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Google sign-in failed.',
    };
  }
}

/** Sign out of Supabase and revoke the Google account picker session. */
export async function signOutEverywhere(): Promise<void> {
  const GoogleSignin = await getGoogleSignin();
  if (GoogleSignin) {
    try {
      await GoogleSignin.signOut();
    } catch {
      // Not signed in with Google — nothing to revoke.
    }
  }
  await clearCardSnapshot();
  await supabase.auth.signOut();
}

/**
 * Where to send the user right after a successful sign-in:
 *  - no profile / no primary card → the onboarding wizard (card setup)
 *  - complete account             → the post-login placeholder
 */
export async function routeAfterSignIn(): Promise<'/onboarding' | '/my-card'> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return '/my-card';

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', data.user.id)
    .maybeSingle();
  if (!profile) return '/onboarding';

  const { data: card } = await supabase
    .from('cards')
    .select('id')
    .eq('owner_id', data.user.id)
    .eq('is_primary', true)
    .maybeSingle();

  return card ? '/my-card' : '/onboarding';
}
