import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

// Mobile-like page size (points). 1pt = 1/72 inch.
// 360pt ≈ 5 inches wide (similar to a phone in portrait).
const MOBILE_PAGE_WIDTH = 360;
const MOBILE_PAGE_HEIGHT = 800;

/**
 * Cross-platform PDF export/print using a mobile-sized page.
 * - Web: opens browser's native print dialog (user can "Save as PDF").
 * - Native (iOS/Android): generates PDF file then opens share sheet.
 * Falls back to system print dialog if anything fails.
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
      width: MOBILE_PAGE_WIDTH,
      height: MOBILE_PAGE_HEIGHT,
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
      width: MOBILE_PAGE_WIDTH,
      height: MOBILE_PAGE_HEIGHT,
    });
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
  await Print.printAsync({
    html,
    width: MOBILE_PAGE_WIDTH,
    height: MOBILE_PAGE_HEIGHT,
  });
}

async function openWebPrint(html: string): Promise<void> {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "width=420,height=900");
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
