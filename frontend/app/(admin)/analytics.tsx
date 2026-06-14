import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";
import { exportOrPrintPdf } from "@/src/utils/pdf";
import { colors, radii, spacing } from "@/src/theme/colors";

type DeptRow = { department: string; count: number };
type EmpRow = { user_id: string; employee_name: string; username: string; count: number };
type MonthRow = { month: string; count: number };
type Totals = { activities: number; employees: number; departments_active: number };
type Deltas = { activities: number | null; employees: number | null; departments_active: number | null };
type Analytics = {
  period: { start: string; end: string; months: number };
  previous_period: { start: string; end: string };
  exclude_admin: boolean;
  totals: Totals;
  previous_totals: Totals;
  deltas: Deltas;
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

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function deltaText(d: number | null): string {
  if (d === null) return "—";
  const sign = d > 0 ? "+" : "";
  return `${sign}${d}%`;
}

function deltaColor(d: number | null): string {
  if (d === null || d === 0) return colors.textSecondary;
  return d > 0 ? colors.success : colors.danger;
}

export default function AnalyticsScreen() {
  const { apiFetch } = useAuth();
  const toast = useToast();
  const [months, setMonths] = useState(6);
  const [excludeAdmin, setExcludeAdmin] = useState(false);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/admin/analytics?months=${months}&exclude_admin=${excludeAdmin}`
      );
      if (res.ok) {
        setData(await res.json());
      } else {
        toast.show("تعذر تحميل الإحصائيات", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, months, excludeAdmin, toast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const maxDept = Math.max(1, ...(data?.by_department.map((d) => d.count) || [1]));
  const maxEmp = Math.max(1, ...(data?.by_employee.map((e) => e.count) || [1]));
  const maxMonth = Math.max(1, ...(data?.by_month.map((m) => m.count) || [1]));

  const buildHtml = (r: Analytics): string => {
    const deptRows = r.by_department
      .map(
        (d, idx) => `
        <tr>
          <td style="text-align:center">${idx + 1}${idx === 0 ? " 🏆" : ""}</td>
          <td>${escapeHtml(d.department)}</td>
          <td style="text-align:center">${d.count}</td>
          <td style="text-align:center">${Math.round((d.count / r.totals.activities) * 100) || 0}%</td>
        </tr>`
      )
      .join("");

    const empRows = r.by_employee
      .map(
        (e, idx) => `
        <tr>
          <td style="text-align:center">${idx + 1}</td>
          <td>${escapeHtml(e.employee_name)}</td>
          <td>@${escapeHtml(e.username)}</td>
          <td style="text-align:center">${e.count}</td>
        </tr>`
      )
      .join("");

    const monthRows = r.by_month
      .map(
        (m) => `
        <tr>
          <td>${escapeHtml(monthLabel(m.month))}</td>
          <td style="text-align:center">${m.count}</td>
        </tr>`
      )
      .join("");

    const deltaBlock = (label: string, cur: number, prev: number, delta: number | null) => {
      const color = delta === null || delta === 0 ? "#64748B" : delta > 0 ? "#10B981" : "#EF4444";
      const sign = delta !== null && delta > 0 ? "+" : "";
      const arrow = delta === null ? "" : delta > 0 ? "▲" : delta < 0 ? "▼" : "■";
      return `
        <div class="kpi">
          <div class="kpi-label">${label}</div>
          <div class="kpi-num">${cur}</div>
          <div class="kpi-delta" style="color:${color}">${arrow} ${delta === null ? "—" : sign + delta + "%"} <span style="color:#94A3B8;font-size:11px"> مقارنة بـ ${prev}</span></div>
        </div>`;
    };

    return `
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 18mm 16mm; }
          body { font-family: -apple-system, "Segoe UI", Tahoma, Arial, sans-serif; direction: rtl; color: #0F172A; margin: 0; font-size: 13px; }
          .header { text-align: center; border-bottom: 3px solid #0A2540; padding-bottom: 14px; margin-bottom: 20px; }
          .header h1 { color: #0A2540; font-size: 22px; margin: 0; }
          .header h2 { color: #0EA5E9; font-size: 15px; margin: 6px 0 0; font-weight: normal; }
          .signature { text-align: center; color: #F59E0B; font-weight: bold; font-size: 13px; margin-top: 8px; }
          .meta { background: #F1F5F9; padding: 10px 16px; border-radius: 8px; margin-bottom: 18px; font-size: 12px; color: #475569; display:flex; justify-content:space-between; }
          .kpis { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 22px; }
          .kpi { flex: 1; background: #fff; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px; text-align: center; }
          .kpi-label { color: #64748B; font-size: 11px; margin-bottom: 5px; }
          .kpi-num { font-size: 26px; font-weight: bold; color: #0A2540; }
          .kpi-delta { font-size: 12px; font-weight: bold; margin-top: 4px; }
          section { margin-bottom: 22px; page-break-inside: avoid; }
          h3 { color: #0A2540; border-right: 4px solid #F59E0B; padding-right: 10px; margin-bottom: 8px; font-size: 15px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #E2E8F0; padding: 7px; text-align: right; font-size: 12px; }
          th { background: #0A2540; color: #fff; font-weight: bold; }
          tr:nth-child(even) { background: #F8FAFC; }
          .footer { text-align: center; margin-top: 22px; padding-top: 10px; border-top: 1px solid #E2E8F0; color: #64748B; font-size: 10px; }
          .badge { display:inline-block; background:#F59E0B; color:#fff; padding:2px 8px; border-radius:999px; font-size:11px; margin-right:6px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>الشركة العامة لخدمات الملاحة الجوية</h1>
          <h2>التقرير الإداري الشهري — إحصائيات الصيانة</h2>
          <div class="signature">المهندس معاد كاظم</div>
        </div>

        <div class="meta">
          <div>الفترة الحالية: ${r.period.start} → ${r.period.end} (${r.period.months} شهر)</div>
          <div>${r.exclude_admin ? '<span class="badge">بدون المدير</span>' : ""}الفترة السابقة: ${r.previous_period.start} → ${r.previous_period.end}</div>
        </div>

        <div class="kpis">
          ${deltaBlock("إجمالي الأنشطة", r.totals.activities, r.previous_totals.activities, r.deltas.activities)}
          ${deltaBlock("الموظفون النشطون", r.totals.employees, r.previous_totals.employees, r.deltas.employees)}
          ${deltaBlock("الأقسام المغطاة", r.totals.departments_active, r.previous_totals.departments_active, r.deltas.departments_active)}
        </div>

        <section>
          <h3>الأقسام الأكثر صيانة</h3>
          <table>
            <thead><tr><th style="width:40px">#</th><th>القسم</th><th style="width:70px">العدد</th><th style="width:70px">النسبة</th></tr></thead>
            <tbody>${deptRows || '<tr><td colspan="4" style="text-align:center;color:#94A3B8">لا توجد بيانات</td></tr>'}</tbody>
          </table>
        </section>

        <section>
          <h3>إنتاجية الموظفين</h3>
          <table>
            <thead><tr><th style="width:40px">المرتبة</th><th>الاسم</th><th>اسم المستخدم</th><th style="width:70px">عدد الأنشطة</th></tr></thead>
            <tbody>${empRows || '<tr><td colspan="4" style="text-align:center;color:#94A3B8">لا توجد بيانات</td></tr>'}</tbody>
          </table>
        </section>

        <section>
          <h3>الاتجاه الشهري</h3>
          <table>
            <thead><tr><th>الشهر</th><th style="width:100px">عدد الأنشطة</th></tr></thead>
            <tbody>${monthRows}</tbody>
          </table>
        </section>

        <div class="footer">تم إنشاء التقرير في ${new Date().toLocaleString("ar-IQ")}</div>
      </body>
      </html>`;
  };

  const onExportPdf = async () => {
    if (!data) return;
    setExporting(true);
    try {
      await exportOrPrintPdf(buildHtml(data));
    } catch (e: any) {
      toast.show(e?.message || "فشل التصدير", "error");
    } finally {
      setExporting(false);
    }
  };

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

        {/* Exclude admin toggle */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleLeft}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.textSecondary} />
            <View>
              <Text style={styles.toggleLabel}>تجاهل حساب المدير</Text>
              <Text style={styles.toggleHint}>عرض إنتاجية الموظفين فقط</Text>
            </View>
          </View>
          <Switch
            testID="exclude-admin-switch"
            value={excludeAdmin}
            onValueChange={setExcludeAdmin}
            trackColor={{ false: "#CBD5E1", true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        {/* Export button */}
        {data && (
          <TouchableOpacity
            testID="export-analytics-pdf"
            style={styles.exportBtn}
            onPress={onExportPdf}
            disabled={exporting}
            activeOpacity={0.85}
          >
            {exporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="document-text" size={18} color="#fff" />
                <Text style={styles.exportText}>تصدير PDF الإداري الشهري</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {loading && !data && (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        )}

        {data && (
          <>
            {/* KPI cards with comparison */}
            <View style={styles.kpiRow}>
              <KpiCard
                icon="construct"
                value={data.totals.activities}
                label="الأنشطة"
                delta={data.deltas.activities}
                color={colors.primary}
                testID="kpi-activities"
              />
              <KpiCard
                icon="people"
                value={data.totals.employees}
                label="موظف نشط"
                delta={data.deltas.employees}
                color={colors.secondary}
                testID="kpi-employees"
              />
              <KpiCard
                icon="business"
                value={data.totals.departments_active}
                label="قسم مغطى"
                delta={data.deltas.departments_active}
                color={colors.accent}
                testID="kpi-departments"
              />
            </View>

            <Text style={styles.comparisonHint}>
              مقارنة بالفترة السابقة: {data.previous_period.start} → {data.previous_period.end}
            </Text>

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

function KpiCard({
  icon,
  value,
  label,
  delta,
  color,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  delta: number | null;
  color: string;
  testID: string;
}) {
  const arrow = delta === null ? "" : delta > 0 ? "▲" : delta < 0 ? "▼" : "■";
  return (
    <View style={[styles.kpiCard, { backgroundColor: color }]} testID={testID}>
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={styles.kpiNum}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      <View style={styles.kpiDeltaPill}>
        <Text style={[styles.kpiDeltaText, { color: deltaColor(delta) }]}>
          {arrow} {deltaText(delta)}
        </Text>
      </View>
    </View>
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
    marginBottom: spacing.sm,
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

  toggleCard: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  toggleLeft: { flexDirection: "row-reverse", alignItems: "center", gap: spacing.sm },
  toggleLabel: { fontSize: 14, fontWeight: "600", color: colors.textPrimary, textAlign: "right" },
  toggleHint: { fontSize: 11, color: colors.textSecondary, textAlign: "right" },

  exportBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    height: 50,
    marginBottom: spacing.md,
  },
  exportText: { color: "#fff", fontWeight: "bold", fontSize: 15 },

  kpiRow: { flexDirection: "row-reverse", gap: spacing.sm, marginBottom: spacing.xs },
  kpiCard: {
    flex: 1,
    borderRadius: radii.lg,
    padding: spacing.sm,
    alignItems: "center",
    gap: 2,
  },
  kpiNum: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  kpiLabel: { color: "rgba(255,255,255,0.9)", fontSize: 11, textAlign: "center" },
  kpiDeltaPill: {
    marginTop: 4,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  kpiDeltaText: { fontSize: 10, fontWeight: "bold" },

  comparisonHint: {
    textAlign: "center",
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },

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
