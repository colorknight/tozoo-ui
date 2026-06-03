import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { importProcessCommodity } from "@/api/commodity";
import { useDialog } from "@/components/DialogProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  onUploaded?: () => void | Promise<void>;
};

function isFlowFile(file: File): boolean {
  return file.name.trim().toLowerCase().endsWith(".flow");
}

function parseFlowProcesses(text: string): Record<string, unknown>[] {
  const root = JSON.parse(text) as unknown;
  if (Array.isArray(root)) {
    return root.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
  }
  if (root && typeof root === "object") {
    return [root as Record<string, unknown>];
  }
  return [];
}

function readNameFromFlowText(text: string): string {
  const list = parseFlowProcesses(text);
  const n = list[0]?.name;
  return typeof n === "string" ? n.trim() : n != null ? String(n).trim() : "";
}

async function flowFileWithName(file: File, name: string): Promise<File> {
  const text = await file.text();
  const root = JSON.parse(text) as unknown;
  const list = parseFlowProcesses(text);
  if (list.length === 0) {
    throw new Error(".flow 文件内容为空或格式无法识别");
  }
  list[0] = { ...list[0], name: name.trim() };
  const body = Array.isArray(root) ? list : list[0];
  const blob = new Blob([JSON.stringify(body)], {
    type: file.type || "application/json",
  });
  return new File([blob], file.name, { type: blob.type });
}

export function ProcessUploadModal({ open, onClose, onUploaded }: Props) {
  const dialog = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [processName, setProcessName] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !uploading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, uploading]);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setProcessName("");
      setDescription("");
      setUploading(false);
    }
  }, [open]);

  if (!open) return null;

  const pickFile = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!f) {
      setFile(null);
      setProcessName("");
      return;
    }
    if (!isFlowFile(f)) {
      setFile(null);
      setProcessName("");
      await dialog.alert({
        title: "文件类型不正确",
        message: "请上传 .flow 流程文件（第三方系统导出）。",
        okText: "知道了",
        tone: "default",
      });
      return;
    }
    setFile(f);
    try {
      const text = await f.text();
      setProcessName(readNameFromFlowText(text));
    } catch {
      setProcessName("");
    }
  };

  const submit = async () => {
    if (uploading) return;
    if (!file) {
      await dialog.alert({
        title: "请选择文件",
        message: "请先选择第三方系统导出的 .flow 流程文件。",
        okText: "知道了",
        tone: "default",
      });
      return;
    }
    const name = processName.trim();
    if (!name) {
      await dialog.alert({
        title: "请填写名称",
        message: "请填写流程名称。",
        okText: "知道了",
        tone: "default",
      });
      return;
    }
    const desc = description.trim();
    if (!desc) {
      await dialog.alert({
        title: "请填写说明",
        message: "请填写流程说明。",
        okText: "知道了",
        tone: "default",
      });
      return;
    }
    const ok = await dialog.confirm({
      title: "确认导入流程？",
      message: `名称：${name}\n文件：${file.name}\n说明：${desc}`,
      confirmText: "上传",
      cancelText: "取消",
    });
    if (!ok) return;

    setUploading(true);
    try {
      const payload = await flowFileWithName(file, name);
      const saved = await importProcessCommodity({ file: payload, changeLog: desc });
      const label = saved.alias?.trim() || saved.name || name;
      await dialog.alert({
        title: "导入成功",
        message: `流程商品「${label}」已导入。`,
        okText: "知道了",
        tone: "success",
      });
      onClose();
      await onUploaded?.();
    } catch (e) {
      await dialog.alert({
        title: "导入失败",
        message: e instanceof Error ? e.message : String(e),
        okText: "关闭",
        tone: "danger",
      });
    } finally {
      setUploading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[190] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="process-upload-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !uploading) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input ref={fileInputRef} type="file" accept=".flow" className="hidden" onChange={onFileChange} />

        <div className="relative border-b border-slate-100 px-5 py-4 pr-12">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 id="process-upload-title" className="text-base font-semibold text-slate-900">
            导入流程
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">上传第三方系统导出的 .flow 文件</p>
        </div>

        <div className="space-y-3 px-5 py-4">
          <button
            type="button"
            onClick={pickFile}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-teal-300 bg-teal-50/50 px-3 py-3 text-sm text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-60"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            {file ? "重新选择 .flow" : "选择 .flow 文件"}
          </button>
          {file && (
            <p className="truncate text-xs text-slate-400" title={file.name}>
              {file.name}
            </p>
          )}

          <label className="block text-xs font-medium text-slate-600">
            名称
            <input
              type="text"
              value={processName}
              onChange={(e) => setProcessName(e.target.value)}
              disabled={uploading}
              placeholder="流程名称"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/30 disabled:bg-slate-50"
            />
          </label>

          <label className="block text-xs font-medium text-slate-600">
            说明
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={uploading}
              rows={3}
              placeholder="必填，如：从 XX 系统导出"
              className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/30 disabled:bg-slate-50"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            disabled={uploading}
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => void submit()}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {uploading ? "上传中…" : "上传并导入"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
