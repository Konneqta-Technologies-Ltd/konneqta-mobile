import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DarkModeToggle } from '@/components/dark-mode-toggle';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { verifyReset } from '@/lib/password-reset';

export default function VerifyResetPage() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const initialEmail = typeof params.email === 'string' ? params.email : '';

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (isLoading) return;
    setError(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError('Code must be exactly 6 digits');
      return;
    }

    setIsLoading(true);

    try {
      await verifyReset(email.trim(), code);
      // Verified — the reset session cookie is stored in lib/password-reset.
      router.push({ pathname: '/reset-password', params: { email } });
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
            <ThemedText type="title">Enter verification code</ThemedText>
            <ThemedText type="subtitle" themeColor="textSecondary">
              Sent to your email
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

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Verification code</Text>
              <View style={styles.otpWrap}>
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const filled = code.length > i;
                  const active = code.length === i;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.otpBox,
                        {
                          borderColor: active ? theme.orange : theme.border,
                          backgroundColor: theme.surface,
                        },
                      ]}>
                      <ThemedText style={[styles.otpChar, { color: theme.text }]}>
                        {filled ? code[i] : ''}
                      </ThemedText>
                    </View>
                  );
                })}
                {/* Invisible text input capturing the whole code — native typing,
                    backspace and full-code paste all work through it. */}
                <TextInput
                  style={styles.otpHiddenInput}
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  autoFocus
                  editable={!isLoading}
                />
              </View>
            </View>

            <Pressable
              onPress={handleVerify}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: theme.orange, opacity: isLoading ? 0.7 : pressed ? 0.9 : 1 },
              ]}>
              {isLoading && <ActivityIndicator size="small" color="#ffffff" />}
              <ThemedText style={styles.ctaText}>
                {isLoading ? 'Verifying...' : 'Verify code'}
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
  otpWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpChar: {
    fontFamily: Fonts.bold,
    fontSize: 22,
  },
  otpHiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    fontSize: 20,
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
});
