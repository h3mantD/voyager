import type { Report } from "../../../lib/types";

interface Props {
  report: Report | null;
  onGenerate: (mode: "deterministic" | "ai-enhanced") => void;
  canGenerate: boolean;
}

export function ReportPreview({ report, onGenerate, canGenerate }: Props) {
  const handleCopy = async () => {
    if (!report) return;
    await navigator.clipboard.writeText(report.markdown);
  };

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([report.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voyager-report-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!report && !canGenerate) return null;

  return (
    <div className="space-y-3">
      {!report && canGenerate && (
        <button
          onClick={() => onGenerate("deterministic")}
          className="w-full py-2.5 px-4 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors"
        >
          Generate Report
        </button>
      )}

      {report && (
        <>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg transition-colors"
            >
              Copy Markdown
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg transition-colors"
            >
              Download .md
            </button>
          </div>

          <details className="group">
            <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">
              Preview report
            </summary>
            <pre className="mt-2 p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap">
              {report.markdown}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}
