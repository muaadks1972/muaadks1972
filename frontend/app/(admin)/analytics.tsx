import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";
import { colors, radii, spacing } from "@/src/theme/colors";

type DeptRow = { department: string; count: number };
type EmpRow = { user_id: string; employee_name: string; username: string; count: number };
type MonthRow = { month: string; count: number };
type Analytics = {
  period: { start: string; end: string; months: number };
  totals: { activities: number; employees: number; departments_active: number };
  by_department: DeptRow[];
  by_employee: EmpRow[];
  by_month: MonthRow[];
};

const PERIODS = [
  { label: "٣ أشهر", value: 3 },
  { label: "٦ أشهر", value: 6 },
  { label: "١٢ شهر", value: 12 },
];

const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${AR_MONTHS[idx] || m} ${y.slice(2)}`;
}

export default function AnalyticsScreen() {
  const { apiFetch } = useAuth();
  const toast = useToast();
  const [months, setMonths] = useState(6);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/analytics?months=${months}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        toast.show("تعذر تحميل الإحصائيات", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, months, toast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const maxDept = Math.max(1, ...(data?.by_department.map((d) => d.count) || [1]));
  const maxEmp = Math.max(1, ...(data?.by_employee.map((e) => e.count) || [1]));
  const maxMonth = Math.max(1, ...(data?.by_month.map((m) => m.count) || [1]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>لوحة الإحصائيات</Text>
        <Text style={styles.headerSubtitle}>تحليلات الأقسام والإنتاجية</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      >
        {/* Period selector */}
        <View style={styles.periodRow} testID="period-selector">
          {PERIODS.map((p) => {
            const active = p.value === months;
            return (
              <TouchableOpacity
                key={p.value}
                testID={`period-${p.value}`}
                style={[styles.periodChip, active && styles.periodChipActive]}
                onPress={() => setMonths(p.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.periodText, active && styles.periodTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading && !data && (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        )}

        {data && (
          <>
            {/* KPI cards */}
            <View style={styles.kpiRow}>
              <View style={[styles.kpiCard, { backgroundColor: colors.primary }]}>
                <Ionicons name="construct" size={22} color="#fff" />
                <Text style={styles.kpiNum}>{data.totals.activities}</Text>
                <Text style={styles.kpiLabel}>إجمالي الأنشطة</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.secondary }]}>
                <Ionicons name="people" size={22} color="#fff" />
                <Text style={styles.kpiNum}>{data.totals.employees}</Text>
                <Text style={styles.kpiLabel}>موظف نشط</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.accent }]}>
                <Ionicons name="business" size={22} color="#fff" />
                <Text style={styles.kpiNum}>{data.totals.departments_active}</Text>
                <Text style={styles.kpiLabel}>قسم مغطى</Text>
              </View>
            </View>

            {/* Monthly trend */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trending-up" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>الاتجاه الشهري</Text>
              </View>
              <View style={styles.trendRow}>
                {data.by_month.map((m) => {
                  const h = (m.count / maxMonth) * 110;
                  return (
                    <View key={m.month} style={styles.trendCol} testID={`month-bar-${m.month}`}>
                      <Text style={styles.trendCount}>{m.count}</Text>
                      <View style={styles.trendBarTrack}>
                        <View
                          style={[
                            styles.trendBar,
                            { height: Math.max(4, h), backgroundColor: colors.primary },
                          ]}
                        />
                      </View>
                      <Text style={styles.trendLabel}>{monthLabel(m.month)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* By department */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="bar-chart" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>الأقسام الأكثر صيانة</Text>
              </View>
              {data.by_department.length === 0 ? (
                <Text style={styles.emptyText}>لا توجد بيانات للفترة المحددة</Text>
              ) : (
                data.by_department.map((d, idx) => (
                  <View key={d.department} style={styles.barRow} testID={`dept-bar-${d.department}`}>
                    <View style={styles.barTopRow}>
                      <Text style={styles.barCount}>{d.count}</Text>
                      <View style={styles.barLabelWrap}>
                        {idx === 0 && (
                          <View style={styles.topBadge}>
                            <Ionicons name="trophy" size={11} color="#fff" />
                          </View>
                        )}
                        <Text style={styles.barLabel} numberOfLines={1}>{d.department}</Text>
                      </View>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${(d.count / maxDept) * 100}%`,
                            backgroundColor: idx === 0 ? colors.accent : colors.secondary,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* By employee */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="ribbon" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>إنتاجية الموظفين</Text>
              </View>
              {data.by_employee.length === 0 ? (
                <Text style={styles.emptyText}>لا توجد بيانات للفترة المحددة</Text>
              ) : (
                data.by_employee.map((e, idx) => {
                  const isAdmin = e.username === "admin";
                  return (
                    <View key={e.user_id} style={styles.empRow} testID={`emp-row-${e.user_id}`}>
                      <View style={[styles.rankBadge, idx === 0 && { backgroundColor: colors.accent }]}>
                        <Text style={styles.rankText}>{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.empNameRow}>
                          <Text style={styles.empName} numberOfLines={1}>
                            {e.employee_name}
                          </Text>
                          {isAdmin && (
                            <View style={styles.adminTag}>
                              <Text style={styles.adminTagText}>مدير</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.empBarTrack}>
                          <View
                            style={[
                              styles.empBarFill,
                              {
                                width: `${(e.count / maxEmp) * 100}%`,
                                backgroundColor: idx === 0 ? colors.accent : colors.primary,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={styles.empCount}>{e.count}</Text>
                    </View>
                  );
                })
              )}
            </View>

            <Text style={styles.periodFooter}>
              الفترة: من {data.period.start} إلى {data.period.end}
            </Text>
          </>
        )}
      </ScrollView>
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
  scroll: { padding: spacing.md, paddingBottom: 100 },

  periodRow: {
    flexDirection: "row-reverse",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  periodChip: {
    flex: 1,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  periodChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodText: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  periodTextActive: { color: "#fff" },

  kpiRow: { flexDirection: "row-reverse", gap: spacing.sm, marginBottom: spacing.md },
  kpiCard: {
    flex: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: "center",
    gap: 4,
  },
  kpiNum: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  kpiLabel: { color: "rgba(255,255,255,0.9)", fontSize: 11, textAlign: "center" },

  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: colors.textPrimary },
  emptyText: {
    textAlign: "center",
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
  },

  // Trend chart
  trendRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    justifyContent: "space-around",
    height: 170,
    gap: 4,
  },
  trendCol: { alignItems: "center", flex: 1 },
  trendBarTrack: {
    width: "70%",
    height: 110,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  trendBar: { width: "100%", borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  trendCount: { fontSize: 11, color: colors.textPrimary, marginBottom: 4, fontWeight: "bold" },
  trendLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 6, textAlign: "center" },

  // Department bars
  barRow: { marginBottom: spacing.sm },
  barTopRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  barLabelWrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  barLabel: { fontSize: 13, color: colors.textPrimary, fontWeight: "600", flexShrink: 1 },
  barCount: { fontSize: 14, color: colors.primary, fontWeight: "bold" },
  topBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  barTrack: {
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 4 },

  // Employee rows
  empRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  empNameRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 4 },
  empName: { fontSize: 13, color: colors.textPrimary, fontWeight: "600", maxWidth: "70%" },
  empBarTrack: { height: 6, backgroundColor: colors.background, borderRadius: 3, overflow: "hidden" },
  empBarFill: { height: "100%", borderRadius: 3 },
  empCount: { fontSize: 14, color: colors.primary, fontWeight: "bold", minWidth: 30, textAlign: "center" },
  adminTag: { backgroundColor: colors.accent, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  adminTagText: { color: "#fff", fontSize: 9, fontWeight: "bold" },

  periodFooter: {
    textAlign: "center",
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: spacing.sm,
  },
});
