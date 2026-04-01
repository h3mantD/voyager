import { useState, useEffect, useCallback } from "react";
import type { Session, CapturedEvent, Report } from "../../../lib/types";
import { getAIConfig } from "../../../lib/ai/config";

interface SessionDetail {
  session: Session;
  events: CapturedEvent[];
  report?: Report;
}

interface Props {
  onBack: () => void;
  onLoadSession: (sessionId: string, events: CapturedEvent[], report: Report | null) => void;
}

export function SessionHistory({ onBack, onLoadSession }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAI, setHasAI] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  useEffect(() => {
    loadSessions();
    getAIConfig().then((config) => setHasAI(!!config));
  }, []);

  async function loadSessions() {
    setLoading(true);
    const response = await chrome.runtime.sendMessage({
      type: "GET_SESSIONS",
      payload: {},
    });
    if (response?.success) {
      // Sort newest first
      const sorted = (response.sessions as Session[]).sort(
        (a, b) => b.startTime - a.startTime,
      );
      setSessions(sorted);
    }
    setLoading(false);
  }

  async function loadDetail(sessionId: string) {
    const response = await chrome.runtime.sendMessage({
      type: "GET_SESSION_DETAIL",
      payload: { sessionId },
    });
    if (response?.success) {
      setSelectedDetail({
        session: response.session,
        events: response.events,
        report: response.report,
      });
    }
  }

  async function handleDelete(sessionId: string) {
    // Snapshot for rollback
    const previousSessions = sessions;

    // Optimistic removal
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setSelectedDetail(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "DELETE_SESSION",
        payload: { sessionId },
      });
      if (!response?.success) {
        // Rollback on failure
        setSessions(previousSessions);
      }
    } catch {
      // Rollback on error
      setSessions(previousSessions);
    }
  }

  async function handleEnhanceWithAI(sessionId: string) {
    setEnhancing(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GENERATE_REPORT",
        payload: { sessionId, mode: "ai-enhanced" },
      });
      if (response?.success && response.report) {
        setSelectedDetail((prev) =>
          prev ? { ...prev, report: response.report } : prev,
        );
      }
    } catch {
      // AI enhancement failed — detail view still shows existing report
    }
    setEnhancing(false);
  }

  const handleRestore = useCallback(
    (detail: SessionDetail) => {
      onLoadSession(
        detail.session.id,
        detail.events,
        detail.report ?? null,
      );
    },
    [onLoadSession],
  );

  if (loading) {
    return (
      <div className="text-center text-slate-400 py-8 text-sm">
        Loading sessions...
      </div>
    );
  }

  // ── Detail view ─────────────────────────────────────────────────────
  if (selectedDetail) {
    const { session, events, report } = selectedDetail;
    return (
      <div className="space-y-3">
        <button
          onClick={() => setSelectedDetail(null)}
          className="text-sm text-indigo-500 hover:text-indigo-600"
        >
          &larr; Back to sessions
        </button>

        <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
          <h3 className="font-semibold text-slate-800 text-sm">
            {session.name}
          </h3>
          <div className="text-xs text-slate-500 space-y-1">
            <div>Domain: {session.domain}</div>
            <div>
              Date: {new Date(session.startTime).toLocaleDateString()}{" "}
              {new Date(session.startTime).toLocaleTimeString()}
            </div>
            {session.endTime && (
              <div>
                Duration:{" "}
                {formatDuration(
                  Math.round((session.endTime - session.startTime) / 1000),
                )}
              </div>
            )}
            <div>Events: {events.length}</div>
            <div>
              Status:{" "}
              <span
                className={
                  session.status === "stopped"
                    ? "text-green-600"
                    : session.status === "recording"
                      ? "text-red-500"
                      : "text-slate-500"
                }
              >
                {session.status}
              </span>
            </div>
          </div>
          {session.notes && (
            <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
              {session.notes}
            </div>
          )}
        </div>

        {/* Event summary */}
        {events.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Events ({events.length})
            </h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {events.slice(0, 50).map((event, i) => (
                <div
                  key={event.id ?? i}
                  className="text-xs text-slate-600 truncate"
                >
                  <span className="text-slate-400">
                    {new Date(event.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>{" "}
                  {event.label}
                </div>
              ))}
              {events.length > 50 && (
                <div className="text-xs text-slate-400">
                  ...and {events.length - 50} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Report preview */}
        {report && (
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Report
            </h4>
            <div className="flex gap-2 mb-2">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(report.markdown);
                }}
                className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-lg transition-colors"
              >
                Copy Markdown
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([report.markdown], {
                    type: "text/markdown",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `voyager-${session.domain}-${new Date(session.startTime).toISOString().slice(0, 10)}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-lg transition-colors"
              >
                Download .md
              </button>
            </div>
            {/* Enhance with AI */}
            {hasAI && report.mode === "deterministic" && !enhancing && (
              <div>
                <button
                  onClick={() => handleEnhanceWithAI(session.id)}
                  className="w-full py-1.5 px-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Enhance with AI
                  <span className="ml-1.5 text-[10px] bg-white/20 px-1 py-0.5 rounded-full">
                    Experimental
                  </span>
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-1">
                  Results may vary — review before sharing
                </p>
              </div>
            )}
            {enhancing && (
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-500">Enhancing with AI...</span>
              </div>
            )}
            {report.mode === "ai-enhanced" && (
              <span className="inline-block text-xs px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded">
                AI Enhanced
              </span>
            )}
            <details>
              <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
                Preview
              </summary>
              <pre className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-600 overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap">
                {report.markdown}
              </pre>
            </details>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => handleRestore(selectedDetail)}
            className="flex-1 py-2 px-3 bg-indigo-500 hover:bg-indigo-600 text-white text-sm rounded-lg transition-colors"
          >
            {report ? "View Report" : "Generate Report"}
          </button>
          <button
            onClick={() => handleDelete(session.id)}
            className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 text-sm rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  // ── List view ───────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-indigo-500 hover:text-indigo-600"
        >
          &larr; New Recording
        </button>
        <span className="text-xs text-slate-400">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center text-slate-400 py-8 text-sm">
          No past sessions yet. Start your first recording!
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => loadDetail(session.id)}
              className="w-full text-left bg-white border border-slate-200 hover:border-indigo-300 rounded-lg p-3 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800 text-sm truncate">
                  {session.name}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    session.status === "stopped"
                      ? "bg-green-50 text-green-600"
                      : session.status === "recording"
                        ? "bg-red-50 text-red-500"
                        : "bg-slate-50 text-slate-500"
                  }`}
                >
                  {session.status}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {session.domain} &middot;{" "}
                {new Date(session.startTime).toLocaleDateString()}
                {session.endTime && (
                  <>
                    {" "}
                    &middot;{" "}
                    {formatDuration(
                      Math.round(
                        (session.endTime - session.startTime) / 1000,
                      ),
                    )}
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}
