import React, { createContext, useContext, useState, useCallback } from "react";
import { Text, StyleSheet, Animated } from "react-native";
import { colors, radii, spacing } from "@/src/theme/colors";

type ToastKind = "success" | "error" | "info";
type ToastCtx = { show: (msg: string, kind?: ToastKind) => void };

const Ctx = createContext<ToastCtx | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string>("");
  const [kind, setKind] = useState<ToastKind>("info");
  const opacity = React.useRef(new Animated.Value(0)).current;

  const show = useCallback((m: string, k: ToastKind = "info") => {
    setMsg(m);
    setKind(k);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [opacity]);

  const bg =
    kind === "success" ? colors.success : kind === "error" ? colors.danger : colors.primary;

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[styles.toast, { opacity, backgroundColor: bg }]}
        testID="toast-message"
      >
        <Text style={styles.text}>{msg}</Text>
      </Animated.View>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast must be inside ToastProvider");
  return c;
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 60,
    left: spacing.lg,
    right: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    zIndex: 9999,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  text: {
    color: "#fff",
    fontSize: 15,
    textAlign: "center",
    fontWeight: "600",
  },
});
