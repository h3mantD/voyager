import { useState, useEffect, useCallback } from "react";
import type {
  CapturedEvent,
  Message,
  RecordingStatus,
  RecordingStatusPayload,
  Report,
} from "../../../lib/types";

interface SessionHook {
  status: RecordingStatus;
  sessionId: string | null;
  events: CapturedEvent[];
  report: Report | null;
  startRecording: (name: string, notes: string) => Promise<void>;
  stopRecording: () => Promise<void>;
  addNote: (text: string) => Promise<void>;
  generateReport: (mode: "deterministic" | "ai-enhanced") => Promise<void>;
  loadSession: (
    sessionId: string | null,
    events: CapturedEvent[],
    report: Report | null,
  ) => void;
}

export function useSession(): SessionHook {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [events, setEvents] = useState<CapturedEvent[]>([]);
  const [report, setReport] = useState<Report | null>(null);

  // Fetch initial status and rehydrate events on mount (handles sidepanel reopen)
  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: "RECORDING_STATUS", payload: {} },
      (response: RecordingStatusPayload & { recordingTabId?: number }) => {
        if (!response) return;

        setStatus(response.status);
        setSessionId(response.sessionId);

        // Rehydrate events from IndexedDB if there's an active or stopped session
        if (
          response.sessionId &&
          (response.status === "recording" || response.status === "stopped")
        ) {
          chrome.runtime.sendMessage(
            {
              type: "GET_EVENTS",
              payload: { sessionId: response.sessionId },
            },
            (eventsResponse: { success: boolean; events: CapturedEvent[] }) => {
              if (eventsResponse?.success && eventsResponse.events.length > 0) {
                // Merge with any live events that arrived while rehydrating
                setEvents((liveEvents) => {
                  const historicalIds = new Set(eventsResponse.events.map((e) => e.id));
                  const newLive = liveEvents.filter((e) => !historicalIds.has(e.id));
                  return [...eventsResponse.events, ...newLive];
                });
              }
            },
          );
        }
      },
    );
  }, []);

  // Listen for live events and status updates
  useEffect(() => {
    const listener = (message: Message) => {
      switch (message.type) {
        case "CAPTURE_EVENT": {
          const { event } = message.payload as { event: CapturedEvent };
          setEvents((prev) => [...prev, event]);
          break;
        }
        case "RECORDING_STATUS": {
          const payload = message.payload as RecordingStatusPayload;
          setStatus(payload.status);
          setSessionId(payload.sessionId);
          break;
        }
        case "REPORT_GENERATED": {
          const { report: r } = message.payload as { report: Report };
          setReport(r);
          break;
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const startRecording = useCallback(
    async (name: string, notes: string) => {
      setEvents([]);
      setReport(null);
      const response = await chrome.runtime.sendMessage({
        type: "START_RECORDING",
        payload: { sessionName: name, notes },
      });
      if (response?.session) {
        setSessionId(response.session.id);
        setStatus("recording");
      }
    },
    [],
  );

  const stopRecording = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({
      type: "STOP_RECORDING",
      payload: {},
    });
    if (response?.success) {
      setStatus("stopped");
    }
  }, []);

  const addNote = useCallback(async (text: string) => {
    await chrome.runtime.sendMessage({
      type: "ADD_NOTE",
      payload: { text },
    });
  }, []);

  const generateReport = useCallback(
    async (mode: "deterministic" | "ai-enhanced") => {
      if (!sessionId) return;
      const response = await chrome.runtime.sendMessage({
        type: "GENERATE_REPORT",
        payload: { sessionId, mode },
      });
      if (response?.report) {
        setReport(response.report);
      }
    },
    [sessionId],
  );

  const loadSession = useCallback(
    (
      sid: string | null,
      loadedEvents: CapturedEvent[],
      loadedReport: Report | null,
    ) => {
      if (sid === null) {
        // Reset to idle for a new recording
        setSessionId(null);
        setEvents([]);
        setReport(null);
        setStatus("idle");
      } else {
        setSessionId(sid);
        setEvents(loadedEvents);
        setReport(loadedReport);
        setStatus("stopped");
      }
    },
    [],
  );

  return {
    status,
    sessionId,
    events,
    report,
    startRecording,
    stopRecording,
    addNote,
    generateReport,
    loadSession,
  };
}
