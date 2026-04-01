import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, STORES } from "../constants";
import type {
  Session,
  CapturedEvent,
  Screenshot,
  ScreenState,
  Journey,
  UserNote,
  Report,
  Project,
} from "../types";

interface VoyagerDB extends DBSchema {
  [STORES.SESSIONS]: {
    key: string;
    value: Session;
    indexes: { "by-domain": string };
  };
  [STORES.EVENTS]: {
    key: string;
    value: CapturedEvent;
    indexes: { "by-session": string; "by-timestamp": number };
  };
  [STORES.SCREENSHOTS]: {
    key: string;
    value: Screenshot;
    indexes: { "by-session": string };
  };
  [STORES.SCREEN_STATES]: {
    key: string;
    value: ScreenState;
    indexes: { "by-session": string };
  };
  [STORES.JOURNEYS]: {
    key: string;
    value: Journey;
    indexes: { "by-session": string };
  };
  [STORES.NOTES]: {
    key: string;
    value: UserNote;
    indexes: { "by-session": string };
  };
  [STORES.REPORTS]: {
    key: string;
    value: Report;
    indexes: { "by-session": string };
  };
  [STORES.PROJECTS]: {
    key: string;
    value: Project;
  };
}

let dbInstance: IDBPDatabase<VoyagerDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<VoyagerDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<VoyagerDB>(DB_NAME, DB_VERSION, {
    blocked() {
      console.warn(
        "[Voyager] DB upgrade blocked by another connection. Close other Voyager instances.",
      );
      dbInstance = null;
    },
    blocking() {
      dbInstance?.close();
      dbInstance = null;
    },
    terminated() {
      dbInstance = null;
    },
    upgrade(db) {
      // Sessions
      const sessionStore = db.createObjectStore(STORES.SESSIONS, {
        keyPath: "id",
      });
      sessionStore.createIndex("by-domain", "domain");

      // Events
      const eventStore = db.createObjectStore(STORES.EVENTS, {
        keyPath: "id",
      });
      eventStore.createIndex("by-session", "sessionId");
      eventStore.createIndex("by-timestamp", "timestamp");

      // Screenshots
      const screenshotStore = db.createObjectStore(STORES.SCREENSHOTS, {
        keyPath: "id",
      });
      screenshotStore.createIndex("by-session", "sessionId");

      // Screen states
      const stateStore = db.createObjectStore(STORES.SCREEN_STATES, {
        keyPath: "id",
      });
      stateStore.createIndex("by-session", "sessionId");

      // Journeys
      const journeyStore = db.createObjectStore(STORES.JOURNEYS, {
        keyPath: "id",
      });
      journeyStore.createIndex("by-session", "sessionId");

      // Notes
      const noteStore = db.createObjectStore(STORES.NOTES, {
        keyPath: "id",
      });
      noteStore.createIndex("by-session", "sessionId");

      // Reports
      const reportStore = db.createObjectStore(STORES.REPORTS, {
        keyPath: "id",
      });
      reportStore.createIndex("by-session", "sessionId");

      // Projects
      db.createObjectStore(STORES.PROJECTS, { keyPath: "id" });
    },
  });

  return dbInstance;
}
