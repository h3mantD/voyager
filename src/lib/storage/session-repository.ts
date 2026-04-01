import { STORES } from "../constants";
import type {
  CapturedEvent,
  Report,
  ScreenState,
  Screenshot,
  Session,
  UserNote,
} from "../types";
import { getDB } from "./db";

// ── Sessions ────────────────────────────────────────────────────────────────

export async function createSession(session: Session): Promise<void> {
  const db = await getDB();
  await db.put(STORES.SESSIONS, session);
}

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDB();
  return db.get(STORES.SESSIONS, id);
}

export async function updateSession(
  id: string,
  updates: Partial<Session>,
): Promise<void> {
  const db = await getDB();
  const session = await db.get(STORES.SESSIONS, id);
  if (!session) return;
  await db.put(STORES.SESSIONS, { ...session, ...updates });
}

export async function getAllSessions(): Promise<Session[]> {
  const db = await getDB();
  return db.getAll(STORES.SESSIONS);
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    [
      STORES.SESSIONS,
      STORES.EVENTS,
      STORES.SCREENSHOTS,
      STORES.SCREEN_STATES,
      STORES.JOURNEYS,
      STORES.NOTES,
      STORES.REPORTS,
    ],
    "readwrite",
  );

  await Promise.all([
    deleteBySession(tx, STORES.EVENTS, id),
    deleteBySession(tx, STORES.SCREENSHOTS, id),
    deleteBySession(tx, STORES.SCREEN_STATES, id),
    deleteBySession(tx, STORES.JOURNEYS, id),
    deleteBySession(tx, STORES.NOTES, id),
    deleteBySession(tx, STORES.REPORTS, id),
    tx.objectStore(STORES.SESSIONS).delete(id),
  ]);

  await tx.done;
}

async function deleteBySession(
  // IDBPTransaction generic is too complex to express here; all stores have "by-session" index
  tx: { objectStore(name: string): { index(name: string): { getAllKeys(query?: unknown): Promise<string[]> }; delete(key: string): Promise<void> } },
  storeName:
    | typeof STORES.EVENTS
    | typeof STORES.SCREENSHOTS
    | typeof STORES.SCREEN_STATES
    | typeof STORES.JOURNEYS
    | typeof STORES.NOTES
    | typeof STORES.REPORTS,
  sessionId: string,
): Promise<void> {
  const store = tx.objectStore(storeName);
  const keys = await store.index("by-session").getAllKeys(sessionId);
  for (const key of keys) {
    await store.delete(key);
  }
}

// ── Events ──────────────────────────────────────────────────────────────────

export async function addEvent(event: CapturedEvent): Promise<void> {
  const db = await getDB();
  await db.put(STORES.EVENTS, event);
}

export async function getEventsBySession(
  sessionId: string,
): Promise<CapturedEvent[]> {
  const db = await getDB();
  const events = await db.getAllFromIndex(STORES.EVENTS, "by-session", sessionId);
  return sortByTimestamp(events);
}

// ── Screenshots ─────────────────────────────────────────────────────────────

export async function addScreenshot(screenshot: Screenshot): Promise<void> {
  const db = await getDB();
  await db.put(STORES.SCREENSHOTS, screenshot);
}

export async function getScreenshotsBySession(
  sessionId: string,
): Promise<Screenshot[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORES.SCREENSHOTS, "by-session", sessionId);
}

// ── Notes ───────────────────────────────────────────────────────────────────

export async function addNote(note: UserNote): Promise<void> {
  const db = await getDB();
  await db.put(STORES.NOTES, note);
}

export async function getNotesBySession(
  sessionId: string,
): Promise<UserNote[]> {
  const db = await getDB();
  const notes = await db.getAllFromIndex(STORES.NOTES, "by-session", sessionId);
  return sortByTimestamp(notes);
}

// ── Screen States ───────────────────────────────────────────────────────────

export async function addScreenState(state: ScreenState): Promise<void> {
  const db = await getDB();
  await db.put(STORES.SCREEN_STATES, state);
}

export async function getScreenStatesBySession(
  sessionId: string,
): Promise<ScreenState[]> {
  const db = await getDB();
  const states = await db.getAllFromIndex(STORES.SCREEN_STATES, "by-session", sessionId);
  return sortByTimestamp(states);
}

// ── Reports ─────────────────────────────────────────────────────────────────

export async function saveReport(report: Report): Promise<void> {
  const db = await getDB();
  await db.put(STORES.REPORTS, report);
}

export async function getReportBySession(
  sessionId: string,
): Promise<Report | undefined> {
  const db = await getDB();
  const reports = await db.getAllFromIndex(
    STORES.REPORTS,
    "by-session",
    sessionId,
  );
  const sorted = reports.sort((a, b) => b.generatedAt - a.generatedAt);
  return sorted[0];
}

function sortByTimestamp<T extends { timestamp: number; id: string }>(
  items: T[],
): T[] {
  return items.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return a.id.localeCompare(b.id);
  });
}
