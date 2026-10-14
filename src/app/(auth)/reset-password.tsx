import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DarkModeToggle } from '@/components/dark-mode-toggle';
import { EyeIcon, EyeOffIcon } from '@/components/icons';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { resetPasswordSchema, updatePassword } from '@/lib/password-reset';

export default function ResetPasswordPage() {
  const theme = useTheme();
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'password' | 'confirmPassword' | null>(null);

  const handleResetPassword = async () => {
    if (isLoading) return;
    setError(null);

    const { error: validationError } = resetPasswordSchema.validate(
      { password, confirmPassword },
      { abortEarly: false }
    );

    if (validationError) {
      setError(validationError.details.map((detail) => detail.message).join('\n'));
      return;
    }

    setIsLoading(true);

    try {
      await updatePassword(password, confirmPassword);
      Alert.alert(
        'Password updated!',
        'Please log in with your new password.',
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputBorderColor = (field: 'password' | 'confirmPassword') =>
    focusedField === field ? theme.orange : theme.border;

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
            <ThemedText type="title">Set a new password</ThemedText>
            <ThemedText type="subtitle" themeColor="textSecondary">
              Choose a strong password
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
              <Text style={[styles.label, { color: theme.text }]}>New Password</Text>
              <View>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    { borderColor: inputBorderColor('password'), color: theme.text },
                  ]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter new password"
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
                  placeholder="Confirm new password"
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
              onPress={handleResetPassword}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: theme.orange, opacity: isLoading ? 0.7 : pressed ? 0.9 : 1 },
              ]}>
              {isLoading && <ActivityIndicator size="small" color="#ffffff" />}
              <ThemedText style={styles.ctaText}>
                {isLoading ? 'Updating...' : 'Update password'}
              </ThemedText>
            </Pressable>

            <ThemedText type="small" themeColor="textSecondary" style={styles.loginLink}>
              <Text
                onPress={() => router.replace('/login')}
                style={{ color: theme.orange, fontFamily: Fonts.semibold }}>
                Back to login
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
  passwordInput: {
    paddingRight: 44,
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
