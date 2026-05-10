"use client";

import axios, { AxiosError } from "axios";

import { ApiError } from "@/lib/api/errors";
import {
  getJsonErrorText,
  isLikelyWrongTotpBackendText,
  TOTP_WRONG_USER_MESSAGE,
} from "@/lib/api-error-text";
import { clearRentApiGatewayAuthCache } from "@/lib/rent-api";

export interface TwoFactorSetupPayload {
  secret: string;
  issuer: string;
  accountLabel: string;
  qrImageBase64: string;
  otpAuthUri: string;
}

function toApiError(e: unknown, fallback: string): ApiError {
  const err = e as AxiosError<{ message?: string }>;
  return new ApiError(
    err.response?.status ?? 0,
    err.response?.data?.message ?? err.message ?? fallback,
    err.response?.data,
  );
}

function toTotpSubmitApiError(e: unknown, fallback: string): ApiError {
  if (e instanceof ApiError) {
    const from = e.message;
    if (isLikelyWrongTotpBackendText(from)) {
      return new ApiError(e.status, TOTP_WRONG_USER_MESSAGE, e.data);
    }
    if (e.status === 401) {
      if (/oturum|token|giriş|yetkisiz/i.test(from)) {
        return e;
      }
      return new ApiError(e.status, TOTP_WRONG_USER_MESSAGE, e.data);
    }
    return e;
  }
  const err = e as AxiosError<unknown>;
  const status = err.response?.status ?? 0;
  const from = getJsonErrorText(err.response?.data);
  if (isLikelyWrongTotpBackendText(from)) {
    return new ApiError(status, TOTP_WRONG_USER_MESSAGE, err.response?.data);
  }
  if (status === 401) {
    if (/oturum|token|giriş|yetkisiz/i.test(from)) {
      return new ApiError(status, from || fallback, err.response?.data);
    }
    return new ApiError(status, TOTP_WRONG_USER_MESSAGE, err.response?.data);
  }
  return toApiError(e, fallback);
}

export const authService = {
  async login(params: { email: string; password: string }) {
    try {
      const { data } = await axios.post("/api/auth/login", params, { withCredentials: true });
      return data;
    } catch (e) {
      throw toApiError(e, "Giriş başarısız");
    }
  },

  async completeTwoFactorLogin(code: string) {
    try {
      const { data } = await axios.post("/api/auth/2fa/login/verify", { code }, { withCredentials: true });
      return data;
    } catch (e) {
      throw toTotpSubmitApiError(e, "2FA doğrulaması başarısız");
    }
  },

  async logout() {
    try {
      await axios.post("/api/auth/logout", null, { withCredentials: true });
    } catch (e) {
      throw toApiError(e, "Çıkış yapılamadı");
    } finally {
      clearRentApiGatewayAuthCache();
    }
  },

  async changePassword(params: { currentPassword: string; newPassword: string }) {
    try {
      await axios.post("/api/account/change-password", params, { withCredentials: true });
    } catch (e) {
      throw toApiError(e, "Şifre değiştirilemedi");
    }
  },

  async fetchTwoFactorSetup(): Promise<TwoFactorSetupPayload> {
    const { data, status } = await axios.post<TwoFactorSetupPayload | { message?: string }>(
      "/api/auth/2fa/setup",
      {},
      { withCredentials: true, validateStatus: () => true },
    );
    if (status !== 200 || !data) {
      const msg =
        typeof data === "object" && data != null && "message" in data && typeof data.message === "string"
          ? data.message
          : "2FA kurulumu alınamadı";
      throw new ApiError(status, msg, data);
    }
    const p = data as TwoFactorSetupPayload;
    if (
      typeof p.secret !== "string" ||
      typeof p.qrImageBase64 !== "string" ||
      typeof p.otpAuthUri !== "string"
    ) {
      throw new ApiError(status, "Geçersiz kurulum yanıtı", data);
    }
    return p;
  },

  async activateTwoFactor(code: string): Promise<void> {
    try {
      await axios.post("/api/auth/2fa/active", { code }, { withCredentials: true });
    } catch (e) {
      throw toTotpSubmitApiError(e, "2FA doğrulaması başarısız");
    }
  },

  async disableTwoFactor(code: string): Promise<void> {
    try {
      await axios.post("/api/auth/2fa/disable", { code }, { withCredentials: true });
    } catch (e) {
      throw toTotpSubmitApiError(e, "2FA kapatılamadı");
    }
  },
};
