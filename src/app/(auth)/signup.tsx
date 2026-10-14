import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Joi from 'joi';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { supabase } from '@/lib/supabase';
import { signInWithGoogle } from '@/lib/auth';

// Same schema + messages as the web signup (konneqta app/auth/signup/page.tsx).
const signupSchema = Joi.object({
  firstName: Joi.string().required().messages({
    'string.empty': 'First name is required',
  }),
  lastName: Joi.string().required().messages({
    'string.empty': 'Last name is required',
  }),
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
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'string.empty': 'Please confirm your password',
      'any.only': 'Passwords do not match',
    }),
});

export default function SignUpPage() {
  const theme = useTheme();
  const router = useRouter();
  const isOnline = useIsOnline();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSignUp = async () => {
    if (isLoading) return;
    setError(null);

    if (!isOnline) {
      setError("You're offline — reconnect to sign up.");
      return;
    }

    // Validate with Joi before submitting (same as the web).
    const { error: validationError } = signupSchema.validate(
      { firstName, lastName, email, password, confirmPassword },
      { abortEarly: false }
    );

    if (validationError) {
      setError(validationError.details.map((detail) => detail.message).join('\n'));
      return;
    }

    setIsLoading(true);

    // No emailRedirectTo: Supabase falls back to its configured Site URL
    // (konneqta.com), whose /auth/callback handles verification on the web.
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          display_name: `${firstName} ${lastName}`,
        },
      },
    });

    setIsLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    // Supabase returns empty identities when the email is already registered.
    if (!data.user?.identities?.length) {
      setError('This email is already registered. Please log in instead.');
      return;
    }

    Alert.alert(
      'Account created!',
      'Please check your email to verify your account before logging in.',
      [{ text: 'OK', onPress: () => router.replace('/login') }]
    );
  };


  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    setError(null);

    if (!isOnline) {
      setError("You're offline — reconnect to sign up.");
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
    router.replace('/my-card');
  };

  const inputBorderColor = (field: string) =>
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
            <ThemedText type="title">Create your account</ThemedText>
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
              <Text style={[styles.label, { color: theme.text }]}>First Name</Text>
              <TextInput
                style={[styles.input, { borderColor: inputBorderColor('firstName'), color: theme.text }]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={theme.textSecondary}
                autoComplete="given-name"
                textContentType="givenName"
                selectionColor={theme.orange}
                editable={!isLoading}
                onFocus={() => setFocusedField('firstName')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Last Name</Text>
              <TextInput
                style={[styles.input, { borderColor: inputBorderColor('lastName'), color: theme.text }]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={theme.textSecondary}
                autoComplete="family-name"
                textContentType="familyName"
                selectionColor={theme.orange}
                editable={!isLoading}
                onFocus={() => setFocusedField('lastName')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

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
                  autoComplete="new-password"
                  textContentType="newPassword"
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
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Confirm Password</Text>
              <View>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    { borderColor: inputBorderColor('confirmPassword'), color: theme.text },
                  ]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm password"
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showConfirmPassword}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  selectionColor={theme.orange}
                  editable={!isLoading}
                  onFocus={() => setFocusedField('confirmPassword')}
                  onBlur={() => setFocusedField(null)}
                />
                <Pressable
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                  hitSlop={8}
                  accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}>
                  {showConfirmPassword ? (
                    <EyeOffIcon color={theme.textSecondary} />
                  ) : (
                    <EyeIcon color={theme.textSecondary} />
                  )}
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={handleSignUp}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: theme.orange, opacity: isLoading ? 0.7 : pressed ? 0.9 : 1 },
              ]}>
              {isLoading && <ActivityIndicator size="small" color="#ffffff" />}
              <ThemedText style={styles.ctaText}>
                {isLoading ? 'Creating account...' : 'Register'}
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
                Sign up with Google
              </ThemedText>
            </Pressable>

            <ThemedText type="small" themeColor="textSecondary" style={styles.loginLink}>
              Already have an account?{' '}
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
    paddingHorizontal: Spacing.three + Spacing.two, // px-6 like the web form
    paddingTop: Spacing.five + Spacing.two,
    paddingBottom: Spacing.five, // mb-10 on the web
  },
  logo: {
    width: 45,
    height: 64,
    alignSelf: 'center',
  },
  heading: {
    alignItems: 'center',
    marginTop: Spacing.one + Spacing.two, // pt-3 on the web (logo sits higher)
    marginBottom: Spacing.four, // pb-12 on the web
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
  cta: {
    height: 50,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two, // mt-4 on the web
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
  loginLink: {
    textAlign: 'center',
    paddingTop: Spacing.two, // pt-2
  },
});
