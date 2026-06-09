import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";
import { colors, radii, spacing } from "@/src/theme/colors";

type Activity = {
  id: string;
  date: string;
  nature_of_work: string;
  department: string;
  notes: string;
  created_at: string;
};

export default function HistoryScreen() {
  const { apiFetch } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Activity[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await apiFetch("/api/activities/me");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } finally {
      setRefreshing(false);
    }
  }, [apiFetch]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onDelete = async (id: string) => {
    const res = await apiFetch(`/api/activities/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.show("تم حذف النشاط", "success");
      setItems((prev) => prev.filter((a) => a.id !== id));
    } else {
      toast.show("تعذر الحذف", "error");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>نشاطاتي</Text>
        <Text style={styles.headerSubtitle}>سجل كامل لأنشطة الصيانة المسجلة</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={
          !refreshing ? (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={56} color={colors.muted} />
              <Text style={styles.emptyTitle}>لا توجد أنشطة بعد</Text>
              <Text style={styles.emptySub}>سجّل نشاط الصيانة الأول من علامة نشاط جديد</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card} testID={`activity-card-${item.id}`}>
            <View style={styles.cardHeader}>
              <View style={styles.deptBadge}>
                <Ionicons name="business-outline" size={14} color={colors.primary} />
                <Text style={styles.deptText}>{item.department}</Text>
              </View>
              <View style={styles.dateBadge}>
                <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.dateText}>{item.date}</Text>
              </View>
            </View>
            <Text style={styles.natureText}>{item.nature_of_work}</Text>
            {!!item.notes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>ملاحظات:</Text>
                <Text style={styles.notesText}>{item.notes}</Text>
              </View>
            )}
            <TouchableOpacity
              testID={`delete-activity-${item.id}`}
              style={styles.deleteBtn}
              onPress={() => onDelete(item.id)}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={styles.deleteText}>حذف</Text>
            </TouchableOpacity>
          </View>
        )}
      />
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
  headerSubtitle: { color: "#CBD5E1", fontSize: 13, marginTop: 4, textAlign: "right" },
  list: { padding: spacing.lg, paddingBottom: 100, flexGrow: 1 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: colors.textPrimary, marginTop: spacing.md },
  emptySub: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  deptBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  deptText: { color: colors.primary, fontSize: 12, fontWeight: "bold" },
  dateBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  dateText: { color: colors.textSecondary, fontSize: 12 },
  natureText: {
    fontSize: 15,
    color: colors.textPrimary,
    textAlign: "right",
    lineHeight: 22,
  },
  notesBox: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notesLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: "600", textAlign: "right" },
  notesText: { fontSize: 14, color: colors.textPrimary, marginTop: 2, textAlign: "right" },
  deleteBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: spacing.sm,
  },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: "600" },
});
