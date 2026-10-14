import { MoonIcon, SunIcon } from "@/components/icons";
import { useTheme, useThemePreference } from "@/context/theme";
import { Pressable, StyleSheet } from "react-native";

/**
 * Dark/light mode toggle — port of the web app's DarkModeToggle: a rounded
 * icon button for the top-right corner of standalone screens (auth, etc.).
 * Shows a sun in dark mode (tap → light) and a moon in light mode (tap →
 * dark). The choice is persisted and overrides the OS colour scheme.
 */
export function DarkModeToggle() {
  const theme = useTheme();
  const { resolved, toggleTheme } = useThemePreference();
  const isDark = resolved === "dark";

  return (
    <Pressable
      onPress={toggleTheme}
      accessibilityLabel={
        isDark ? "Switch to light mode" : "Switch to dark mode"
      }
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed
            ? isDark
              ? "#27272a"
              : "#e4e4e7"
            : "transparent",
        },
      ]}
    >
      {isDark ? (
        <SunIcon size={20} color={theme.textSecondary} />
      ) : (
        <MoonIcon size={20} color={theme.textSecondary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    top: 55,
    right: 12,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
