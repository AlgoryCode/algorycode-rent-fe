"use client";

import axios, { AxiosError } from "axios";

import { ApiError } from "@/lib/api/errors";
import { clearRentApiGatewayAuthCache } from "@/lib/rent-api";

function toApiError(e: unknown, fallback: string): ApiError {
  const err = e as AxiosError<{ message?: string }>;
  return new ApiError(
    err.response?.status ?? 0,
    err.response?.data?.message ?? err.message ?? fallback,
    err.response?.data,
  );
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
};
