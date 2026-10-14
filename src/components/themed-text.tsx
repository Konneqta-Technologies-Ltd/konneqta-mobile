import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'subtitle' | 'small' | 'link';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'], fontFamily: Fonts.regular },
        type === 'title' && styles.title,
        type === 'subtitle' && styles.subtitle,
        type === 'small' && styles.small,
        type === 'link' && styles.link,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  // `text-3xl font-extrabold` — the "Login your account" heading on the web.
  title: {
    fontFamily: Fonts.extrabold,
    fontSize: 30,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 26,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    lineHeight: 20,
  },
});
