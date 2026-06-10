import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { colors } from "@/src/theme/colors";

export default function Index() {
  const router = useRouter();
  const { loading, user } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.role === "admin") {
      router.replace("/(admin)");
    } else {
      router.replace("/(employee)");
    }
  }, [loading, user, router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <Text style={styles.title}>الشركة العامة لخدمات الملاحة الجوية</Text>
      <Text style={styles.subtitle}>نظام إدارة أنشطة الصيانة</Text>
      <Text style={styles.engineer}>المهندس معاد كاظم</Text>
      <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 34,
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 15,
    marginTop: 12,
    textAlign: "center",
  },
  engineer: {
    color: "#F59E0B",
    fontSize: 14,
    marginTop: 14,
    textAlign: "center",
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});
