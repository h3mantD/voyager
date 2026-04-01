import { useState, useCallback } from "react";
import { SessionControl } from "./components/SessionControl";
import { NoteInput } from "./components/NoteInput";
import { EventTimeline } from "./components/EventTimeline";
import { ReportPreview } from "./components/ReportPreview";
import { SessionHistory } from "./components/SessionHistory";
import { SettingsPanel } from "./components/SettingsPanel";
import { useSession } from "./hooks/useSession";
import type { CapturedEvent, Report } from "../../lib/types";

type View = "recorder" | "history" | "settings";

export default function App() {
  const [view, setView] = useState<View>("recorder");
  const {
    status,
    sessionId,
    events,
    report,
    startRecording,
    stopRecording,
    addNote,
    generateReport,
    loadSession,
  } = useSession();

  const isRecording = status === "recording";
  const isStopped = status === "stopped";
  const isIdle = status === "idle";

  const handleLoadSession = useCallback(
    (sid: string, loadedEvents: CapturedEvent[], loadedReport: Report | null) => {
      loadSession(sid, loadedEvents, loadedReport);
      setView("recorder");
    },
    [loadSession],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-500 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">V</span>
          </div>
          <h1 className="font-semibold text-slate-800">Voyager</h1>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setView(view === "settings" ? "recorder" : "settings")}
              className={`p-1.5 rounded-md transition-colors ${
                view === "settings"
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              }`}
              title="Settings"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6.5 1.5h3l.5 2 1.5.7 1.8-1 2.1 2.1-1 1.8.7 1.5 2 .5v3l-2 .5-0.7 1.5 1 1.8-2.1 2.1-1.8-1-1.5.7-.5 2h-3l-.5-2-1.5-.7-1.8 1-2.1-2.1 1-1.8-.7-1.5-2-.5v-3l2-.5.7-1.5-1-1.8 2.1-2.1 1.8 1 1.5-.7z" />
                <circle cx="8" cy="8" r="2.5" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {view === "settings" ? (
          <SettingsPanel onBack={() => setView("recorder")} />
        ) : view === "history" ? (
          <SessionHistory
            onBack={() => setView("recorder")}
            onLoadSession={handleLoadSession}
          />
        ) : (
          <>
            {/* History link (when idle) */}
            {isIdle && (
              <button
                onClick={() => setView("history")}
                className="w-full py-2 px-3 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 text-sm rounded-lg transition-colors text-center"
              >
                View Past Sessions
              </button>
            )}

            {/* Recording controls */}
            <section>
              <SessionControl
                status={status}
                onStart={startRecording}
                onStop={stopRecording}
              />
            </section>

            {/* Quick note (only while recording) */}
            {isRecording && (
              <section>
                <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Quick Note
                </h2>
                <NoteInput onAddNote={addNote} />
              </section>
            )}

            {/* Event timeline */}
            {(isRecording || isStopped) && events.length > 0 && (
              <section>
                <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Events ({events.length})
                </h2>
                <EventTimeline events={events} />
              </section>
            )}

            {/* Report generation (after stop) */}
            {isStopped && (
              <section>
                <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Report
                </h2>
                <ReportPreview
                  report={report}
                  onGenerate={generateReport}
                  canGenerate={events.length > 0 && !report}
                />
              </section>
            )}

            {/* Back to new recording (when viewing old session) */}
            {isStopped && (
              <div className="flex gap-2">
                <button
                  onClick={() => setView("history")}
                  className="flex-1 py-2 px-3 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 text-sm rounded-lg transition-colors"
                >
                  All Sessions
                </button>
                <button
                  onClick={() => {
                    loadSession(null, [], null);
                  }}
                  className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-sm rounded-lg transition-colors"
                >
                  New Recording
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="px-4 py-2 border-t border-slate-200 bg-white">
        <p className="text-xs text-slate-400 text-center">
          Explore products. Extract context. Build better.
        </p>
      </footer>
    </div>
  );
}
