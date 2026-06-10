import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { I18nManager } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/auth/AuthContext";
import { ToastProvider } from "@/src/components/Toast";

// Enable RTL for Arabic globally
if (!I18nManager.isRTL) {
  try {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  } catch {
    // ignore
  }
}

SplashScreen.preventAutoHideAsync();

// Silently swallow web-only fontfaceobserver timeout errors so the dev
// LogBox doesn't cover the UI. The fonts still load; the library just
// can't detect them within its 6s deadline on slow networks.
if (typeof window !== "undefined") {
  const isFontTimeout = (msg: unknown) =>
    typeof msg === "string" && /ms timeout exceeded/.test(msg);
  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const reason: any = e.reason;
    if (isFontTimeout(reason?.message) || isFontTimeout(reason)) {
      e.preventDefault();
    }
  });
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const [forceReady, setForceReady] = useState(false);

  // Safety net: never block the UI for more than 3s waiting for fonts.
  useEffect(() => {
    const t = setTimeout(() => setForceReady(true), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (loaded || error || forceReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error, forceReady]);

  if (!loaded && !error && !forceReady) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(employee)" />
            <Stack.Screen name="(admin)" />
          </Stack>
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
