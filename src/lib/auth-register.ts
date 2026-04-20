import { getPanelSameOriginAxios } from "@/lib/panel-same-origin-axios";

export async function registerPanelUser(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string;
}): Promise<void> {
  const { status, data } = await getPanelSameOriginAxios().post<{ message?: string }>("/api/auth/register", payload, {
    validateStatus: () => true,
  });
  const msg =
    typeof data?.message === "string"
      ? data.message
      : typeof data === "object" && data != null && "message" in data
        ? String((data as { message?: unknown }).message ?? "")
        : "";
  if (status < 200 || status >= 300) {
    throw new Error(msg || `Kayıt başarısız (${status})`);
  }
}
