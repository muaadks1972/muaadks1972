import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

// A4 page size (points). 1pt = 1/72 inch.
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

/**
 * Cross-platform PDF export/print using A4 page size.
 * - Web: opens browser's native print dialog (user can "Save as PDF").
 * - Native (iOS/Android): generates PDF file then opens share sheet.
 */
export async function exportOrPrintPdf(html: string): Promise<void> {
  if (Platform.OS === "web") {
    await openWebPrint(html);
    return;
  }

  try {
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
      width: A4_WIDTH,
      height: A4_HEIGHT,
    });
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

  try {
    await Print.printAsync({
      html,
      width: A4_WIDTH,
      height: A4_HEIGHT,
    });
  } catch (e: any) {
    throw new Error(e?.message || "فشل تصدير التقرير");
  }
}

/** Native system print dialog. On web routes to browser print. */
export async function printPdf(html: string): Promise<void> {
  if (Platform.OS === "web") {
    await openWebPrint(html);
    return;
  }
  await Print.printAsync({
    html,
    width: A4_WIDTH,
    height: A4_HEIGHT,
  });
}

async function openWebPrint(html: string): Promise<void> {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    throw new Error("الرجاء السماح بفتح النوافذ المنبثقة للمتصفح");
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      // user can still print manually
    }
  }, 600);
}
