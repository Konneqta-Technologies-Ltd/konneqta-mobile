import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Slim banner shown when the device is offline (e.g. saved card is displayed). */
export function OfflineBanner({ visible }: { visible: boolean }) {
  const theme = useTheme();
  if (visible === false) return null;

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: theme.surface, borderColor: theme.backgroundSelected },
      ]}>
      <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
        {"You're offline — showing your saved card"}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    marginBottom: Spacing.three,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontFamily: Fonts.medium,
  },
});
