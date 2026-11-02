export async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; fields?: Record<string, string> }
> {
  try {
    const headers = new Headers(init?.headers);
    if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...init, headers });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      fields?: Record<string, string>;
    };
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data.error || "請求失敗",
        fields: data.fields,
      };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, error: "網絡未連接" };
  }
}

export function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/login") || value.startsWith("/register") || value.startsWith("/api")) return "/";
  return value;
}
