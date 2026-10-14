import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import QRCode from 'react-native-qrcode-svg';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useSharedValue, useAnimatedStyle, interpolate, withTiming } from 'react-native-reanimated';

import { DarkModeToggle } from '@/components/dark-mode-toggle';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { signOutEverywhere } from '@/lib/auth';
import { readCardSnapshot, saveCardSnapshot } from '@/lib/card-cache';
import { supabase } from '@/lib/supabase';
import { useIsOnline } from '@/hooks/use-net-info';
import { OfflineBanner } from '@/components/offline-banner';

type Profile = {
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

type SocialLink = { platform: string; url: string; label?: string | null };

/** Same safe-href rules as the web card (lib/url-validation). */
function safeHref(url: string, isEmail: boolean): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (isEmail) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? `mailto:${trimmed}` : null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

export default function MyCardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const isOnline = useIsOnline();

  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);

  const [flipped, setFlipped] = useState(false);
  const progress = useSharedValue(0);

  const [copied, setCopied] = useState(false);
  const [refreshingQr, setRefreshingQr] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Load the owner's card: cache-first (instant, works offline), then
  // refresh from the network and write the snapshot back.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 0. Instant offline render from the snapshot.
      const snapshot = await readCardSnapshot();
      if (cancelled) return;
      if (snapshot) {
        setProfile(snapshot.profile);
        setSocialLinks(snapshot.socialLinks);
        setLoading(false);
      }

      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        router.replace('/login');
        return;
      }

      // 1. Fresh from the network.
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('username, full_name, job_title, company, phone, bio, avatar_url, logo_url, qr_code_url')
        .eq('id', data.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileError) {
        // Offline (or server hiccup): keep showing the snapshot; without one,
        // offer a retry instead of bouncing to onboarding.
        setLoading(false);
        setIsOffline(true);
        if (!snapshot) {
          setLoadError('You appear to be offline. Reconnect to load your card.');
        }
        return;
      }

      setIsOffline(false);

      if (!profileRow) {
        // Interrupted setup — send them through the wizard.
        router.replace('/onboarding');
        return;
      }

      const [{ data: links }, { data: card }] = await Promise.all([
        supabase.from('social_links').select('platform, url, label').eq('profile_id', data.user.id),
        supabase.from('cards').select('id').eq('owner_id', data.user.id).eq('is_primary', true).maybeSingle(),
      ]);

      if (cancelled) return;
      setProfile(profileRow as Profile);
      setSocialLinks((links as SocialLink[]) ?? []);
      setCardId(card?.id ?? null);
      setLoading(false);

      // 2. Write-through the offline snapshot.
      await saveCardSnapshot(profileRow as Profile, (links as SocialLink[]) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [router, reloadKey]);

  // Flip — two-phase edge rotation is the reliable cross-platform pattern:
  // animate to the 90deg edge, swap faces, continue to the resting angle.
  const flip = () => {
    const next = !flipped;
    setFlipped(next);
    progress.value = withTiming(next ? 1 : 0, {
      duration: 600,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  };

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(progress.value, [0, 1], [0, 180])}deg` },
    ],
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(progress.value, [0, 1], [180, 360])}deg` },
    ],
  }));

  if (loading || !profile) {
    return (
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.orange} />
        </View>
      </SafeAreaView>
    );
  }

  const displayName = profile.full_name || profile.username;
  const profileUrl = `https://www.konneqta.com/${profile.username}`;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out ${displayName}'s digital card on Konneqta: ${profileUrl}` });
    } catch {
      // User dismissed the share sheet.
    }
  };

  const handleRefreshQr = async () => {
    if (refreshingQr) return;
    setRefreshingQr(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken || !cardId) {
        Alert.alert('Refresh QR', 'Could not refresh the QR code right now.');
        return;
      }
      // Server-side regeneration (same route the onboarding wizard uses).
      const res = await fetch('https://www.konneqta.com/api/onboarding/generate-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ username: profile.username, cardId }),
      });
      if (res.ok) {
        Alert.alert('QR refreshed', 'Your card QR code has been regenerated.');
      } else {
        Alert.alert('Refresh QR', "Couldn't refresh the QR code. Please try again.");
      }
    } finally {
      setRefreshingQr(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await signOutEverywhere();
    router.replace('/login');
  };

  const handleOpenLink = (link: SocialLink) => {
    const href = safeHref(link.url, link.platform === 'email');
    if (href) Linking.openURL(href);
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <DarkModeToggle />
      <OfflineBanner visible={!isOnline || isOffline} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="title" style={styles.pageTitle}>
          My Card
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.pageSubtitle}>
          Tap the card to flip it
        </ThemedText>

        {loadError && (
          <Pressable onPress={() => { setLoadError(null); setLoading(true); setReloadKey((k) => k + 1); }} style={[styles.errorBanner, { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder }]}>
            <ThemedText type="small" themeColor="danger">{loadError}</ThemedText>
            <ThemedText type="small" themeColor="orange">Tap to retry</ThemedText>
          </Pressable>
        )}

        {/* ---- Flip card ---- */}
        <View style={styles.cardStage}>
          {/* FRONT */}
          <Animated.View style={[styles.cardFace, styles.cardFront, frontStyle]}>
            <Pressable style={styles.avatarBlock} onPress={flip}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.surface }]}>
                  <ThemedText style={styles.avatarInitial}>
                    {displayName.charAt(0).toUpperCase()}
                  </ThemedText>
                </View>
              )}
              <View style={styles.purplePanel} />
            </Pressable>

            <View style={[styles.infoPanel, { backgroundColor: '#F8F7F5' }]}>
              <ThemedText style={[styles.cardName, { color: '#18181b' }]}>{displayName}</ThemedText>
              <View style={styles.cardMetaRow}>
                {profile.job_title ? (
                  <Text style={styles.cardMeta}>{profile.job_title}</Text>
                ) : null}
                {profile.job_title && profile.company ? (
                  <View style={styles.metaDot} />
                ) : null}
                {profile.company ? (
                  <Text style={styles.cardMeta}>{profile.company}</Text>
                ) : null}
                {profile.logo_url ? (
                  <Image source={{ uri: profile.logo_url }} style={styles.cardLogo} contentFit="contain" />
                ) : null}
              </View>
              {profile.phone ? <Text style={styles.cardMeta}>{profile.phone}</Text> : null}
            </View>

            {profile.bio ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.cardBio}>
                {profile.bio}
              </ThemedText>
            ) : null}

            <Pressable onPress={flip} style={({ pressed }) => [styles.flipButton, { backgroundColor: theme.orange, opacity: pressed ? 0.9 : 1 }]}>
              <ThemedText style={styles.flipButtonText}>Flip card</ThemedText>
            </Pressable>
          </Animated.View>

          {/* BACK — always dark, like the web card */}
          <Animated.View style={[styles.cardFace, styles.cardBack, backStyle]}>
            <ScrollView style={styles.backScroll} contentContainerStyle={styles.backContent} showsVerticalScrollIndicator={false}>
              {socialLinks.length === 0 ? (
                <ThemedText type="small" style={styles.noLinks}>
                  No links added yet.
                </ThemedText>
              ) : (
                <View style={styles.linksGrid}>
                  {socialLinks.map((link, index) => {
                    const href = safeHref(link.url, link.platform === 'email');
                    if (!href) return null;
                    const caption =
                      (link.platform === 'other' && link.label?.trim()) ||
                      link.platform.charAt(0).toUpperCase() + link.platform.slice(1);
                    return (
                      <Pressable key={index} style={styles.linkTile} onPress={() => handleOpenLink(link)}>
                        <View style={styles.linkTileIcon}>
                          <Text style={styles.linkTileInitial}>{caption.charAt(0).toUpperCase()}</Text>
                        </View>
                        <Text style={styles.linkTileLabel} numberOfLines={1}>
                          {caption}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <View style={styles.qrWrap}>
                <View style={styles.qrBox}>
                  <QRCode value={profileUrl} size={150} color="#18181b" backgroundColor="#ffffff" />
                </View>
                <Text style={styles.qrCaption}>Scan to connect</Text>
              </View>

              <Pressable onPress={flip} style={styles.flipBackButton}>
                <Text style={styles.flipBackText}>Flip to front</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </View>

        {/* ---- Actions ---- */}
        <View style={styles.actionsWrap}>
          <View style={styles.actionRow}>
            <Pressable
              onPress={handleCopy}
              style={({ pressed }) => [styles.copyButton, { backgroundColor: theme.orange, opacity: pressed ? 0.9 : 1 }]}>
              <ThemedText style={styles.copyButtonText}>
                {copied ? '✓ Copied!' : `www.konneqta.com/@${profile.username}`}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [styles.shareButton, { borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}>
              <ThemedText type="small" style={{ color: theme.text }}>Share</ThemedText>
            </Pressable>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => router.push('/scan')}
              style={({ pressed }) => [
                styles.smallAction,
                { borderColor: theme.border, backgroundColor: theme.orange, opacity: pressed ? 0.9 : 1 },
              ]}>
              <ThemedText type="small" style={styles.copyButtonText}>Scan</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleRefreshQr}
              disabled={refreshingQr}
              style={({ pressed }) => [
                styles.smallAction,
                { borderColor: theme.border, opacity: refreshingQr ? 0.6 : pressed ? 0.8 : 1 },
              ]}>
              {refreshingQr ? (
                <ActivityIndicator size="small" color={theme.textSecondary} />
              ) : (
                <ThemedText type="small" style={{ color: theme.text }}>Refresh QR</ThemedText>
              )}
            </Pressable>
            <Pressable
              disabled
              style={[styles.smallAction, styles.disabledAction, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">Edit · soon</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleLogout}
              disabled={loggingOut}
              style={({ pressed }) => [
                styles.smallAction,
                { borderColor: theme.danger, opacity: loggingOut ? 0.6 : pressed ? 0.8 : 1 },
              ]}>
              {loggingOut ? (
                <ActivityIndicator size="small" color={theme.danger} />
              ) : (
                <ThemedText type="small" themeColor="danger">Log out</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: Spacing.three + Spacing.two,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 26,
    lineHeight: 32,
    textAlign: 'center',
  },
  pageSubtitle: {
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
  errorBanner: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    marginBottom: Spacing.three,
  },
  cardStage: {
    width: '100%',
    height: 480,
  },
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    borderRadius: 24,
    backfaceVisibility: 'hidden',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardFront: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingTop: Spacing.four,
    zIndex: 1,
  },
  cardBack: {
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#09090b',
    padding: Spacing.three,
    zIndex: 2,
  },
  avatarBlock: {
    width: 200,
    height: 160,
    position: 'relative',
    overflow: 'hidden',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: Fonts.bold,
    fontSize: 56,
    color: '#6A56A4',
  },
  purplePanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    height: '100%',
    width: 44,
    backgroundColor: '#6A56A4',
    opacity: 0.7,
  },
  infoPanel: {
    width: 200,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  cardName: {
    fontFamily: Fonts.medium,
    fontSize: 17,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  cardMeta: {
    fontSize: 13,
    color: '#737373',
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#a1a1aa',
  },
  cardLogo: {
    width: 14,
    height: 14,
  },
  cardBio: {
    textAlign: 'center',
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  flipButton: {
    marginTop: 'auto',
    marginBottom: Spacing.four,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.four,
    paddingVertical: 10,
  },
  flipButtonText: {
    color: '#ffffff',
    fontFamily: Fonts.semibold,
    fontSize: 13,
  },
  backScroll: {
    flex: 1,
  },
  backContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  noLinks: {
    color: '#a1a1aa',
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  linksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.three,
    width: '100%',
  },
  linkTile: {
    width: 58,
    alignItems: 'center',
    gap: 4,
  },
  linkTileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTileInitial: {
    color: '#f4f4f5',
    fontFamily: Fonts.medium,
    fontSize: 15,
  },
  linkTileLabel: {
    color: '#a1a1aa',
    fontSize: 10,
    maxWidth: 58,
  },
  qrWrap: {
    alignItems: 'center',
  },
  qrBox: {
    width: 160,
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCaption: {
    color: '#a1a1aa',
    fontSize: 10,
    marginTop: 4,
  },
  flipBackButton: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.four,
    paddingVertical: 10,
    backgroundColor: '#FF6B2C',
  },
  flipBackText: {
    color: '#ffffff',
    fontFamily: Fonts.semibold,
    fontSize: 13,
  },
  actionsWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  copyButton: {
    flexGrow: 1,
    height: 46,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  copyButtonText: {
    color: '#ffffff',
    fontFamily: Fonts.semibold,
    fontSize: 14,
  },
  shareButton: {
    height: 46,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAction: {
    height: 42,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledAction: {
    opacity: 0.5,
  },
});
