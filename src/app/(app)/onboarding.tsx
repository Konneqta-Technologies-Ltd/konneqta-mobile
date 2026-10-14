import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DarkModeToggle } from '@/components/dark-mode-toggle';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  BIO_MAX_CHARS,
  MAX_SOCIAL_LINKS,
  SOCIAL_PLATFORMS,
  isUsernameTaken,
  normalizeUsername,
  submitOnboarding,
  validateUsername,
  type SocialLink,
} from '@/lib/onboarding';
import { saveCardSnapshot } from '@/lib/card-cache';
import { supabase } from '@/lib/supabase';
import { useIsOnline } from '@/hooks/use-net-info';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'reserved' | 'invalid' | 'short';

const STEP_TITLES = ['Choose a username', 'About you', 'Contact', 'Profile photo', 'Social links', 'Review & create'];

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const isOnline = useIsOnline();
  const params = useLocalSearchParams<{ fullName?: string }>();

  const [step, setStep] = useState(0);
  const [authGateLoading, setAuthGateLoading] = useState(true);

  const [username, setUsername] = useState('');
  const [remoteStatus, setRemoteStatus] = useState<UsernameStatus>('idle');

  const [fullName, setFullName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [bio, setBio] = useState('');

  const [phone, setPhone] = useState('');
  const [showPhone, setShowPhone] = useState(false);

  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [pickerForIndex, setPickerForIndex] = useState<number | null>(null);

  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Auth gate — onboarding requires a signed-in user. Prefill the name from
  // the account metadata (display_name from email signup, full_name from
  // Google sign-in).
  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) {
        router.replace('/login');
        return;
      }
      const meta = data.user.user_metadata as Record<string, string | undefined>;
      const prefillName =
        params.fullName ||
        meta?.full_name ||
        [meta?.first_name, meta?.last_name].filter(Boolean).join(' ').trim();
      if (prefillName) setFullName(prefillName);
      setAuthGateLoading(false);
    });

    return () => {
      active = false;
    };
  }, [params.fullName, router]);

  // Debounced username availability — mirrors the web form's behaviour.
  // Local (regex/reserved/length) problems are derived during render; only the
  // async availability check touches state — inside the timer callback.
  useEffect(() => {
    if (step !== 0) return;
    if (validateUsername(username)) return;

    const timer = setTimeout(async () => {
      setRemoteStatus('checking');
      const taken = await isUsernameTaken(username);
      setRemoteStatus(taken ? 'taken' : 'available');
    }, 400);

    return () => clearTimeout(timer);
  }, [username, step]);

  const localError = validateUsername(username);
  const usernameStatus: UsernameStatus =
    username.length === 0 ? 'idle'
    : localError === 'Username must be at least 3 characters' ? 'short'
    : localError === 'This username is reserved' ? 'reserved'
    : localError ? 'invalid'
    : remoteStatus;

  const usernameMessage: string | null =
    usernameStatus === 'short' ? 'Username must be at least 3 characters'
    : usernameStatus === 'invalid' ? 'Use only lowercase letters, numbers, and underscores'
    : usernameStatus === 'reserved' ? 'This username is reserved'
    : usernameStatus === 'taken' ? 'This username is already taken'
    : null;

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to add a profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const canAdvance = (() => {
    switch (step) {
      case 0:
        return username.length > 0 && usernameStatus === 'available';
      case 1:
        return fullName.trim().length > 0;
      case 5:
        return agreedToTerms;
      default:
        return true;
    }
  })();

  const handleGoNext = () => {
    setError(null);
    if (step < 5) {
      setStep(step + 1);
      return;
    }
    void handleSubmit();
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setError(null);

    if (!isOnline) {
      setError("You're offline — reconnect to create your card.");
      return;
    }
    setSubmitting(true);

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setSubmitting(false);
      router.replace('/login');
      return;
    }

    const result = await submitOnboarding({
      userId: data.user.id,
      email: data.user.email ?? '',
      username,
      fullName: fullName.trim(),
      jobTitle: jobTitle.trim(),
      company: company.trim(),
      bio: bio.trim(),
      phone: phone.trim(),
      showPhone,
      avatarUri,
      socialLinks,
      onStage: setSubmitStage,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    // Write the offline snapshot so My Card renders instantly on next launch.
    void saveCardSnapshot(
      {
        username,
        full_name: fullName.trim(),
        job_title: jobTitle.trim(),
        company: company.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        avatar_url: avatarUri,
        logo_url: null,
        qr_code_url: null,
      },
      socialLinks
    );

    Alert.alert(
      'Your card is ready! 🎉',
      `konneqta.com/@${result.username} is live. The mobile home experience is coming soon.`,
      [{ text: 'OK', onPress: () => router.replace('/my-card') }]
    );
  };

  if (authGateLoading) {
    return (
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.orange} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <DarkModeToggle />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Progress header */}
          <View style={styles.progressRow}>
            {STEP_TITLES.map((title, i) => (
              <View
                key={title}
                style={[
                  styles.progressSegment,
                  { backgroundColor: i <= step ? theme.orange : theme.backgroundSelected },
                ]}
              />
            ))}
          </View>
          <View style={styles.progressTextRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Step {step + 1} of {STEP_TITLES.length}
            </ThemedText>
            {step > 0 && (
              <Pressable onPress={() => setStep(step - 1)} hitSlop={8} disabled={submitting}>
                <ThemedText type="small" themeColor="orange">
                  Back
                </ThemedText>
              </Pressable>
            )}
          </View>
          <ThemedText type="title" style={styles.stepTitle}>
            {STEP_TITLES[step]}
          </ThemedText>

          {error && (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder },
              ]}>
              <ThemedText type="small" themeColor="danger">
                {error}
              </ThemedText>
            </View>
          )}

          {/* Step 0 — username */}
          {step === 0 && (
            <View style={styles.form}>
              <Text style={[styles.label, { color: theme.text }]}>Username</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                value={username}
                onChangeText={(t) => setUsername(normalizeUsername(t))}
                placeholder="yourname"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={theme.orange}
              />
              {usernameMessage && (
                <ThemedText type="small" themeColor="danger">
                  {usernameMessage}
                </ThemedText>
              )}
              {usernameStatus === 'checking' && (
                <ThemedText type="small" themeColor="textSecondary">
                  Checking availability...
                </ThemedText>
              )}
              {usernameStatus === 'available' && (
                <ThemedText type="small" themeColor="orange">
                  ✓ konneqta.com/@{username} is available
                </ThemedText>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                Your public profile: konneqta.com/@{username || 'yourname'}
              </ThemedText>
            </View>
          )}

          {/* Step 1 — about you */}
          {step === 1 && (
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Full Name</Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Ada Lovelace"
                  placeholderTextColor={theme.textSecondary}
                  autoComplete="name"
                  textContentType="name"
                  selectionColor={theme.orange}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Job Title</Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                  value={jobTitle}
                  onChangeText={setJobTitle}
                  placeholder="Product Designer"
                  placeholderTextColor={theme.textSecondary}
                  selectionColor={theme.orange}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Company</Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                  value={company}
                  onChangeText={setCompany}
                  placeholder="Company or brand"
                  placeholderTextColor={theme.textSecondary}
                  selectionColor={theme.orange}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.bioInput, { borderColor: theme.border, color: theme.text }]}
                  value={bio}
                  onChangeText={(t) => setBio(t.slice(0, BIO_MAX_CHARS))}
                  placeholder="Tell people what you do..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  selectionColor={theme.orange}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  {bio.length}/{BIO_MAX_CHARS}
                </ThemedText>
              </View>
            </View>
          )}

          {/* Step 2 — contact */}
          {step === 2 && (
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Phone</Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone number"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  selectionColor={theme.orange}
                />
              </View>
              <View style={styles.switchRow}>
                <ThemedText style={[styles.switchLabel, { color: theme.text }]}>
                  Show phone on my card
                </ThemedText>
                <Switch
                  value={showPhone}
                  onValueChange={setShowPhone}
                  trackColor={{ false: theme.backgroundSelected, true: theme.orange }}
                  thumbColor="#ffffff"
                  disabled={!phone.trim()}
                />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Optional — only shown publicly if you enable it.
              </ThemedText>
            </View>
          )}


          {/* Step 3 — photo */}
          {step === 3 && (
            <View style={styles.form}>
              <Pressable
                onPress={pickAvatar}
                style={[styles.avatarWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <ThemedText themeColor="textSecondary" style={styles.avatarPlaceholder}>
                    Add photo
                  </ThemedText>
                )}
              </Pressable>
              {avatarUri && (
                <Pressable onPress={() => setAvatarUri(null)} hitSlop={8}>
                  <ThemedText type="small" themeColor="danger">
                    Remove photo
                  </ThemedText>
                </Pressable>
              )}
              <ThemedText type="small" themeColor="textSecondary" style={styles.optionalNote}>
                {"Optional — a face builds trust. It's compressed automatically before upload."}
              </ThemedText>
            </View>
          )}

          {/* Step 4 — social links */}
          {step === 4 && (
            <View style={styles.form}>
              {socialLinks.map((link, index) => {
                const platform = SOCIAL_PLATFORMS.find((p) => p.id === link.platform);
                return (
                  <View key={index} style={styles.socialRow}>
                    <Pressable
                      onPress={() => setPickerForIndex(index)}
                      style={[styles.platformPill, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                      <ThemedText type="small" style={{ color: theme.text }} numberOfLines={1}>
                        {platform?.label ?? 'Platform'}
                      </ThemedText>
                    </Pressable>
                    <TextInput
                      style={[styles.input, styles.socialUrlInput, { borderColor: theme.border, color: theme.text }]}
                      value={link.url}
                      onChangeText={(t) =>
                        setSocialLinks((prev) => prev.map((l, i) => (i === index ? { ...l, url: t } : l)))
                      }
                      placeholder={platform?.placeholder ?? 'https://...'}
                      placeholderTextColor={theme.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType={link.platform === 'email' ? 'email-address' : 'url'}
                      selectionColor={theme.orange}
                    />
                    <Pressable
                      onPress={() => setSocialLinks((prev) => prev.filter((_, i) => i !== index))}
                      hitSlop={8}>
                      <ThemedText type="small" themeColor="danger">
                        ✕
                      </ThemedText>
                    </Pressable>
                  </View>
                );
              })}

              {socialLinks.length < MAX_SOCIAL_LINKS ? (
                <Pressable
                  onPress={() => setSocialLinks((prev) => [...prev, { platform: 'website', url: '' }])}
                  style={[styles.addLinkButton, { borderColor: theme.border }]}>
                  <ThemedText themeColor="orange">+ Add social link</ThemedText>
                </Pressable>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  Free accounts can add up to {MAX_SOCIAL_LINKS} links.
                </ThemedText>
              )}
            </View>
          )}

          {/* Step 5 — review + terms */}
          {step === 5 && (
            <View style={styles.form}>
              <View style={[styles.reviewCard, { backgroundColor: theme.surface, borderColor: theme.backgroundSelected }]}>
                <ThemedText style={[styles.reviewName, { color: theme.text }]}>{fullName}</ThemedText>
                {jobTitle ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {[jobTitle, company].filter(Boolean).join(' · ')}
                  </ThemedText>
                ) : null}
                <ThemedText type="small" themeColor="orange">
                  konneqta.com/@{username}
                </ThemedText>
              </View>

              <Pressable
                onPress={() => setAgreedToTerms(!agreedToTerms)}
                style={styles.termsRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreedToTerms }}>
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: theme.border, backgroundColor: agreedToTerms ? theme.orange : 'transparent' },
                  ]}>
                  {agreedToTerms && <ThemedText style={styles.checkboxTick}>✓</ThemedText>}
                </View>
                <ThemedText type="small" style={{ color: theme.text, flex: 1 }}>
                  I agree to the Terms of Service and Privacy Policy.
                </ThemedText>
              </Pressable>
            </View>
          )}

          {/* Nav */}
          <Pressable
            onPress={handleGoNext}
            disabled={!canAdvance || submitting}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: theme.orange,
                opacity: submitting ? 0.7 : !canAdvance ? 0.4 : pressed ? 0.9 : 1,
              },
            ]}>
            {submitting ? (
              <>
                <ActivityIndicator size="small" color="#ffffff" />
                <ThemedText style={styles.ctaText}>{submitStage || 'Working...'}</ThemedText>
              </>
            ) : (
              <ThemedText style={styles.ctaText}>
                {step === 5 ? 'Create my card' : 'Continue'}
              </ThemedText>
            )}
          </Pressable>
        </ScrollView>

        {/* Platform picker modal */}
        <Modal
          visible={pickerForIndex !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setPickerForIndex(null)}>
          <Pressable
            style={[styles.modalBackdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={() => setPickerForIndex(null)}>
            <View style={[styles.modalSheet, { backgroundColor: theme.background }]}>
              {SOCIAL_PLATFORMS.map((platform) => (
                <Pressable
                  key={platform.id}
                  onPress={() => {
                    if (pickerForIndex !== null) {
                      setSocialLinks((prev) =>
                        prev.map((l, i) =>
                          i === pickerForIndex ? { ...l, platform: platform.id, url: '' } : l
                        )
                      );
                    }
                    setPickerForIndex(null);
                  }}
                  style={styles.modalRow}>
                  <ThemedText style={{ color: theme.text }}>{platform.label}</ThemedText>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
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
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.two,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 26,
    lineHeight: 32,
    marginBottom: Spacing.three,
  },
  errorBanner: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    marginBottom: Spacing.three,
  },
  form: {
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  fieldGroup: {
    gap: Spacing.one,
  },
  label: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: Fonts.regular,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    flex: 1,
  },
  avatarWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    fontFamily: Fonts.medium,
  },
  optionalNote: {
    textAlign: 'center',
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  platformPill: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 110,
  },
  socialUrlInput: {
    flex: 1,
    height: 44,
  },
  addLinkButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewCard: {
    borderRadius: Radius.lg + 4,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  reviewName: {
    fontFamily: Fonts.bold,
    fontSize: 18,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxTick: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  cta: {
    height: 52,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  ctaText: {
    color: '#ffffff',
    fontFamily: Fonts.semibold,
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: Spacing.four,
    paddingTop: Spacing.two,
    maxHeight: '70%',
  },
  modalRow: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.four,
  },
});
