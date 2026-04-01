import type { CapturedEvent } from "../../../lib/types";
import { sanitizeUrl } from "../../../lib/privacy";

type EmitFn = (event: Omit<CapturedEvent, "id" | "sessionId">) => void;
type StateBoundaryFn = () => void;

/** Minimum ms between emitting navigation events for the same URL change */
const NAV_DEBOUNCE_MS = 500;

// Store the true originals once globally, before any patching
const globalWindow = window as Window & {
  __voyagerOrigPushState?: typeof history.pushState;
  __voyagerOrigReplaceState?: typeof history.replaceState;
  __voyagerNavCallbacks?: Set<() => void>;
};

function ensureHistoryPatched() {
  if (globalWindow.__voyagerNavCallbacks) return;

  globalWindow.__voyagerOrigPushState = history.pushState.bind(history);
  globalWindow.__voyagerOrigReplaceState = history.replaceState.bind(history);
  globalWindow.__voyagerNavCallbacks = new Set();

  history.pushState = function (...args) {
    globalWindow.__voyagerOrigPushState!(...args);
    globalWindow.__voyagerNavCallbacks!.forEach((cb) => cb());
  };

  history.replaceState = function (...args) {
    globalWindow.__voyagerOrigReplaceState!(...args);
    globalWindow.__voyagerNavCallbacks!.forEach((cb) => cb());
  };
}

function restoreHistoryIfEmpty() {
  if (
    globalWindow.__voyagerNavCallbacks &&
    globalWindow.__voyagerNavCallbacks.size === 0
  ) {
    history.pushState = globalWindow.__voyagerOrigPushState!;
    history.replaceState = globalWindow.__voyagerOrigReplaceState!;
    delete globalWindow.__voyagerNavCallbacks;
    delete globalWindow.__voyagerOrigPushState;
    delete globalWindow.__voyagerOrigReplaceState;
  }
}

export function setupNavigationObserver(
  emit: EmitFn,
  onStateBoundary: StateBoundaryFn,
): () => void {
  let lastUrl = location.href;
  let lastEmitTime = 0;
  let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  let burstOriginUrl = lastUrl; // origin URL at the start of a debounce burst

  function checkUrlChange() {
    const currentUrl = location.href;
    if (currentUrl === lastUrl) return;

    const now = Date.now();
    const previousUrl = lastUrl;
    lastUrl = currentUrl;

    // Debounce: frameworks often call pushState/replaceState multiple times
    // per navigation (React Router, Inertia, etc.). Only emit once per
    // actual URL change within the debounce window.
    if (now - lastEmitTime < NAV_DEBOUNCE_MS) {
      // Capture burst origin only at the start of a new burst
      if (!pendingTimeout) {
        burstOriginUrl = previousUrl;
      }
      if (pendingTimeout) clearTimeout(pendingTimeout);
      pendingTimeout = setTimeout(() => {
        pendingTimeout = null;
        emitNavigation(burstOriginUrl, location.href);
      }, NAV_DEBOUNCE_MS);
      return;
    }

    emitNavigation(previousUrl, currentUrl);
  }

  function emitNavigation(previousUrl: string, currentUrl: string) {
    lastEmitTime = Date.now();

    emit({
      timestamp: Date.now(),
      type: "route-change",
      label: document.title || location.pathname,
      targetDescription: `Navigated from ${sanitizeUrl(previousUrl)}`,
      url: sanitizeUrl(currentUrl),
    });

    onStateBoundary();
  }

  // Patch history methods once, register our callback
  ensureHistoryPatched();
  globalWindow.__voyagerNavCallbacks!.add(checkUrlChange);

  // Listen for popstate (back/forward)
  const onPopState = () => checkUrlChange();
  window.addEventListener("popstate", onPopState);

  // Listen for hashchange
  const onHashChange = () => checkUrlChange();
  window.addEventListener("hashchange", onHashChange);

  // Poll as fallback — less frequent since we have pushState/replaceState hooks
  const pollInterval = setInterval(checkUrlChange, 2000);

  return () => {
    globalWindow.__voyagerNavCallbacks?.delete(checkUrlChange);
    restoreHistoryIfEmpty();
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("hashchange", onHashChange);
    clearInterval(pollInterval);
    if (pendingTimeout) clearTimeout(pendingTimeout);
  };
}
