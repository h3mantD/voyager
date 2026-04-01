import type { RecordingStatus, Session } from "../../lib/types";
import {
  createSession,
  updateSession,
} from "../../lib/storage/session-repository";

const STATE_KEY = "voyager-session-state";

interface SessionState {
  status: RecordingStatus;
  sessionId: string | null;
  recordingTabId: number | null;
}

let currentState: SessionState = {
  status: "idle",
  sessionId: null,
  recordingTabId: null,
};

// Rehydrate state from chrome.storage.session on SW restart
async function rehydrate() {
  try {
    const result = await chrome.storage.session.get(STATE_KEY);
    const saved = result[STATE_KEY] as SessionState | undefined;
    if (saved && saved.status === "recording" && saved.sessionId) {
      currentState = saved;
      chrome.action.setBadgeText({ text: "REC" });
      chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
    }
  } catch {
    // storage.session not available or empty — start fresh
  }
}

async function persistState() {
  try {
    await chrome.storage.session.set({ [STATE_KEY]: currentState });
  } catch {
    // best-effort
  }
}

// Rehydrate immediately on module load (SW startup)
const rehydratePromise = rehydrate();

export async function ensureSessionStateReady(): Promise<void> {
  await rehydratePromise;
}

export function getSessionState(): SessionState {
  return { ...currentState };
}

export async function startSession(
  name: string,
  notes: string,
  tab: chrome.tabs.Tab,
): Promise<Session> {
  const domain = tab?.url ? new URL(tab.url).hostname : "unknown";

  const session: Session = {
    id: crypto.randomUUID(),
    name: name || `Session — ${new Date().toLocaleString()}`,
    domain,
    startTime: Date.now(),
    status: "recording",
    notes,
  };

  await createSession(session);

  currentState = {
    status: "recording",
    sessionId: session.id,
    recordingTabId: tab.id ?? null,
  };
  await persistState();

  // Set badge to indicate recording
  chrome.action.setBadgeText({ text: "REC" });
  chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });

  return session;
}

export async function stopSession(): Promise<Session | null> {
  if (!currentState.sessionId) return null;

  const sessionId = currentState.sessionId;
  const recordingTabId = currentState.recordingTabId;
  await updateSession(sessionId, {
    status: "stopped",
    endTime: Date.now(),
  });

  // Notify content script to stop observing
  if (recordingTabId !== null) {
    chrome.tabs.sendMessage(recordingTabId, {
      type: "STOP_RECORDING",
      payload: {},
    }).catch(() => {});
  }

  const { getSession } = await import("../../lib/storage/session-repository");
  const session = await getSession(sessionId);

  // Persist idle state BEFORE updating in-memory — prevents stale "recording"
  // state from surviving a SW restart if killed between these lines.
  const idleState: SessionState = { status: "idle", sessionId: null, recordingTabId: null };
  try {
    await chrome.storage.session.set({ [STATE_KEY]: idleState });
  } catch {
    // best-effort
  }
  currentState = idleState;
  chrome.action.setBadgeText({ text: "" });

  return session ?? null;
}
