import { setupNavigationObserver } from "./observers/navigation";
import { setupInteractionObserver } from "./observers/interaction";
import { setupMutationObserver } from "./observers/mutation";
import { setupModalDrawerObserver } from "./observers/modal-drawer";
import { captureScreenSnapshot } from "./extractors/screen-state";
import { detectUIPatterns } from "./extractors/ui-patterns";
import { extractNavigationStructure } from "./extractors/navigation-structure";
import { extractVisualStyles } from "./extractors/visual-style";
import { sanitizeUrl } from "../../lib/privacy";
import type { CapturedEvent, Message } from "../../lib/types";

export default defineContentScript({
  matches: ["<all_urls>"],
  registration: "runtime",
  main(ctx) {
    const globalWindow = window as Window & {
      __voyagerRecorderInjected?: boolean;
    };

    if (globalWindow.__voyagerRecorderInjected) {
      return;
    }
    globalWindow.__voyagerRecorderInjected = true;

    let isRecording = false;
    const cleanups: Array<() => void> = [];

    function emitEvent(event: Omit<CapturedEvent, "id" | "sessionId">) {
      if (!isRecording) return;
      chrome.runtime.sendMessage({
        type: "CAPTURE_EVENT",
        payload: { event },
      });
    }

    function requestScreenshot() {
      if (!isRecording) return;
      chrome.runtime.sendMessage({
        type: "REQUEST_SCREENSHOT",
        payload: {},
      });
    }

    /** Capture a state snapshot — deferred to avoid blocking the main thread */
    function captureStateBoundary() {
      if (!isRecording) return;

      const run = () => {
        if (!isRecording) return;
        const snapshot = captureScreenSnapshot();
        const patterns = detectUIPatterns();
        const navStructure = extractNavigationStructure();
        const visualStyles = extractVisualStyles();

        chrome.runtime.sendMessage({
          type: "CAPTURE_STATE",
          payload: { snapshot, patterns, navStructure, visualStyles },
        });
      };

      if ("requestIdleCallback" in window) {
        (window as Window).requestIdleCallback(run, { timeout: 2000 });
      } else {
        setTimeout(run, 0);
      }
    }

    /** Called at state boundaries — takes screenshot + captures state */
    function onStateBoundary() {
      requestScreenshot();
      captureStateBoundary();
    }

    function startObserving() {
      if (isRecording) return;
      isRecording = true;

      cleanups.push(
        setupNavigationObserver(emitEvent, onStateBoundary),
        setupInteractionObserver(emitEvent),
        setupMutationObserver(emitEvent, onStateBoundary),
        setupModalDrawerObserver(emitEvent),
      );

      // Capture initial state
      onStateBoundary();
      emitEvent({
        timestamp: Date.now(),
        type: "route-change",
        label: document.title || "Page load",
        targetDescription: "Initial page",
        url: sanitizeUrl(location.href),
      });

      console.log("[Voyager] Content script recording started");
    }

    function stopObserving() {
      if (!isRecording) return;
      isRecording = false;
      cleanups.forEach((cleanup) => cleanup());
      cleanups.length = 0;
      console.log("[Voyager] Content script recording stopped");
    }

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message: Message) => {
      switch (message.type) {
        case "START_RECORDING":
          startObserving();
          break;
        case "STOP_RECORDING":
          stopObserving();
          break;
      }
    });

    // Cleanup on context invalidation (extension reload, navigation, etc.)
    ctx.onInvalidated(() => {
      stopObserving();
      globalWindow.__voyagerRecorderInjected = false;
    });
  },
});
