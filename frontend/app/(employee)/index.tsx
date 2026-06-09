import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";
import DepartmentPicker from "@/src/components/DepartmentPicker";
import { colors, radii, spacing } from "@/src/theme/colors";

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function NewActivityScreen() {
  const { user, apiFetch } = useAuth();
  const toast = useToast();

  const [date, setDate] = useState<Date>(new Date());
  const [showDate, setShowDate] = useState(false);
  const [nature, setNature] = useState("");
  const [department, setDepartment] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!nature.trim()) {
      toast.show("يرجى إدخال طبيعة عمل الصيانة", "error");
      return;
    }
    if (!department) {
      toast.show("يرجى اختيار القسم", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/activities", {
        method: "POST",
        body: JSON.stringify({
          date: formatDate(date),
          nature_of_work: nature,
          department,
          notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "فشل الإرسال");
      }
      toast.show("تم تسجيل النشاط بنجاح", "success");
      setNature("");
      setNotes("");
      setDepartment(null);
      setDate(new Date());
    } catch (e: any) {
      toast.show(e?.message || "فشل الإرسال", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>تسجيل نشاط صيانة</Text>
        <Text style={styles.headerSubtitle}>
          {user ? `أهلاً، ${user.full_name || user.username}` : ""}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.label}>اسم الموظف</Text>
            <View style={[styles.inputWrap, { backgroundColor: "#F1F5F9" }]}>
              <Ionicons name="person" size={20} color={colors.textSecondary} />
              <Text style={styles.readOnly}>{user?.full_name || user?.username}</Text>
            </View>

            <Text style={styles.label}>التاريخ</Text>
            <TouchableOpacity
              testID="date-picker-trigger"
              style={styles.inputWrap}
              onPress={() => setShowDate(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.input}>{formatDate(date)}</Text>
            </TouchableOpacity>
            {showDate && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, selected) => {
                  setShowDate(Platform.OS === "ios");
                  if (selected) setDate(selected);
                }}
              />
            )}

            <Text style={styles.label}>طبيعة عمل الصيانة</Text>
            <View style={[styles.inputWrap, { alignItems: "flex-start", height: 100, paddingVertical: spacing.sm }]}>
              <TextInput
                testID="nature-input"
                value={nature}
                onChangeText={setNature}
                placeholder="اكتب وصف عمل الصيانة..."
                placeholderTextColor={colors.muted}
                style={[styles.input, { height: 84, textAlignVertical: "top" }]}
                multiline
              />
            </View>

            <Text style={styles.label}>القسم</Text>
            <DepartmentPicker value={department} onChange={setDepartment} testID="department-picker" />

            <Text style={[styles.label, { marginTop: spacing.md }]}>ملاحظات (اختياري)</Text>
            <View style={[styles.inputWrap, { alignItems: "flex-start", height: 90, paddingVertical: spacing.sm }]}>
              <TextInput
                testID="notes-input"
                value={notes}
                onChangeText={setNotes}
                placeholder="أي ملاحظات إضافية..."
                placeholderTextColor={colors.muted}
                style={[styles.input, { height: 74, textAlignVertical: "top" }]}
                multiline
              />
            </View>

            <TouchableOpacity
              testID="submit-activity-button"
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.submitText}>تسجيل النشاط</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "right",
  },
  headerSubtitle: {
    color: "#CBD5E1",
    fontSize: 13,
    marginTop: 4,
    textAlign: "right",
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "600",
    textAlign: "right",
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  inputWrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    minHeight: 52,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: "right",
    paddingVertical: 0,
  },
  readOnly: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: "right",
  },
  submitBtn: {
    flexDirection: "row-reverse",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "bold",
  },
});
