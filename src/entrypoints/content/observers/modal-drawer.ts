import { OVERLAY_SELECTORS } from "../../../lib/constants";
import { extractLabel } from "../extractors/labels";
import { sanitizeUrl, mayContainSensitiveContent } from "../../../lib/privacy";
import type { CapturedEventType, CapturedEvent } from "../../../lib/types";

type EmitFn = (event: Omit<CapturedEvent, "id" | "sessionId">) => void;

/** Cooldown between modal events to prevent spam from framework re-renders */
const MODAL_COOLDOWN_MS = 1000;

export function setupModalDrawerObserver(emit: EmitFn): () => void {
  // Track currently visible overlay signatures (not element refs, which go stale on re-render)
  const visibleOverlays = new Set<string>();
  const overlayKinds = new Map<string, "modal" | "drawer">();
  let lastEmitTime = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function classifyOverlay(el: Element): "modal" | "drawer" {
    const classes =
      typeof el.className === "string" ? el.className.toLowerCase() : "";
    if (classes.includes("drawer")) return "drawer";
    return "modal";
  }

  function isVisible(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  }

  /** Create a stable signature for an overlay that survives React re-renders */
  function overlaySignature(el: Element): string {
    const tag = el.tagName;
    const id = el.id || "";
    const role = el.getAttribute("role") || "";
    const label = el.getAttribute("aria-label") || "";
    // Use structural identity, not object reference
    return `${tag}:${id}:${role}:${label}`;
  }

  function checkOverlays() {
    const overlays = document.querySelectorAll(OVERLAY_SELECTORS);
    const now = Date.now();
    const currentSignatures = new Set<string>();

    for (const overlay of overlays) {
      const visible = isVisible(overlay);
      const sig = overlaySignature(overlay);
      if (visible) currentSignatures.add(sig);

      const wasVisible = visibleOverlays.has(sig);

      if (visible && !wasVisible) {
        const kind = classifyOverlay(overlay);
        overlayKinds.set(sig, kind);
        visibleOverlays.add(sig);

        if (now - lastEmitTime >= MODAL_COOLDOWN_MS) {
          lastEmitTime = now;

          const label = mayContainSensitiveContent(overlay)
            ? kind
            : (extractLabel(overlay) || kind);
          const type: CapturedEventType =
            kind === "drawer" ? "drawer-open" : "modal-open";

          emit({
            timestamp: now,
            type,
            label: `${kind === "drawer" ? "Drawer" : "Modal"} opened: "${label}"`,
            targetDescription: `${overlay.tagName.toLowerCase()}${overlay.id ? `#${overlay.id}` : ""}`,
            url: sanitizeUrl(location.href),
          });
        }
      }
    }

    // Detect overlays that are no longer visible
    for (const sig of [...visibleOverlays]) {
      if (!currentSignatures.has(sig)) {
        visibleOverlays.delete(sig);

        if (now - lastEmitTime >= MODAL_COOLDOWN_MS) {
          lastEmitTime = now;
          const kind = overlayKinds.get(sig) ?? "modal";
          const type: CapturedEventType =
            kind === "drawer" ? "drawer-close" : "modal-close";

          emit({
            timestamp: now,
            type,
            label: `${kind === "drawer" ? "Drawer" : "Modal"} closed`,
            targetDescription: sig,
            url: sanitizeUrl(location.href),
          });
        }

        overlayKinds.delete(sig);
      }
    }
  }

  const observer = new MutationObserver(() => {
    // Debounce — don't check on every single mutation
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(checkOverlays, 300);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "open", "aria-hidden"],
  });

  // Initial check
  checkOverlays();

  return () => {
    observer.disconnect();
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}
