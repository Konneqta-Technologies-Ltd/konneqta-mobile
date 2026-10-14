import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Joi from 'joi';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DarkModeToggle } from '@/components/dark-mode-toggle';
import { MailIcon } from '@/components/icons';
import { ThemedText } from '@/components/themed-text';
import { emailSchema, requestReset } from '@/lib/password-reset';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useIsOnline } from '@/hooks/use-net-info';
import { useTheme } from '@/hooks/use-theme';

export default function ForgotPasswordPage() {
  const theme = useTheme();
  const router = useRouter();
  const isOnline = useIsOnline();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResetRequest = async () => {
    if (isLoading) return;
    setError(null);

    if (!isOnline) {
      setError("You're offline — reconnect to request a reset code.");
      return;
    }

    const { error: validationError } = Joi.object({ email: emailSchema }).validate(
      { email },
      { abortEarly: false }
    );

    if (validationError) {
      setError(validationError.details.map((detail) => detail.message).join('\n'));
      return;
    }

    setIsLoading(true);

    try {
      // Custom OTP flow: the web API generates a 6-digit code and emails it
      // via ZeptoMail. Always { ok: true } — anti user-enumeration.
      await requestReset(email.trim());
      setEmailSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <DarkModeToggle />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
          <Image
            source={require('@/assets/images/k-mark.png')}
            style={styles.logo}
            contentFit="contain"
          />

          <View style={styles.heading}>
            <ThemedText type="title">Reset your password</ThemedText>
            <ThemedText type="subtitle" themeColor="textSecondary">
              {"We'll email you a verification code"}
            </ThemedText>
          </View>

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

          {emailSent ? (
            <View style={styles.sentWrap}>
              <View style={styles.sentIconWrap}>
                <MailIcon size={48} color={theme.orange} />
              </View>
              <ThemedText style={[styles.sentTitle, { color: theme.text }]}>
                Check your inbox for a 6-digit verification code.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.sentBody}>
                {"Didn't get it? Check your spam folder or try again in a few minutes."}
              </ThemedText>

              <Pressable
                onPress={() => router.push({ pathname: '/verify-reset', params: { email } })}
                style={({ pressed }) => [
                  styles.cta,
                  { backgroundColor: theme.orange, opacity: pressed ? 0.9 : 1 },
                ]}>
                <ThemedText style={styles.ctaText}>Enter verification code</ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Email</Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@email.com"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  selectionColor={theme.orange}
                  editable={!isLoading}
                />
              </View>

              <Pressable
                onPress={handleResetRequest}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.cta,
                  { backgroundColor: theme.orange, opacity: isLoading ? 0.7 : pressed ? 0.9 : 1 },
                ]}>
                {isLoading && <ActivityIndicator size="small" color="#ffffff" />}
                <ThemedText style={styles.ctaText}>
                  {isLoading ? 'Sending code...' : 'Send reset code'}
                </ThemedText>
              </Pressable>

              <ThemedText type="small" themeColor="textSecondary" style={styles.loginLink}>
                Remembered your password?{' '}
                <Text
                  onPress={() => router.replace('/login')}
                  style={{ color: theme.orange, fontFamily: Fonts.semibold }}>
                  Login
                </Text>
              </ThemedText>
            </View>
          )}
        </ScrollView>
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
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three + Spacing.two,
    paddingTop: Spacing.five + Spacing.two,
    paddingBottom: Spacing.four,
  },
  logo: {
    width: 45,
    height: 64,
    alignSelf: 'center',
  },
  heading: {
    alignItems: 'center',
    marginTop: Spacing.three + Spacing.two,
    marginBottom: Spacing.five,
    gap: Spacing.one,
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
  cta: {
    height: 50,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  ctaText: {
    color: '#ffffff',
    fontFamily: Fonts.semibold,
    fontSize: 16,
  },
  loginLink: {
    textAlign: 'center',
    paddingTop: Spacing.two,
  },
  sentWrap: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  sentIconWrap: {
    marginBottom: Spacing.two,
  },
  sentTitle: {
    fontFamily: Fonts.semibold,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  sentBody: {
    textAlign: 'center',
  },
});
