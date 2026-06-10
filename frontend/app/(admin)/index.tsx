import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/components/Toast";
import { exportOrPrintPdf, printPdf } from "@/src/utils/pdf";
import { colors, radii, spacing } from "@/src/theme/colors";

type Activity = {
  id: string;
  date: string;
  nature_of_work: string;
  department: string;
  notes: string;
};

type Group = {
  user_id: string;
  employee_name: string;
  username: string;
  activities: Activity[];
};

type Report = {
  week_start: string;
  week_end: string;
  total_activities: number;
  total_employees: number;
  groups: Group[];
};

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getLastSaturday(): Date {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun..6=Sat
  // Saturday = 6
  const offset = (dow + 1) % 7; // days since last Saturday
  const d = new Date(today);
  d.setDate(today.getDate() - offset);
  return d;
}

export default function WeeklyReportScreen() {
  const { apiFetch } = useAuth();
  const toast = useToast();
  const [weekStart, setWeekStart] = useState<Date>(getLastSaturday());
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/report/weekly?week_start=${formatDate(weekStart)}`);
      if (res.ok) {
        setReport(await res.json());
      } else {
        toast.show("تعذر تحميل التقرير", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, weekStart, toast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const buildHtml = (r: Report): string => {
    const rows = r.groups
      .map((g) => {
        const acts = g.activities
          .map(
            (a) => `
            <tr>
              <td>${escapeHtml(a.date)}</td>
              <td>${escapeHtml(a.department)}</td>
              <td>${escapeHtml(a.nature_of_work)}</td>
              <td>${escapeHtml(a.notes || "-")}</td>
            </tr>`
          )
          .join("");
        return `
          <div class="employee-block">
            <h3>${escapeHtml(g.employee_name)} <span class="uname">(@${escapeHtml(g.username)})</span> — ${g.activities.length} نشاط</h3>
            <table>
              <thead>
                <tr><th>التاريخ</th><th>القسم</th><th>طبيعة العمل</th><th>الملاحظات</th></tr>
              </thead>
              <tbody>${acts}</tbody>
            </table>
          </div>`;
      })
      .join("");

    return `
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, "Segoe UI", Tahoma, Arial, sans-serif; direction: rtl; padding: 32px; color: #0F172A; }
          .header { text-align: center; border-bottom: 3px solid #0A2540; padding-bottom: 16px; margin-bottom: 24px; }
          .header h1 { color: #0A2540; font-size: 22px; margin: 0; }
          .header h2 { color: #0EA5E9; font-size: 16px; margin: 8px 0 0; font-weight: normal; }
          .meta { display: flex; justify-content: space-around; background: #F1F5F9; padding: 12px; border-radius: 8px; margin-bottom: 24px; }
          .meta div { text-align: center; }
          .meta .num { font-size: 22px; font-weight: bold; color: #0A2540; }
          .meta .lbl { font-size: 12px; color: #64748B; }
          .employee-block { margin-bottom: 28px; page-break-inside: avoid; }
          h3 { color: #0A2540; border-right: 4px solid #F59E0B; padding-right: 10px; margin-bottom: 8px; }
          .uname { color: #64748B; font-weight: normal; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #E2E8F0; padding: 8px; text-align: right; font-size: 13px; }
          th { background: #0A2540; color: #fff; font-weight: bold; }
          tr:nth-child(even) { background: #F8FAFC; }
          .footer { text-align: center; margin-top: 30px; padding-top: 12px; border-top: 1px solid #E2E8F0; color: #64748B; font-size: 11px; }
          .empty { text-align: center; padding: 40px; color: #94A3B8; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>الشركة العامة لخدمات الملاحة الجوية</h1>
          <h2>التقرير الأسبوعي لأنشطة الصيانة</h2>
          <p style="margin: 8px 0 0; color: #475569;">الفترة: من ${r.week_start} إلى ${r.week_end}</p>
        </div>
        <div class="meta">
          <div><div class="num">${r.total_activities}</div><div class="lbl">إجمالي الأنشطة</div></div>
          <div><div class="num">${r.total_employees}</div><div class="lbl">عدد الموظفين</div></div>
        </div>
        ${r.groups.length === 0 ? '<div class="empty">لا توجد أنشطة مسجلة خلال هذا الأسبوع</div>' : rows}
        <div class="footer">تم إنشاء التقرير في ${new Date().toLocaleString("ar-IQ")}</div>
      </body>
      </html>`;
  };

  const onExportPdf = async () => {
    if (!report) return;
    setExporting(true);
    try {
      await exportOrPrintPdf(buildHtml(report));
    } catch (e: any) {
      toast.show(e?.message || "فشل التصدير", "error");
    } finally {
      setExporting(false);
    }
  };

  const onPrint = async () => {
    if (!report) return;
    try {
      await printPdf(buildHtml(report));
    } catch (e: any) {
      toast.show(e?.message || "فشل الطباعة", "error");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>التقرير الأسبوعي</Text>
        <Text style={styles.headerSubtitle}>الشركة العامة لخدمات الملاحة الجوية</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>بداية الأسبوع (السبت)</Text>
          <TouchableOpacity
            testID="week-start-picker"
            style={styles.dateField}
            onPress={() => setShowPicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.dateText}>{formatDate(weekStart)}</Text>
          </TouchableOpacity>
          {showPicker && (
            <DateTimePicker
              value={weekStart}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, sel) => {
                setShowPicker(Platform.OS === "ios");
                if (sel) setWeekStart(sel);
              }}
            />
          )}
          <TouchableOpacity testID="load-report-button" style={styles.loadBtn} onPress={load}>
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.loadText}>تحديث التقرير</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />}

        {report && !loading && (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{report.total_activities}</Text>
                <Text style={styles.statLabel}>الأنشطة</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{report.total_employees}</Text>
                <Text style={styles.statLabel}>الموظفون</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNum, { fontSize: 13 }]}>{report.week_end}</Text>
                <Text style={styles.statLabel}>نهاية الأسبوع</Text>
              </View>
            </View>

            <View style={styles.exportRow}>
              <TouchableOpacity
                testID="export-pdf-button"
                style={[styles.exportBtn, { backgroundColor: colors.accent }]}
                onPress={onExportPdf}
                disabled={exporting}
              >
                {exporting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="document-text" size={18} color="#fff" />
                    <Text style={styles.exportText}>تصدير PDF</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                testID="print-button"
                style={[styles.exportBtn, { backgroundColor: colors.primary }]}
                onPress={onPrint}
              >
                <Ionicons name="print" size={18} color="#fff" />
                <Text style={styles.exportText}>طباعة</Text>
              </TouchableOpacity>
            </View>

            {report.groups.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="folder-open-outline" size={56} color={colors.muted} />
                <Text style={styles.emptyTitle}>لا توجد أنشطة خلال هذا الأسبوع</Text>
              </View>
            ) : (
              report.groups.map((g) => (
                <View key={g.user_id} style={styles.groupCard} testID={`group-${g.user_id}`}>
                  <View style={styles.groupHeader}>
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{g.activities.length}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.groupName}>{g.employee_name}</Text>
                      <Text style={styles.groupUser}>@{g.username}</Text>
                    </View>
                  </View>
                  {g.activities.map((a) => (
                    <View key={a.id} style={styles.activityRow}>
                      <View style={styles.activityHead}>
                        <Text style={styles.activityDept}>{a.department}</Text>
                        <Text style={styles.activityDate}>{a.date}</Text>
                      </View>
                      <Text style={styles.activityWork}>{a.nature_of_work}</Text>
                      {!!a.notes && <Text style={styles.activityNotes}>ملاحظات: {a.notes}</Text>}
                    </View>
                  ))}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, textAlign: "right", marginBottom: spacing.sm },
  dateField: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 48,
    backgroundColor: colors.background,
  },
  dateText: { flex: 1, fontSize: 15, color: colors.textPrimary, textAlign: "right" },
  loadBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    height: 46,
    marginTop: spacing.md,
  },
  loadText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  statsRow: { flexDirection: "row-reverse", gap: spacing.sm, marginTop: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statNum: { fontSize: 24, fontWeight: "bold", color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  exportRow: { flexDirection: "row-reverse", gap: spacing.sm, marginTop: spacing.md },
  exportBtn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 48,
    borderRadius: radii.md,
  },
  exportText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { color: colors.textSecondary, fontSize: 15, marginTop: spacing.md },
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  countBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  groupName: { fontSize: 16, fontWeight: "bold", color: colors.textPrimary, textAlign: "right" },
  groupUser: { fontSize: 12, color: colors.textSecondary, textAlign: "right" },
  activityRow: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  activityHead: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 4 },
  activityDept: { color: colors.primary, fontWeight: "bold", fontSize: 13 },
  activityDate: { color: colors.textSecondary, fontSize: 12 },
  activityWork: { color: colors.textPrimary, fontSize: 14, textAlign: "right", lineHeight: 20 },
  activityNotes: { color: colors.textSecondary, fontSize: 12, marginTop: 4, textAlign: "right" },
});
