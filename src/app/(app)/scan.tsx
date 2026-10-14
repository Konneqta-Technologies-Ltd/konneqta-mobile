import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * QR scanner — the mobile-native networking entry point. Konneqta card QRs
 * encode https://www.konneqta.com/{username}; the username is extracted and
 * opened in the in-app viewer with source QR_SCAN. Plain usernames also work.
 */

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

function extractUsername(raw: string): string | null {
  try {
    const url = new URL(raw);
    const bareHost = url.hostname.replace(/^www\./i, '');
    if (bareHost === 'konneqta.com') {
      const segment = url.pathname.replace(/^\/+/, '').split('/')[0];
      if (USERNAME_PATTERN.test(segment)) return segment;
    }
  } catch {
    // Not a URL — maybe a bare username.
  }
  return USERNAME_PATTERN.test(raw) ? raw : null;
}

export default function ScanScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [permission, requestPermission] = useCameraPermissions();
  const [scannedData, setScannedData] = useState<string | null>(null);

  const handleScanned = ({ data }: { data: string }) => {
    if (scannedData) return; // one result per session — avoids duplicate fires
    setScannedData(data);

    const username = extractUsername(data);
    if (username) {
      router.push({ pathname: '/u/[username]', params: { username, source: 'QR_SCAN' } });
      return;
    }
    // Not a Konneqta code — offer to open it in the browser.
  };

  const reset = () => {
    setScannedData(null);
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: '#000000' }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <ThemedText style={styles.headerTitle}>Scan a Konneqta code</ThemedText>
      </View>

      <View style={styles.body}>
        {permission === null ? (
          <ActivityIndicator size="large" color="#FF6B2C" />
        ) : !permission.granted ? (
          <View style={styles.permissionWrap}>
            <ThemedText style={styles.permissionTitle}>Camera access needed</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.permissionBody}>
              {"Konneqta uses the camera to scan other people's card QR codes."}
            </ThemedText>
            <Pressable onPress={requestPermission} style={styles.cta}>
              <Text style={styles.ctaText}>Allow camera access</Text>
            </Pressable>
            <Pressable
              onPress={() => Linking.openSettings()}
              style={styles.link}>
              <Text style={[styles.linkText, { color: theme.textSecondary }]}>Open settings</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scannedData ? undefined : handleScanned}
            />

            {/* Frame overlay */}
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.frame} />
              <Text style={styles.hint}>
                {"Point the camera at another person's Konneqta QR code"}
              </Text>
            </View>

            {/* Result panel */}
            {scannedData && (
              <View style={styles.resultPanel}>
                {extractUsername(scannedData) ? null : (
                  <>
                    <Text style={styles.resultTitle}>Not a Konneqta code</Text>
                    <Text style={styles.resultBody} numberOfLines={2}>
                      {scannedData}
                    </Text>
                    {/^https?:\/\//i.test(scannedData) && (
                      <Pressable
                        onPress={() => Linking.openURL(scannedData)}
                        style={styles.cta}>
                        <Text style={styles.ctaText}>Open in browser</Text>
                      </Pressable>
                    )}
                  </>
                )}
                <Pressable onPress={reset} style={[styles.cta, styles.ctaSecondary]}>
                  <Text style={styles.ctaTextDark}>Scan again</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27272a',
  },
  closeText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: Fonts.medium,
  },
  headerTitle: {
    color: '#ffffff',
    fontFamily: Fonts.semibold,
    fontSize: 16,
  },
  body: {
    flex: 1,
  },
  cameraWrap: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: Radius.xl,
    margin: Spacing.three,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderRadius: Radius.xl,
    borderColor: '#FF6B2C',
  },
  hint: {
    color: '#d4d4d8',
    fontSize: 13,
    fontFamily: Fonts.medium,
    textAlign: 'center',
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  resultPanel: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
    backgroundColor: '#18181b',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#3f3f46',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  resultTitle: {
    color: '#ffffff',
    fontFamily: Fonts.semibold,
    fontSize: 16,
    textAlign: 'center',
  },
  resultBody: {
    color: '#a1a1aa',
    fontSize: 13,
    textAlign: 'center',
  },
  cta: {
    height: 46,
    borderRadius: Radius.lg,
    backgroundColor: '#FF6B2C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  ctaSecondary: {
    backgroundColor: '#3f3f46',
  },
  ctaText: {
    color: '#ffffff',
    fontFamily: Fonts.semibold,
    fontSize: 14,
  },
  ctaTextDark: {
    color: '#ffffff',
    fontFamily: Fonts.semibold,
    fontSize: 14,
  },
  link: {
    alignItems: 'center',
    padding: Spacing.two,
  },
  linkText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  permissionWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  permissionTitle: {
    color: '#ffffff',
    fontFamily: Fonts.bold,
    fontSize: 18,
  },
  permissionBody: {
    textAlign: 'center',
  },
});
