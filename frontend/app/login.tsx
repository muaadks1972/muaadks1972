import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";
import { colors, radii, spacing } from "@/src/theme/colors";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const onSubmit = async () => {
    if (!username.trim() || !password) {
      toast.show("يرجى إدخال اسم المستخدم وكلمة المرور", "error");
      return;
    }
    setSubmitting(true);
    try {
      await signIn(username.trim(), password);
      router.replace("/");
    } catch (e: any) {
      toast.show(e?.message || "فشل تسجيل الدخول", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandSection}>
            <View style={styles.logoCircle}>
              <Ionicons name="airplane" size={48} color="#FFFFFF" />
            </View>
            <Text style={styles.companyName}>الشركة العامة لخدمات الملاحة الجوية</Text>
            <Text style={styles.tagline}>نظام إدارة أنشطة الصيانة</Text>
            <Text style={styles.engineer}>المهندس معاد كاظم</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.formTitle}>تسجيل الدخول</Text>

            <Text style={styles.label}>اسم المستخدم</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
              <TextInput
                testID="username-input"
                value={username}
                onChangeText={setUsername}
                placeholder="أدخل اسم المستخدم"
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.label}>كلمة المرور</Text>
            <View style={styles.inputWrap}>
              <TouchableOpacity onPress={() => setShowPwd((s) => !s)} testID="toggle-password">
                <Ionicons
                  name={showPwd ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
              <TextInput
                testID="password-input"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.muted}
                style={styles.input}
                secureTextEntry={!showPwd}
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              testID="login-button"
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitText}>دخول</Text>
              )}
            </TouchableOpacity>

            <View style={styles.helperBox}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.helperText}>
                للاستفسار يرجى مراجعة المدير للحصول على بيانات الدخول
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  brandSection: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryHover,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
  },
  companyName: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 30,
  },
  tagline: {
    color: "#CBD5E1",
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
  },
  engineer: {
    color: "#F59E0B",
    fontSize: 13,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(245,158,11,0.15)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.4)",
    fontWeight: "bold",
    overflow: "hidden",
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.textPrimary,
    textAlign: "right",
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "right",
    marginBottom: spacing.sm,
    fontWeight: "600",
  },
  inputWrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    height: 52,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: "right",
    paddingVertical: 0,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "bold",
  },
  helperBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "right",
    flex: 1,
  },
});
