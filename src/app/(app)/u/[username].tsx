import { Image } from 'expo-image';
import QRCode from 'react-native-qrcode-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DarkModeToggle } from '@/components/dark-mode-toggle';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getConnectionStatus, sendKonneqt } from '@/lib/konneqts';
import { saveToContacts } from '@/lib/contacts';
import { supabase } from '@/lib/supabase';

type PublicCard = {
  id: string;
  owner_id: string;
  full_name: string | null;
  job_title: string | null;
  company: string | null;
  bio: string | null;
  avatar_url: string | null;
  logo_url: string | null;
  phone: string | null;
  show_phone: boolean;
};

type PublicSocialLink = { platform: string; url: string; label?: string | null };

function safeHref(url: string, isEmail: boolean): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (isEmail) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? `mailto:${trimmed}` : null;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

export default function PublicCardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ username: string; source?: string }>();
  const username = typeof params.username === 'string' ? params.username : '';

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [card, setCard] = useState<PublicCard | null>(null);
  const [socialLinks, setSocialLinks] = useState<PublicSocialLink[]>([]);

  // Connect (Konneqt exchange) — signed-in users only in v1 (guest form later).
  const [connectPhase, setConnectPhase] = useState<
    'idle' | 'connecting' | 'requested' | 'konneqted'
  >('idle');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!username) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const me = sessionData.session?.user ?? null;

      // Fetch the card by slug (same lookup as the web vCard/profile routes).
      const { data: cardRow } = await supabase
        .from('cards')
        .select('id, owner_id, full_name, job_title, company, bio, avatar_url, logo_url, phone, show_phone')
        .eq('slug', username)
        .maybeSingle();

      if (cancelled) return;

      // Deactivated accounts are hidden on every public surface.
      let ownerActive = false;
      if (cardRow) {
        const { data: owner } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', cardRow.owner_id)
          .maybeSingle();
        ownerActive = owner?.status !== 'deactivated';
      }

      if (!cardRow || !ownerActive) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Own card → the richer owner view.
      if (me && cardRow.owner_id === me.id) {
        router.replace('/my-card');
        return;
      }

      const { data: links } = await supabase
        .from('social_links')
        .select('platform, url, label')
        .eq('card_id', cardRow.id);

      if (cancelled) return;
      setCard(cardRow as PublicCard);
      setSocialLinks((links as PublicSocialLink[]) ?? []);
      setLoading(false);

      // Connect pre-check (logged-in only).
      if (me) {
        const status = await getConnectionStatus(username);
        if (!cancelled) {
          setConnectPhase(status === 'konneqted' ? 'konneqted' : status);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [username, router]);

  const profileUrl = `https://www.konneqta.com/${username}`;
  const displayName = card?.full_name || username;

  const handleSaveContact = async () => {
    if (!card) return;
    const result = await saveToContacts({
      fullName: card.full_name || username,
      jobTitle: card.job_title,
      company: card.company,
      phone: card.phone,
      showPhone: card.show_phone,
      profileUrl,
    });

    if (result === 'saved') {
      Alert.alert('Contact saved', `${displayName} was added to your address book.`);
    } else if (result === 'denied') {
      Alert.alert('Permission needed', 'Allow contacts access to save this card.');
    } else {
      Alert.alert('Save Contact', 'Could not save the contact. Please try again.');
    }
  };

  const handleConnect = async () => {
    if (connectPhase === 'connecting' || connectPhase === 'requested' || connectPhase === 'konneqted') return;

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      Alert.alert('Sign in to connect', 'Create an account or log in to exchange contacts.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.replace('/login') },
      ]);
      return;
    }

    Alert.alert(`Connect with ${displayName}?`, 'They will be notified and can accept or reject your request.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Connect',
        style: 'default',
        onPress: async () => {
          setConnectPhase('connecting');
          try {
            const result = await sendKonneqt(username, typeof params.source === 'string' ? params.source : 'PROFILE_PAGE');
            setConnectPhase(result.status === 'konneqted' ? 'konneqted' : 'requested');
            Alert.alert(result.status === 'konneqted' ? "You're Konneqted! 🎉" : 'Request sent', result.message);
          } catch (err) {
            setConnectPhase('idle');
            Alert.alert('Connect', err instanceof Error ? err.message : 'Network error. Please try again.');
          }
        },
      },
    ]);
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out ${displayName}'s digital card on Konneqta: ${profileUrl}` });
    } catch {
      // Dismissed.
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.orange} />
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !card) {
    return (
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ThemedText type="title" style={styles.notFoundTitle}>
            Card not found
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.notFoundBody}>
            {"This profile doesn't exist or is no longer available."}
          </ThemedText>
          <Pressable onPress={() => router.replace('/my-card')} style={[styles.connectButton, { backgroundColor: theme.orange }]}>
            <ThemedText style={styles.buttonText}>Back to my card</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const connectLabel =
    connectPhase === 'konneqted' ? '✓ Konneqted'
    : connectPhase === 'requested' ? 'Requested ⏳'
    : connectPhase === 'connecting' ? 'Connecting...'
    : 'Connect';

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <DarkModeToggle />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.topLink} onPress={() => router.back()}>
          ← Back
        </ThemedText>

        {/* ---- Card ---- */}
        <View style={[styles.card, { borderColor: theme.backgroundSelected, backgroundColor: theme.surface }]}>
          {card.avatar_url ? (
            <Image source={{ uri: card.avatar_url }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText style={styles.avatarInitial}>
                {displayName.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          )}

          <ThemedText type="title" style={styles.name}>
            {displayName}
          </ThemedText>
          {card.job_title || card.company ? (
            <ThemedText themeColor="textSecondary">
              {[card.job_title, card.company].filter(Boolean).join(' · ')}
            </ThemedText>
          ) : null}
          {card.bio ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.bio}>
              {card.bio}
            </ThemedText>
          ) : null}
          {card.show_phone && card.phone ? (
            <ThemedText type="small" themeColor="textSecondary">
              📞 {card.phone}
            </ThemedText>
          ) : null}
        </View>

        {/* ---- Social links ---- */}
        <View style={[styles.linksCard, { backgroundColor: theme.surface, borderColor: theme.backgroundSelected }]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.linksHeading}>
            {[`Find ${displayName.split(' ')[0]} on`]}
          </ThemedText>
          {socialLinks.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
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
                  <Pressable key={index} style={styles.linkTile} onPress={() => Linking.openURL(href)}>
                    <View style={[styles.linkTileIcon, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundSelected }]}>
                      <Text style={[styles.linkTileInitial, { color: theme.text }]}>
                        {caption.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.linkTileLabel, { color: theme.textSecondary }]} numberOfLines={1}>
                      {caption}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* ---- QR ---- */}
        <View style={[styles.qrCard, { backgroundColor: '#09090b', borderColor: '#27272a' }]}>
          <View style={styles.qrBox}>
            <QRCode value={profileUrl} size={140} color="#18181b" backgroundColor="#ffffff" />
          </View>
          <Text style={styles.qrCaption}>{`Scan to view ${displayName.split(' ')[0]}'s card`}</Text>
        </View>

        {/* ---- Visitor actions ---- */}
        <View style={styles.actionsWrap}>
          <Pressable
            onPress={handleSaveContact}
            style={({ pressed }) => [styles.actionButton, { backgroundColor: theme.orange, opacity: pressed ? 0.9 : 1 }]}>
            <ThemedText style={styles.buttonText}>Save Contact</ThemedText>
          </Pressable>

          <Pressable
            onPress={handleConnect}
            disabled={connectPhase === 'connecting' || connectPhase === 'requested' || connectPhase === 'konneqted'}
            style={({ pressed }) => [
              styles.actionButton,
              styles.outlineButton,
              {
                borderColor: theme.border,
                opacity:
                  connectPhase === 'connecting'
                    ? 0.6
                    : connectPhase === 'requested' || connectPhase === 'konneqted'
                      ? 0.5
                      : pressed
                        ? 0.8
                        : 1,
              },
            ]}>
            {connectPhase === 'connecting' && <ActivityIndicator size="small" color={theme.text} />}
            <ThemedText type="small" style={{ color: theme.text, fontFamily: Fonts.semibold }}>
              {connectLabel}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [styles.actionButton, styles.outlineButton, { borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}>
            <ThemedText type="small" style={{ color: theme.text, fontFamily: Fonts.semibold }}>
              Share
            </ThemedText>
          </Pressable>
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
    paddingHorizontal: Spacing.four,
  },
  scroll: {
    paddingHorizontal: Spacing.three + Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    alignItems: 'center',
  },
  topLink: {
    alignSelf: 'flex-start',
    marginBottom: Spacing.two,
  },
  card: {
    alignSelf: 'stretch',
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  avatar: {
    width: 132,
    height: 132,
    borderRadius: 66,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: Fonts.bold,
    fontSize: 48,
    color: '#6A56A4',
  },
  name: {
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
  },
  bio: {
    textAlign: 'center',
  },
  linksCard: {
    alignSelf: 'stretch',
    borderRadius: Radius.lg + 4,
    borderWidth: 1,
    padding: Spacing.three,
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  linksHeading: {
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  linksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    width: '100%',
  },
  connectButton: {
    height: 50,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.two,
  },
  linkTile: {
    width: 56,
    alignItems: 'center',
    gap: 4,
  },
  linkTileIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTileInitial: {
    fontFamily: Fonts.medium,
    fontSize: 15,
  },
  linkTileLabel: {
    fontSize: 10,
    maxWidth: 56,
  },
  qrCard: {
    alignSelf: 'stretch',
    borderRadius: Radius.lg + 4,
    borderWidth: 1,
    alignItems: 'center',
    padding: Spacing.three,
    marginTop: Spacing.three,
    gap: Spacing.one,
  },
  qrBox: {
    width: 140,
    height: 140,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCaption: {
    color: '#a1a1aa',
    fontSize: 10,
  },
  actionsWrap: {
    alignSelf: 'stretch',
    gap: Spacing.two,
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
    height: 46,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
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
  actionButton: {
    height: 50,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  outlineButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  buttonText: {
    color: '#ffffff',
    fontFamily: Fonts.semibold,
    fontSize: 15,
  },
  notFoundTitle: {
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  notFoundBody: {
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
});
