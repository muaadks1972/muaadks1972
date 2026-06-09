import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { colors, radii, spacing } from "@/src/theme/colors";

export default function AdminProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const onSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>حساب المدير</Text>
      </View>

      <View style={styles.container}>
        <View style={styles.avatar}>
          <Ionicons name="shield-checkmark" size={48} color="#FFFFFF" />
        </View>
        <Text style={styles.name}>{user?.full_name || "المدير العام"}</Text>
        <Text style={styles.username}>@{user?.username}</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>مدير</Text>
            </View>
            <Text style={styles.rowLabel}>الدور</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowValue}>الشركة العامة لخدمات الملاحة الجوية</Text>
            <Text style={styles.rowLabel}>الجهة</Text>
          </View>
        </View>

        <TouchableOpacity testID="admin-signout-button" style={styles.signOutBtn} onPress={onSignOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.signOutText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "bold", textAlign: "right" },
  container: { padding: spacing.lg, alignItems: "center" },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  name: { fontSize: 20, fontWeight: "bold", color: colors.textPrimary, marginTop: spacing.md },
  username: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xl,
  },
  row: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  rowLabel: { fontSize: 13, color: colors.textSecondary },
  rowValue: { fontSize: 14, color: colors.textPrimary, fontWeight: "600", maxWidth: "70%" },
  roleBadge: { backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.pill },
  roleText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  divider: { height: 1, backgroundColor: colors.border },
  signOutBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: "bold" },
});
