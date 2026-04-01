import { useState, useEffect } from "react";
import type { Report } from "../../../lib/types";
import { getAIConfig } from "../../../lib/ai/config";

interface Props {
  report: Report | null;
  onGenerate: (mode: "deterministic" | "ai-enhanced") => void;
  canGenerate: boolean;
}

export function ReportPreview({ report, onGenerate, canGenerate }: Props) {
  const [hasAI, setHasAI] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    getAIConfig().then((config) => setHasAI(!!config));
  }, []);

  const handleGenerate = async (mode: "deterministic" | "ai-enhanced") => {
    setGenerating(true);
    onGenerate(mode);
    // generating state will be cleared when report arrives via prop change
  };

  // Clear generating state when report arrives
  useEffect(() => {
    if (report) setGenerating(false);
  }, [report]);

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
      {!report && canGenerate && !generating && (
        <div className="space-y-2">
          <button
            onClick={() => handleGenerate("deterministic")}
            className="w-full py-2.5 px-4 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors"
          >
            Generate Report
          </button>
          {hasAI && (
            <div>
              <button
                onClick={() => handleGenerate("ai-enhanced")}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium rounded-lg transition-colors"
              >
                Generate with AI
                <span className="ml-1.5 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                  Experimental
                </span>
              </button>
              <p className="text-xs text-slate-400 text-center mt-1">
                Results may vary — review before sharing
              </p>
            </div>
          )}
          {!hasAI && (
            <p className="text-xs text-slate-400 text-center">
              Add an AI provider in Settings for enhanced reports
            </p>
          )}
        </div>
      )}

      {generating && (
        <div className="flex items-center justify-center gap-2 py-4">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-500">Generating report...</span>
        </div>
      )}

      {report && !generating && (
        <>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                report.mode === "ai-enhanced"
                  ? "bg-purple-50 text-purple-600"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {report.mode === "ai-enhanced" ? "AI Enhanced" : "Deterministic"}
            </span>
          </div>

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

          {/* Enhance with AI — show on deterministic reports when AI is configured */}
          {hasAI && report.mode === "deterministic" && (
            <div>
              <button
                onClick={() => handleGenerate("ai-enhanced")}
                className="w-full py-2 px-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Enhance with AI
                <span className="ml-1.5 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                  Experimental
                </span>
              </button>
              <p className="text-xs text-slate-400 text-center mt-1">
                Results may vary — review before sharing
              </p>
            </div>
          )}

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
