const STORAGE_KEY = "algory_panel_notification_prefs_v1";

export type PanelNotificationPreferences = {
  emailOperational: boolean;
  emailMarketing: boolean;
  inAppImportant: boolean;
  browserNotifications: boolean;
};

export const DEFAULT_PANEL_NOTIFICATION_PREFS: PanelNotificationPreferences = {
  emailOperational: true,
  emailMarketing: false,
  inAppImportant: true,
  browserNotifications: false,
};

function parsePrefs(raw: string | null): PanelNotificationPreferences {
  if (!raw?.trim()) return { ...DEFAULT_PANEL_NOTIFICATION_PREFS };
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null) return { ...DEFAULT_PANEL_NOTIFICATION_PREFS };
    const o = v as Record<string, unknown>;
    return {
      emailOperational:
        typeof o.emailOperational === "boolean" ? o.emailOperational : DEFAULT_PANEL_NOTIFICATION_PREFS.emailOperational,
      emailMarketing:
        typeof o.emailMarketing === "boolean" ? o.emailMarketing : DEFAULT_PANEL_NOTIFICATION_PREFS.emailMarketing,
      inAppImportant:
        typeof o.inAppImportant === "boolean" ? o.inAppImportant : DEFAULT_PANEL_NOTIFICATION_PREFS.inAppImportant,
      browserNotifications:
        typeof o.browserNotifications === "boolean"
          ? o.browserNotifications
          : DEFAULT_PANEL_NOTIFICATION_PREFS.browserNotifications,
    };
  } catch {
    return { ...DEFAULT_PANEL_NOTIFICATION_PREFS };
  }
}

export function loadPanelNotificationPreferences(): PanelNotificationPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_PANEL_NOTIFICATION_PREFS };
  return parsePrefs(window.localStorage.getItem(STORAGE_KEY));
}

export function savePanelNotificationPreferences(prefs: PanelNotificationPreferences): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
