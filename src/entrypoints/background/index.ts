import {
  ensureSessionStateReady,
  startSession,
  stopSession,
  getSessionState,
} from "./session-manager";
import { captureScreenshot } from "./screenshot-service";
import type {
  Message,
  StartRecordingPayload,
  CaptureEventPayload,
  AddNotePayload,
  GenerateReportPayload,
} from "../../lib/types";

export default defineBackground(() => {
  // Open side panel when extension icon is clicked
  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  });

  // ── GAP 1 fix: Re-inject content script on full-page navigation ───────
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status !== "complete") return;

    await ensureSessionStateReady();
    const state = getSessionState();
    if (state.status !== "recording" || state.recordingTabId !== tabId) return;

    const tab = await chrome.tabs.get(tabId);
    if (!isScriptableUrl(tab.url)) return;

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["/content-scripts/content.js"],
      });
      chrome.tabs.sendMessage(tabId, {
        type: "START_RECORDING",
        payload: { sessionId: state.sessionId },
      });
    } catch {
      // Page may not allow script injection (e.g., chrome:// pages)
    }
  });

  // ── GAP 5 fix: Auto-stop recording when the recorded tab is closed ────
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    await ensureSessionStateReady();
    const state = getSessionState();
    if (state.status === "recording" && state.recordingTabId === tabId) {
      await stopSession();
      broadcastStatus();
    }
  });

  // Route messages between content script, side panel, and background
  chrome.runtime.onMessage.addListener(
    (message: Message, sender, sendResponse) => {
      handleMessage(message, sender, sendResponse);
      return true; // keep message channel open for async responses
    },
  );

  async function handleMessage(
    message: Message,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) {
    await ensureSessionStateReady();

    switch (message.type) {
      case "START_RECORDING": {
        const payload = message.payload as StartRecordingPayload;
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (!tab?.id) {
          sendResponse({ success: false, error: "No active tab found" });
          break;
        }

        if (!isScriptableUrl(tab.url)) {
          sendResponse({
            success: false,
            error: "Cannot record on this page",
          });
          break;
        }

        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["/content-scripts/content.js"],
          });

          const session = await startSession(
            payload.sessionName,
            payload.notes,
            tab,
          );

          // Notify content script to start observing
          chrome.tabs.sendMessage(tab.id, {
            type: "START_RECORDING",
            payload: { sessionId: session.id },
          });

          sendResponse({ success: true, session });
          broadcastStatus();
        } catch {
          sendResponse({
            success: false,
            error: "Failed to inject recorder into this tab",
          });
        }
        break;
      }

      case "STOP_RECORDING": {
        const session = await stopSession();
        sendResponse({ success: true, session });
        broadcastStatus();
        break;
      }

      case "RECORDING_STATUS": {
        const state = getSessionState();
        sendResponse(state);
        break;
      }

      case "GET_SESSIONS": {
        const { getAllSessions } = await import(
          "../../lib/storage/session-repository"
        );
        const sessions = await getAllSessions();
        sendResponse({ success: true, sessions });
        break;
      }

      case "GET_SESSION_DETAIL": {
        const { sessionId } = message.payload as { sessionId: string };
        const repo = await import("../../lib/storage/session-repository");
        const [session, events, notes, report] = await Promise.all([
          repo.getSession(sessionId),
          repo.getEventsBySession(sessionId),
          repo.getNotesBySession(sessionId),
          repo.getReportBySession(sessionId),
        ]);
        sendResponse({ success: true, session, events, notes, report });
        break;
      }

      case "DELETE_SESSION": {
        const { sessionId } = message.payload as { sessionId: string };
        const { deleteSession } = await import(
          "../../lib/storage/session-repository"
        );
        await deleteSession(sessionId);
        sendResponse({ success: true });
        break;
      }

      case "GET_EVENTS": {
        const { sessionId } = message.payload as { sessionId: string };
        const { getEventsBySession } = await import(
          "../../lib/storage/session-repository"
        );
        const events = await getEventsBySession(sessionId);
        sendResponse({ success: true, events });
        break;
      }

      case "CAPTURE_STATE": {
        const state = getSessionState();
        if (state.status !== "recording" || !state.sessionId) {
          sendResponse({ success: false });
          break;
        }

        const { snapshot, patterns, navStructure, visualStyles } =
          message.payload as {
            snapshot: {
              title: string;
              url: string;
              headings: string[];
              primaryActions: string[];
              secondaryActions: string[];
              visibleComponents: string[];
            };
            patterns: string[];
            navStructure: {
              primaryNav: {
                label: string;
                href: string;
                isActive: boolean;
              }[];
              secondaryNav: {
                label: string;
                href: string;
                isActive: boolean;
              }[];
              breadcrumbs: string[];
            };
            visualStyles: Record<string, unknown>;
          };

        const { addScreenState } = await import(
          "../../lib/storage/session-repository"
        );
        await addScreenState({
          id: crypto.randomUUID(),
          sessionId: state.sessionId,
          name: snapshot.title,
          url: snapshot.url,
          visibleComponents: [
            ...snapshot.visibleComponents,
            ...patterns,
          ],
          primaryActions: snapshot.primaryActions,
          secondaryActions: snapshot.secondaryActions,
          eventIds: [],
          timestamp: Date.now(),
          metadata: {
            headings: snapshot.headings,
            navStructure,
            patterns,
            visualStyles,
          },
        });
        sendResponse({ success: true });
        break;
      }

      case "CAPTURE_EVENT": {
        const { event } = message.payload as CaptureEventPayload;
        const state = getSessionState();
        if (state.status !== "recording" || !state.sessionId) {
          sendResponse({ success: false });
          break;
        }

        const { addEvent } = await import(
          "../../lib/storage/session-repository"
        );
        const capturedEvent = {
          ...event,
          id: crypto.randomUUID(),
          sessionId: state.sessionId,
        };
        await addEvent(capturedEvent);

        // Forward to side panel for live timeline
        chrome.runtime
          .sendMessage({
            type: "CAPTURE_EVENT",
            payload: { event: capturedEvent },
          })
          .catch(() => {
            // Side panel may not be open — that's fine
          });

        sendResponse({ success: true });
        break;
      }

      case "REQUEST_SCREENSHOT": {
        const state = getSessionState();
        if (state.status !== "recording" || !state.sessionId) {
          sendResponse({ success: false });
          break;
        }

        if (state.recordingTabId === null) {
          sendResponse({ success: false });
          break;
        }

        const screenshot = await captureScreenshot(
          state.sessionId,
          state.recordingTabId,
        );
        sendResponse({ success: true, screenshot });
        break;
      }

      case "ADD_NOTE": {
        const { text } = message.payload as AddNotePayload;
        const state = getSessionState();
        if (!state.sessionId) {
          sendResponse({ success: false });
          break;
        }

        const { addNote } = await import(
          "../../lib/storage/session-repository"
        );
        await addNote({
          id: crypto.randomUUID(),
          sessionId: state.sessionId,
          timestamp: Date.now(),
          text,
        });
        sendResponse({ success: true });
        break;
      }

      case "GENERATE_REPORT": {
        const { sessionId, mode } =
          message.payload as GenerateReportPayload;
        const { generateMarkdownReport } = await import(
          "../../lib/markdown/generator"
        );
        const report = await generateMarkdownReport(sessionId, mode);

        chrome.runtime
          .sendMessage({
            type: "REPORT_GENERATED",
            payload: { report },
          })
          .catch(() => {});

        sendResponse({ success: true, report });
        break;
      }

      default:
        sendResponse({ success: false, error: "Unknown message type" });
    }
  }

  function broadcastStatus() {
    const state = getSessionState();
    chrome.runtime
      .sendMessage({
        type: "RECORDING_STATUS",
        payload: state,
      })
      .catch(() => {});
  }

  function isScriptableUrl(url?: string): boolean {
    if (!url) return false;
    return /^(https?|file):/i.test(url);
  }

  console.log("[Voyager] Background service worker initialized");
});
