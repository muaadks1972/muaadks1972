import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/src/theme/colors";

export const DEPARTMENTS = [
  "الموارد البشرية",
  "المالي",
  "التدقيق",
  "التخطيط",
  "مكتب المدير العام",
  "الفني",
  "الاتصالات",
  "الحركة الجوية",
  "السلامة",
  "معلومات الطيران",
  "التدريب",
  "الجودة",
  "تمكين المرأة",
  "الإعلام",
];

type Props = {
  value: string | null;
  onChange: (dept: string) => void;
  placeholder?: string;
  testID?: string;
  includeAllOption?: boolean;
};

export default function DepartmentPicker({
  value,
  onChange,
  placeholder = "اختر القسم",
  testID = "department-picker",
  includeAllOption = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const options = includeAllOption ? ["كل الأقسام", ...DEPARTMENTS] : DEPARTMENTS;

  return (
    <>
      <TouchableOpacity
        testID={testID}
        style={styles.field}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
        <Text
          style={[
            styles.fieldText,
            !value && { color: colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.title}>اختيار القسم</Text>
              <TouchableOpacity onPress={() => setOpen(false)} testID="dept-close">
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(i) => i}
              renderItem={({ item }) => {
                const selected = item === value || (includeAllOption && item === "كل الأقسام" && !value);
                return (
                  <TouchableOpacity
                    testID={`dept-option-${item}`}
                    style={[styles.option, selected && styles.optionSelected]}
                    onPress={() => {
                      if (includeAllOption && item === "كل الأقسام") {
                        onChange("");
                      } else {
                        onChange(item);
                      }
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {item}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    height: 52,
    gap: spacing.sm,
  },
  fieldText: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: "right",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    maxHeight: "75%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textPrimary,
    textAlign: "right",
  },
  option: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionSelected: {
    backgroundColor: "#EFF6FF",
  },
  optionText: {
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: "right",
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: "bold",
  },
});
