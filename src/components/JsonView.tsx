import ReactJsonView from "@uiw/react-json-view";

type JsonViewProps = {
  value: unknown;
  className?: string;
};

function normalizeJsonForView(value: unknown): unknown {
  if (!Array.isArray(value)) return value;

  // 数组在 viewer 里会显示 0/1/2… 作为 key；这里改成用更有意义的字段当 key
  const out: Record<string, unknown> = {};
  let idx = 0;
  for (const item of value) {
    const o = item as any;
    const id = typeof o?.id === "string" ? o.id.trim() : "";
    const text = typeof o?.text === "string" ? o.text.trim() : "";
    const keyBase = id || text || `item_${idx + 1}`;
    let key = keyBase;
    let dup = 2;
    while (Object.prototype.hasOwnProperty.call(out, key)) {
      key = `${keyBase}#${dup}`;
      dup++;
    }
    out[key] = item;
    idx++;
    if (idx > 5000) break;
  }
  return out;
}

export function JsonView({ value, className }: JsonViewProps) {
  return (
    <div
      className={[
        "mt-3 max-h-[40vh] overflow-auto rounded-lg border border-admin-border bg-white px-3 py-2 text-xs",
        className || "",
      ].join(" ")}
    >
      <ReactJsonView
        value={normalizeJsonForView(value) as any}
        collapsed={false}
        displayDataTypes={false}
        displayObjectSize={false}
        enableClipboard={false}
        highlightUpdates={false}
      />
    </div>
  );
}

