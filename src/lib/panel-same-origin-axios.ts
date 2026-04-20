"use client";

import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

import { clearGatewayBearerCache } from "@/lib/gateway-bearer-cache-state";

let refreshPromise: Promise<boolean> | null = null;

/** Aynı origin `/api/auth/refresh`; 401 ise login’e yönlendirir. */
export async function refreshPanelSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const r = await axios.post("/api/auth/refresh", {}, {
          withCredentials: true,
          validateStatus: (s) => s < 500,
        });
        if (r.status === 401) {
          clearGatewayBearerCache();
          await axios.post("/api/auth/logout", {}, { withCredentials: true, validateStatus: () => true }).catch(() => undefined);
          window.location.assign("/login");
          return false;
        }
        if (r.status >= 200 && r.status < 300) {
          clearGatewayBearerCache();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

type PanelRetryCfg = InternalAxiosRequestConfig & { __panel401Retried?: boolean };

let panelInstance: AxiosInstance | null = null;

/** Panel ile aynı origin; `credentials` ile httpOnly çerezler; 401 → refresh → tek retry. */
export function getPanelSameOriginAxios(): AxiosInstance {
  if (panelInstance) return panelInstance;
  panelInstance = axios.create({
    baseURL: "",
    timeout: 30_000,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    withCredentials: true,
  });
  panelInstance.interceptors.response.use(
    (r) => r,
    async (error: AxiosError) => {
      const status = error.response?.status;
      const cfg = error.config as PanelRetryCfg | undefined;
      if (typeof window === "undefined") return Promise.reject(error);
      if (status !== 401 || !cfg || cfg.__panel401Retried) return Promise.reject(error);
      const url = String(cfg.url ?? "");
      if (
        url.includes("/api/auth/refresh") ||
        url.includes("/api/auth/login") ||
        url.includes("/api/auth/logout")
      ) {
        return Promise.reject(error);
      }
      cfg.__panel401Retried = true;
      const ok = await refreshPanelSession();
      if (!ok) return Promise.reject(error);
      return panelInstance!.request(cfg);
    },
  );
  return panelInstance;
}
