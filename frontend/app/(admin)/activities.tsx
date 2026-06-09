import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";
import DepartmentPicker from "@/src/components/DepartmentPicker";
import { colors, radii, spacing } from "@/src/theme/colors";

type Activity = {
  id: string;
  user_id: string;
  employee_name: string;
  username: string;
  date: string;
  nature_of_work: string;
  department: string;
  notes: string;
};

export default function AllActivitiesScreen() {
  const { apiFetch } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Activity[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [department, setDepartment] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const q = department ? `?department=${encodeURIComponent(department)}` : "";
      const res = await apiFetch(`/api/admin/activities${q}`);
      if (res.ok) setItems(await res.json());
    } finally {
      setRefreshing(false);
    }
  }, [apiFetch, department]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onDelete = async (id: string) => {
    const res = await apiFetch(`/api/activities/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.show("تم الحذف", "success");
      setItems((prev) => prev.filter((a) => a.id !== id));
    } else {
      toast.show("تعذر الحذف", "error");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>كل أنشطة الصيانة</Text>
        <Text style={styles.headerSubtitle}>{items.length} نشاط</Text>
      </View>

      <View style={styles.filterRow}>
        <View style={{ flex: 1 }}>
          <DepartmentPicker
            value={department}
            onChange={(d) => setDepartment(d || null)}
            placeholder="فلترة بالقسم"
            includeAllOption
            testID="filter-department"
          />
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
              <Ionicons name="file-tray-outline" size={56} color={colors.muted} />
              <Text style={styles.emptyText}>لا توجد أنشطة</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card} testID={`admin-activity-${item.id}`}>
            <View style={styles.cardTop}>
              <View style={styles.empBadge}>
                <Ionicons name="person" size={14} color="#fff" />
                <Text style={styles.empText}>{item.employee_name}</Text>
              </View>
              <Text style={styles.dateText}>{item.date}</Text>
            </View>
            <View style={styles.deptBadge}>
              <Ionicons name="business-outline" size={13} color={colors.primary} />
              <Text style={styles.deptText}>{item.department}</Text>
            </View>
            <Text style={styles.workText}>{item.nature_of_work}</Text>
            {!!item.notes && <Text style={styles.notesText}>ملاحظات: {item.notes}</Text>}
            <TouchableOpacity
              testID={`admin-delete-${item.id}`}
              style={styles.deleteBtn}
              onPress={() => onDelete(item.id)}
            >
              <Ionicons name="trash-outline" size={15} color={colors.danger} />
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
  filterRow: { padding: spacing.md, paddingBottom: 0 },
  list: { padding: spacing.md, paddingBottom: 100, flexGrow: 1 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyText: { color: colors.textSecondary, fontSize: 15, marginTop: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  cardTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  empBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  empText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  dateText: { color: colors.textSecondary, fontSize: 12 },
  deptBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    marginBottom: spacing.sm,
  },
  deptText: { color: colors.primary, fontSize: 12, fontWeight: "bold" },
  workText: { fontSize: 15, color: colors.textPrimary, textAlign: "right", lineHeight: 22 },
  notesText: { fontSize: 13, color: colors.textSecondary, textAlign: "right", marginTop: 6 },
  deleteBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: spacing.sm,
  },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: "600" },
});
