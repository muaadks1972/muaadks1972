import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";
import { colors, radii, spacing } from "@/src/theme/colors";

type Employee = {
  id: string;
  username: string;
  full_name: string;
  role: string;
  created_at: string;
};

export default function EmployeesScreen() {
  const { apiFetch } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Employee[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await apiFetch("/api/admin/employees");
      if (res.ok) setItems(await res.json());
    } finally {
      setRefreshing(false);
    }
  }, [apiFetch]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const resetForm = () => {
    setFullName("");
    setUsername("");
    setPassword("");
  };

  const onCreate = async () => {
    if (!fullName.trim() || !username.trim() || !password) {
      toast.show("جميع الحقول مطلوبة", "error");
      return;
    }
    if (password.length < 4) {
      toast.show("كلمة المرور قصيرة جداً", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/admin/employees", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName.trim(),
          username: username.trim(),
          password,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "تعذر الإضافة");
      }
      toast.show("تم إضافة الموظف", "success");
      setModalOpen(false);
      resetForm();
      load();
    } catch (e: any) {
      toast.show(e?.message || "تعذر الإضافة", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    const res = await apiFetch(`/api/admin/employees/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.show("تم حذف الموظف", "success");
      setItems((prev) => prev.filter((e) => e.id !== id));
    } else {
      toast.show("تعذر الحذف", "error");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            testID="add-employee-button"
            style={styles.addBtn}
            onPress={() => setModalOpen(true)}
          >
            <Ionicons name="add" size={20} color={colors.primary} />
            <Text style={styles.addText}>إضافة</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>إدارة الموظفين</Text>
            <Text style={styles.headerSubtitle}>{items.length} موظف</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={
          !refreshing ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={56} color={colors.muted} />
              <Text style={styles.emptyTitle}>لا يوجد موظفون بعد</Text>
              <Text style={styles.emptySub}>اضغط زر الإضافة لإنشاء أول حساب</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card} testID={`employee-card-${item.id}`}>
            <View style={styles.cardLeft}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={22} color="#fff" />
              </View>
              <View>
                <Text style={styles.empName}>{item.full_name}</Text>
                <Text style={styles.empUser}>@{item.username}</Text>
              </View>
            </View>
            <TouchableOpacity
              testID={`delete-employee-${item.id}`}
              style={styles.delBtn}
              onPress={() => onDelete(item.id)}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <Pressable style={styles.backdrop} onPress={() => !submitting && setModalOpen(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>إضافة موظف جديد</Text>
                <TouchableOpacity onPress={() => setModalOpen(false)} testID="close-add-modal">
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>الاسم الكامل</Text>
              <TextInput
                testID="new-fullname"
                value={fullName}
                onChangeText={setFullName}
                placeholder="مثال: أحمد علي"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />

              <Text style={styles.label}>اسم المستخدم</Text>
              <TextInput
                testID="new-username"
                value={username}
                onChangeText={setUsername}
                placeholder="username"
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoCapitalize="none"
              />

              <Text style={styles.label}>كلمة المرور</Text>
              <TextInput
                testID="new-password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••"
                placeholderTextColor={colors.muted}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
              />

              <TouchableOpacity
                testID="confirm-add-employee"
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={onCreate}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>إضافة الموظف</Text>}
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
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
  headerRow: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.md },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "bold", textAlign: "right" },
  headerSubtitle: { color: "#CBD5E1", fontSize: 13, marginTop: 4, textAlign: "right" },
  addBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  addText: { color: colors.primary, fontWeight: "bold", fontSize: 14 },
  list: { padding: spacing.lg, paddingBottom: 100, flexGrow: 1 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: colors.textPrimary, marginTop: spacing.md },
  emptySub: { fontSize: 14, color: colors.textSecondary, marginTop: 4, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLeft: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.sm, flex: 1 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  empName: { fontSize: 15, fontWeight: "bold", color: colors.textPrimary, textAlign: "right" },
  empUser: { fontSize: 12, color: colors.textSecondary, textAlign: "right" },
  delBtn: { padding: spacing.sm },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sheetTitle: { fontSize: 18, fontWeight: "bold", color: colors.textPrimary, textAlign: "right" },
  label: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, textAlign: "right", marginTop: spacing.md, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 50,
    fontSize: 15,
    color: colors.textPrimary,
    textAlign: "right",
    backgroundColor: colors.background,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  submitText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
