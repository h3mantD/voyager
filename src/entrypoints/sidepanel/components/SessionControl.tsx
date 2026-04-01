import { useState } from "react";
import type { RecordingStatus } from "../../../lib/types";

interface Props {
  status: RecordingStatus;
  onStart: (name: string, notes: string) => void;
  onStop: () => void;
}

export function SessionControl({ status, onStart, onStop }: Props) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const handleStart = () => {
    onStart(name || `Session ${new Date().toLocaleString()}`, notes);
    setName("");
    setNotes("");
  };

  if (status === "recording") {
    return (
      <div className="space-y-3">
        <RecordingIndicator />
        <button
          onClick={onStop}
          className="w-full py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
        >
          Stop Recording
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Session name (e.g., 'Create server flow')"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
      />
      <textarea
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white resize-none"
      />
      <button
        onClick={handleStart}
        className="w-full py-2.5 px-4 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors"
      >
        Start Recording
      </button>
    </div>
  );
}

function RecordingIndicator() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
      </span>
      <span className="text-red-700 font-medium text-sm">Recording...</span>
    </div>
  );
}
