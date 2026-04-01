import type { CapturedEvent } from "../../../lib/types";

interface Props {
  events: CapturedEvent[];
}

const EVENT_ICONS: Record<string, string> = {
  "route-change": "->",
  click: "*",
  "form-submit": "[>",
  "modal-open": "[+]",
  "modal-close": "[-]",
  "drawer-open": "[+]",
  "drawer-close": "[-]",
  "tab-switch": "<>",
  "dropdown-select": "v",
  "state-change": "~",
  "user-note": "@",
};

function safePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function EventTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="text-center text-slate-400 py-8 text-sm">
        No events captured yet. Start exploring the product.
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-64 overflow-y-auto">
      {events.map((event, i) => (
        <div
          key={event.id ?? i}
          className="flex items-start gap-2 px-2 py-1.5 hover:bg-slate-100 rounded text-xs"
        >
          <span className="font-mono text-slate-400 w-6 text-center shrink-0">
            {EVENT_ICONS[event.type] ?? "*"}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-slate-700 truncate">{event.label}</div>
            <div className="text-slate-400 truncate">
              {safePathname(event.url)}
            </div>
          </div>
          <span className="text-slate-300 shrink-0">
            {new Date(event.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      ))}
    </div>
  );
}
