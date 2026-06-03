type BackendEnvelope = {
  code?: unknown;
  message?: unknown;
  result?: unknown;
  error?: unknown;
  msg?: unknown;
  timestamp?: unknown;
};

function asNonEmptyString(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t ? t : "";
}

function parseBackendEnvelope(text: string): BackendEnvelope | null {
  const t = text.trim();
  if (!t) return null;
  if (!(t.startsWith("{") && t.endsWith("}"))) return null;
  try {
    const parsed = JSON.parse(t) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as BackendEnvelope;
  } catch {
    return null;
  }
}

export function apiErrorMessage(action: string, res: Response, text: string): string {
  const envelope = parseBackendEnvelope(text);
  const result = asNonEmptyString(envelope?.result);
  const message = asNonEmptyString(envelope?.message) || asNonEmptyString(envelope?.msg);
  const err = asNonEmptyString(envelope?.error);

  const hint = result || err || message || asNonEmptyString(text) || res.statusText || "请求失败";
  // 不把整段 JSON 丢到 UI；保留 HTTP 状态码用于排查
  return `${action}失败（${res.status}）：${hint}`;
}

