import { supabase } from "@/lib/supabase";

import { Colors, Fonts } from "@/constants/theme";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
// import { ThemedText } from '@/components/themed-text';
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Splash — mirrors the web app's launch experience: black screen, centered
 * logo (see konneqta/app/launch and the PWA manifest background_color),
 * then a hand-off to the login screen.
 */

const SPLASH_DURATION_MS = 2200;

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const timer = setTimeout(async () => {
      // getSession() reads the persisted session from storage — safe offline.
      // Signed in → My Card (offline snapshot renders instantly); otherwise → login.
      const { data } = await supabase.auth.getSession();
      router.replace(data.session ? "/my-card" : "/login");
    }, SPLASH_DURATION_MS);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      {/* 
      <Animated.View entering={FadeInDown.duration(700)}>
        <Image
          source={require('@/assets/images/k-mark.png')}
          style={styles.mark}
          contentFit="contain"
        />
      </Animated.View> */}

      <Animated.View entering={FadeIn.delay(350).duration(700)}>
        <Image
          source={require("@/assets/images/wordmark-white.png")}
          style={styles.wordmark}
          contentFit="contain"
        />
      </Animated.View>
      {/* 
      <Animated.View entering={FadeIn.delay(700).duration(700)}>
        <ThemedText type="small" themeColor="orange" style={styles.tagline}>
          Connect Smarter.
        </ThemedText>
      </Animated.View> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.splashBackground,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  mark: {
    width: 64,
    height: 91, // 432:616 aspect of the generated mark
  },
  wordmark: {
    width: 230,
    height: 59, // 1160:296 aspect of the generated wordmark
  },
  tagline: {
    fontFamily: Fonts.semibold,
    letterSpacing: 1,
    textAlign: "center",
  },
});
