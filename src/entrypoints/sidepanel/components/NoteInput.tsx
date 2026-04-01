import { useState } from "react";

interface Props {
  onAddNote: (text: string) => void;
}

export function NoteInput({ onAddNote }: Props) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (!text.trim()) return;
    onAddNote(text.trim());
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        placeholder="Add a note..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
      />
      <button
        onClick={handleSubmit}
        disabled={!text.trim()}
        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg transition-colors disabled:opacity-40"
      >
        Add
      </button>
    </div>
  );
}
