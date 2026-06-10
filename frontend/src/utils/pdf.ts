import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

/**
 * Cross-platform PDF export/print.
 * - Web: opens browser's native print dialog (user can "Save as PDF").
 * - Native (iOS/Android): generates PDF file then opens share sheet.
 * Falls back to system print dialog if anything fails.
 */
export async function exportOrPrintPdf(html: string): Promise<void> {
  // Web: browser print dialog is the only reliable path.
  if (Platform.OS === "web") {
    await openWebPrint(html);
    return;
  }

  // Native: try generate file then share
  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        UTI: "com.adobe.pdf",
        mimeType: "application/pdf",
        dialogTitle: "تصدير التقرير",
      });
      return;
    }
  } catch {
    // fall through to printAsync
  }

  // Fallback: open system print preview
  try {
    await Print.printAsync({ html });
  } catch (e: any) {
    throw new Error(e?.message || "فشل تصدير التقرير");
  }
}

/**
 * Open native system print dialog. On web also routes to browser print.
 */
export async function printPdf(html: string): Promise<void> {
  if (Platform.OS === "web") {
    await openWebPrint(html);
    return;
  }
  await Print.printAsync({ html });
}

async function openWebPrint(html: string): Promise<void> {
  // Open new window and trigger print dialog (allows Save as PDF).
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    throw new Error("الرجاء السماح بفتح النوافذ المنبثقة للمتصفح");
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Wait for fonts/images
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      // user can still print manually
    }
  }, 600);
}
