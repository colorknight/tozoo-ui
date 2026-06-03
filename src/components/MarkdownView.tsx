import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownViewProps = {
  markdown: string;
  className?: string;
};

export function MarkdownView({ markdown, className }: MarkdownViewProps) {
  const md = (markdown || "").trim();
  if (!md) return null;
  return (
    <div className={["markdown-preview", className || ""].join(" ").trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
    </div>
  );
}

