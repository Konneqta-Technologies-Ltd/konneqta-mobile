import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Joi from 'joi';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DarkModeToggle } from '@/components/dark-mode-toggle';
import { EyeIcon, EyeOffIcon, GoogleIcon } from '@/components/icons';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useIsOnline } from '@/hooks/use-net-info';
import { routeAfterSignIn, signInWithGoogle } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Same schema + messages as the web login (konneqta app/auth/login/page.tsx).
const loginSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Please enter a valid email address',
    }),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 6 characters',
    }),
});

export default function LoginPage() {
  const theme = useTheme();
  const router = useRouter();
  const isOnline = useIsOnline();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const handleLogin = async () => {
    if (isLoading) return;
    setError(null);

    if (!isOnline) {
      setError("You're offline — reconnect to sign in.");
      return;
    }

    // Validate with Joi before submitting (same as the web).
    const { error: validationError } = loginSchema.validate(
      { email, password },
      { abortEarly: false }
    );

    if (validationError) {
      setError(validationError.details.map((detail) => detail.message).join('\n'));
      return;
    }

    setIsLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    // Route: new users (no profile / no primary card) go through onboarding.
    router.replace(await routeAfterSignIn());
  };


  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    setError(null);

    if (!isOnline) {
      setError("You're offline — reconnect to sign in.");
      return;
    }
    setIsLoading(true);

    const result = await signInWithGoogle();

    setIsLoading(false);

    if (result.status === 'canceled') return;
    if (result.status === 'error') {
      setError(result.message);
      return;
    }

    // signInWithIdToken establishes a full session (no email verification).
    router.replace(await routeAfterSignIn());
  };

  const inputBorderColor = (field: 'email' | 'password') =>
    focusedField === field ? theme.orange : theme.border;

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <DarkModeToggle />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}>
          <Image
            source={require('@/assets/images/k-mark.png')}
            style={styles.logo}
            contentFit="contain"
          />

          <View style={styles.heading}>
            <ThemedText type="title">Login your account</ThemedText>
            <ThemedText type="subtitle" themeColor="textSecondary">
              Connect Smarter
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
                style={[styles.input, { borderColor: inputBorderColor('email'), color: theme.text }]}
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
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Password</Text>
              <View>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    { borderColor: inputBorderColor('password'), color: theme.text },
                  ]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  textContentType="password"
                  selectionColor={theme.orange}
                  editable={!isLoading}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  hitSlop={8}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? (
                    <EyeOffIcon color={theme.textSecondary} />
                  ) : (
                    <EyeIcon color={theme.textSecondary} />
                  )}
                </Pressable>
              </View>
              <Pressable
                onPress={() => router.push('/forgot-password')}
                style={styles.forgotButton}
                hitSlop={4}>
                <ThemedText type="small" themeColor="textSecondary">
                  Forgot password?
                </ThemedText>
              </Pressable>
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: theme.orange, opacity: isLoading ? 0.7 : pressed ? 0.9 : 1 },
              ]}>
              {isLoading && <ActivityIndicator size="small" color="#ffffff" />}
              <ThemedText style={styles.ctaText}>
                {isLoading ? 'Logging in...' : 'Continue'}
              </ThemedText>
            </Pressable>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.borderSubtle }]} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.dividerText}>
                or
              </ThemedText>
              <View style={[styles.dividerLine, { backgroundColor: theme.borderSubtle }]} />
            </View>

            <Pressable
              onPress={handleGoogleSignIn}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.googleButton,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}>
              <GoogleIcon />
              <ThemedText type="small" style={[styles.googleText, { color: theme.text }]}>
                Sign in with Google
              </ThemedText>
            </Pressable>

            <ThemedText type="small" themeColor="textSecondary" style={styles.signUp}>
              {"Don't have an account?"}{' '}
              <Text
                onPress={() => router.push('/signup')}
                style={{ color: theme.orange, fontFamily: Fonts.semibold }}>
                Create one
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
    paddingHorizontal: Spacing.three + Spacing.two, // px-6 like the web form
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
    marginTop: Spacing.three + Spacing.two, // pt-7 on the web
    marginBottom: Spacing.five, // pb-14 on the web
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
    gap: Spacing.three, // pb-4 between field groups on the web
  },
  fieldGroup: {
    gap: Spacing.one, // gap-1 between label and input
  },
  label: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  input: {
    height: 52, // h-13 on the web
    borderWidth: 1,
    borderRadius: Radius.lg, // rounded-xl
    paddingHorizontal: 12, // pl-2 (+ a little for touch comfort)
    fontSize: 16,
    fontFamily: Fonts.regular,
  },
  passwordInput: {
    paddingRight: 44, // room for the eye toggle
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  forgotButton: {
    alignSelf: 'flex-end', // self-end on the web
    marginTop: 2,
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
    fontFamily: Fonts.semibold, // font-semibold
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: Spacing.one,
  },
  dividerLine: {
    flex: 1,
    height: 1, // h-px
  },
  dividerText: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase', // text-xs uppercase tracking-wide
  },
  googleButton: {
    height: 50,
    borderRadius: Radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  googleText: {
    fontFamily: Fonts.semibold,
  },
  signUp: {
    textAlign: 'center',
    paddingTop: Spacing.two, // pt-2
  },
});
