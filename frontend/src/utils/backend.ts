import { storage } from "@/src/utils/storage";

const BACKEND_URL_KEY = "ans_backend_url";
const DEFAULT_BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || "";

/**
 * Resolves the backend URL: custom (user-overridden) takes precedence, then env.
 */
export async function getBackendUrl(): Promise<string> {
  try {
    const custom = await storage.get<string>(BACKEND_URL_KEY, "");
    if (custom && custom.trim()) return custom.trim().replace(/\/+$/, "");
  } catch {
    // ignore
  }
  return DEFAULT_BACKEND.replace(/\/+$/, "");
}

export async function setBackendUrl(url: string): Promise<void> {
  await storage.set(BACKEND_URL_KEY, url.trim().replace(/\/+$/, ""));
}

export async function clearBackendUrl(): Promise<void> {
  await storage.remove(BACKEND_URL_KEY);
}

export function getDefaultBackendUrl(): string {
  return DEFAULT_BACKEND.replace(/\/+$/, "");
}

/**
 * Probe the backend root endpoint and return ok+latency or error.
 */
export async function testBackendConnection(url: string): Promise<{
  ok: boolean;
  status?: number;
  message: string;
  latencyMs?: number;
}> {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return { ok: false, message: "الرابط فارغ" };
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, message: "يجب أن يبدأ بـ https:// أو http://" };
  }
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${trimmed}/api/`, { signal: controller.signal });
    clearTimeout(timeout);
    const latency = Date.now() - started;
    if (res.ok) {
      return { ok: true, status: res.status, message: "الاتصال ناجح", latencyMs: latency };
    }
    return {
      ok: false,
      status: res.status,
      message: `استجابة غير ناجحة (HTTP ${res.status})`,
      latencyMs: latency,
    };
  } catch (e: any) {
    return {
      ok: false,
      message: e?.name === "AbortError" ? "انتهت مهلة الاتصال" : (e?.message || "فشل الاتصال"),
    };
  }
}
