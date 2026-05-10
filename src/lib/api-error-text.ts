/** AuthService ErrorResponse veya ProblemDetail benzeri gövdelerden okunabilir metin. */
export function getJsonErrorText(data: unknown): string {
  if (data == null || typeof data !== "object") return "";
  const o = data as Record<string, unknown>;
  if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
  if (typeof o.detail === "string" && o.detail.trim()) return o.detail.trim();
  if (Array.isArray(o.errors) && o.errors.length > 0) {
    const first = o.errors[0];
    if (typeof first === "string" && first.trim()) return first.trim();
  }
  return "";
}

export const TOTP_WRONG_USER_MESSAGE = "2FA kodu hatalı.";

export function isLikelyWrongTotpBackendText(text: string): boolean {
  const t = text.toLowerCase();
  if (t.includes("invalid verification code")) return true;
  if (t.includes("401 unauthorized") && t.includes("invalid verification")) return true;
  return false;
}
