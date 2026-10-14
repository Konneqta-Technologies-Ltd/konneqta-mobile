/**
 * Expo config (dynamic) — replaces app.json so the native Google sign-in
 * identifiers can come from .env.local instead of being hardcoded.
 *
 * Required env vars for Google sign-in (see .env.example):
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID   – Web OAuth client (used at runtime)
 *   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID   – iOS OAuth client (optional, better iOS UX)
 *   EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME  – reversed iOS client id, embedded natively:
 *                                        com.googleusercontent.apps.<client-id-without-domain>
 */

const googleIosUrlScheme =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ||
  'com.googleusercontent.apps.REPLACE_WITH_IOS_URL_SCHEME';

if (!process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME) {
  // Visible during `npx expo prebuild` / `expo start` — iOS Google sign-in
  // will not work until the real URL scheme is set in .env.local.
  console.warn(
    '\u26A0  EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME is not set — using a placeholder. '
      + 'iOS Google sign-in will not work until you add the real value to .env.local.'
  );
}

module.exports = {
  expo: {
    name: 'Konneqta',
    slug: 'konneqta-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'konneqta',
    userInterfaceStyle: 'automatic',
    ios: {
      bundleIdentifier: 'com.konneqta.mobile',
      icon: './assets/expo.icon',
    },
    android: {
      package: 'com.konneqta.mobile',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#000000',
          image: './assets/images/wordmark-white.png',
          imageWidth: 220,
        },
      ],
      [
        '@react-native-google-signin/google-signin',
        {
          iosUrlScheme: googleIosUrlScheme,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};
