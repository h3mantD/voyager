// ── Core Data Types ──────────────────────────────────────────────────────────

export type RecordingStatus = "idle" | "recording" | "paused" | "stopped";

export type CapturedEventType =
  | "route-change"
  | "click"
  | "form-submit"
  | "modal-open"
  | "modal-close"
  | "drawer-open"
  | "drawer-close"
  | "tab-switch"
  | "dropdown-select"
  | "state-change"
  | "user-note";

export interface CapturedEvent {
  id: string;
  sessionId: string;
  timestamp: number;
  type: CapturedEventType;
  label: string;
  targetDescription: string;
  url: string;
  screenshotId?: string;
  metadata?: Record<string, unknown>;
}

export interface Screenshot {
  id: string;
  sessionId: string;
  timestamp: number;
  dataUrl: string;
  url: string;
  stateId?: string;
}

export interface ScreenState {
  id: string;
  sessionId: string;
  name: string;
  url: string;
  visibleComponents: string[];
  primaryActions: string[];
  secondaryActions: string[];
  screenshotId?: string;
  eventIds: string[];
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface Journey {
  id: string;
  sessionId: string;
  name: string;
  startStateId: string;
  endStateId: string;
  stateSequence: string[];
  notablePatterns: string[];
  userAnnotations: string[];
}

export interface UserNote {
  id: string;
  sessionId: string;
  timestamp: number;
  text: string;
  attachedToEventId?: string;
  attachedToStateId?: string;
}

export interface Session {
  id: string;
  projectId?: string;
  name: string;
  domain: string;
  startTime: number;
  endTime?: number;
  status: RecordingStatus;
  notes: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  sessionIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Report {
  id: string;
  sessionId: string;
  markdown: string;
  mode: "deterministic" | "ai-enhanced";
  generatedAt: number;
}

// ── Message Types (content <-> background <-> sidepanel) ────────────────────

export type MessageType =
  | "START_RECORDING"
  | "STOP_RECORDING"
  | "PAUSE_RECORDING"
  | "RESUME_RECORDING"
  | "RECORDING_STATUS"
  | "CAPTURE_EVENT"
  | "ADD_NOTE"
  | "REQUEST_SCREENSHOT"
  | "GENERATE_REPORT"
  | "REPORT_GENERATED"
  | "GET_SESSION"
  | "SESSION_DATA"
  | "GET_EVENTS"
  | "EVENTS_DATA"
  | "CAPTURE_STATE"
  | "GET_SESSIONS"
  | "GET_SESSION_DETAIL"
  | "DELETE_SESSION";

export interface Message<T = unknown> {
  type: MessageType;
  payload: T;
}

export interface StartRecordingPayload {
  sessionName: string;
  notes: string;
}

export interface RecordingStatusPayload {
  status: RecordingStatus;
  sessionId: string | null;
}

export interface CaptureEventPayload {
  event: Omit<CapturedEvent, "id" | "sessionId">;
}

export interface AddNotePayload {
  text: string;
}

export interface GenerateReportPayload {
  sessionId: string;
  mode: "deterministic" | "ai-enhanced";
}

export interface ReportGeneratedPayload {
  report: Report;
}
