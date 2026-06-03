import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** default: 主色；danger: 红色；success: 绿色 */
  tone?: "default" | "danger" | "success";
};

type AlertOptions = {
  title?: string;
  message: string;
  okText?: string;
  /** default: 主色；danger: 红色；success: 绿色 */
  tone?: "default" | "danger" | "success";
};

type DialogApi = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert: (opts: AlertOptions) => Promise<void>;
};

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}

type Pending =
  | {
      kind: "confirm";
      opts: ConfirmOptions;
      resolve: (v: boolean) => void;
    }
  | {
      kind: "alert";
      opts: AlertOptions;
      resolve: () => void;
    };

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const resolverRef = useRef<Pending["resolve"] | null>(null);
  const kindRef = useRef<Pending["kind"] | null>(null);

  const close = useCallback(() => {
    setPending(null);
    resolverRef.current = null;
    kindRef.current = null;
  }, []);

  const confirm = useCallback(async (opts: ConfirmOptions) => {
    if (pending) return false;
    return await new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      kindRef.current = "confirm";
      setPending({ kind: "confirm", opts, resolve });
    });
  }, [pending]);

  const alert = useCallback(async (opts: AlertOptions) => {
    if (pending) return;
    return await new Promise<void>((resolve) => {
      resolverRef.current = resolve;
      kindRef.current = "alert";
      setPending({ kind: "alert", opts, resolve });
    });
  }, [pending]);

  const api = useMemo(() => ({ confirm, alert }), [confirm, alert]);

  // ESC 关闭：confirm 当作取消；alert 当作确认
  useEffect(() => {
    if (!pending) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (kindRef.current === "confirm") {
        (resolverRef.current as ((v: boolean) => void) | null)?.(false);
      } else if (kindRef.current === "alert") {
        (resolverRef.current as (() => void) | null)?.();
      }
      close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending, close]);

  const overlay = pending
    ? createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            // 点击遮罩：confirm 视为取消；alert 不关闭（避免误点）
            if (e.target !== e.currentTarget) return;
            if (pending.kind === "confirm") {
              pending.resolve(false);
              close();
            }
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const tone =
                pending.kind === "confirm"
                  ? pending.opts.tone ?? "default"
                  : (pending.opts as AlertOptions).tone ?? "default";
              const toneIcon =
                tone === "danger"
                  ? "bg-red-50 text-red-600"
                  : tone === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-teal-50 text-teal-700";
              const tonePrimary =
                tone === "danger"
                  ? "bg-red-600 hover:bg-red-700"
                  : tone === "success"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-teal-600 hover:bg-teal-700";
              return (
                <>
            <div className="px-5 pt-5">
              <div className="flex items-start gap-3">
                <div
                  className={[
                    "mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl",
                    toneIcon,
                  ].join(" ")}
                  aria-hidden
                >
                  {pending.kind === "confirm" ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v4m0 4h.01M10.29 3.86l-8.12 14.06A2 2 0 004 21h16a2 2 0 001.73-3.08L13.61 3.86a2 2 0 00-3.32 0z"
                      />
                    </svg>
                  ) : (
                    tone === "success" ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 18h.01M12 6v8"
                        />
                      </svg>
                    )
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-slate-900">
                    {pending.kind === "confirm"
                      ? pending.opts.title ?? "请确认操作"
                      : pending.opts.title ?? "提示"}
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                    {pending.kind === "confirm" ? pending.opts.message : pending.opts.message}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
              {pending.kind === "confirm" ? (
                <>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      pending.resolve(false);
                      close();
                    }}
                  >
                    {pending.opts.cancelText ?? "取消"}
                  </button>
                  <button
                    type="button"
                    className={[
                      "rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50",
                      tonePrimary,
                    ].join(" ")}
                    onClick={() => {
                      pending.resolve(true);
                      close();
                    }}
                  >
                    {pending.opts.confirmText ?? "确定"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={["rounded-lg px-4 py-2 text-sm font-medium text-white", tonePrimary].join(" ")}
                  onClick={() => {
                    pending.resolve();
                    close();
                  }}
                >
                  {(pending.opts as AlertOptions).okText ?? "知道了"}
                </button>
              )}
            </div>
                </>
              );
            })()}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <DialogContext.Provider value={api}>
      {children}
      {overlay}
    </DialogContext.Provider>
  );
}

