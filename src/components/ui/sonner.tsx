"use client";

import { Toaster as Sonner, toast as sonnerToast } from "sonner";

const DEFAULT_MS = 1500;
const HARD_CLOSE_MS = 800;

function hardDismiss(id: number | string, durationMs: number) {
  if (durationMs === Infinity) return;
  window.setTimeout(() => sonnerToast.dismiss(id), durationMs + HARD_CLOSE_MS);
}

const TIMED_METHODS = ["error", "success", "warning", "info", "message"] as const;
type TimedMethod = (typeof TIMED_METHODS)[number];

type ToastFn = (message: unknown, data?: { duration?: number; [k: string]: unknown }) => string | number;

function wrapMethod(fn: ToastFn): ToastFn {
  return (message, data) => {
    const dur = data?.duration ?? DEFAULT_MS;
    const id = fn(message, { ...data, duration: dur });
    hardDismiss(id, dur);
    return id;
  };
}

const handler: ProxyHandler<typeof sonnerToast> = {
  apply(target, _this, args) {
    const data = args[1] as { duration?: number } | undefined;
    const dur = data?.duration ?? DEFAULT_MS;
    const id = Reflect.apply(target, target, args) as string | number;
    hardDismiss(id, dur);
    return id;
  },
  get(target, prop) {
    if ((TIMED_METHODS as readonly string[]).includes(prop as string)) {
      const fn = target[prop as TimedMethod] as ToastFn;
      return wrapMethod(fn.bind(target));
    }
    const v = target[prop as keyof typeof target];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
  },
};

export const toast = new Proxy(sonnerToast, handler) as typeof sonnerToast;

export function Toaster() {
  return (
    <Sonner
      duration={DEFAULT_MS}
      richColors
      position="top-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "group border border-border bg-background text-foreground shadow-md",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
