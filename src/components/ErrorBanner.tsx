type ErrorBannerProps = {
  message: string;
  onClose?: () => void;
  className?: string;
};

export function ErrorBanner({ message, onClose, className }: ErrorBannerProps) {
  const text = (message || "").trim();
  if (!text) return null;
  return (
    <div
      className={[
        "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800",
        "flex items-start justify-between gap-3",
        className || "",
      ].join(" ")}
      role="alert"
    >
      <div className="min-w-0 whitespace-pre-wrap leading-relaxed">{text}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100/70"
          aria-label="关闭错误提示"
        >
          关闭
        </button>
      )}
    </div>
  );
}

