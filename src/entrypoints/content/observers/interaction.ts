import { INTERACTIVE_SELECTORS } from "../../../lib/constants";
import { extractLabel, describeElement } from "../extractors/labels";
import { sanitizeUrl, isSensitiveElement } from "../../../lib/privacy";
import type { CapturedEvent, CapturedEventType } from "../../../lib/types";
import { EVENT_DEBOUNCE_MS } from "../../../lib/constants";

type EmitFn = (event: Omit<CapturedEvent, "id" | "sessionId">) => void;

export function setupInteractionObserver(emit: EmitFn): () => void {
  let lastEmitTime = 0;
  let lastLabel = "";

  function shouldEmit(label: string): boolean {
    const now = Date.now();
    if (label === lastLabel && now - lastEmitTime < EVENT_DEBOUNCE_MS) {
      return false;
    }
    lastEmitTime = now;
    lastLabel = label;
    return true;
  }

  function getEventType(element: Element): CapturedEventType | null {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role");

    if (tag === "a" || role === "link") return "click";
    if (tag === "button" || role === "button") return "click";
    if (tag === "select") return "dropdown-select";
    if (role === "tab") return "tab-switch";
    if (role === "menuitem") return "click";
    if (tag === "input" && element.getAttribute("type") === "submit")
      return "form-submit";
    if (tag === "summary") return "click";

    return null;
  }

  function findInteractiveAncestor(element: Element): Element | null {
    let current: Element | null = element;
    // Walk up at most 5 levels to find an interactive element
    for (let i = 0; i < 5 && current; i++) {
      if (current.matches(INTERACTIVE_SELECTORS)) return current;
      current = current.parentElement;
    }
    return null;
  }

  const onClick = (e: MouseEvent) => {
    const target = e.target as Element;
    if (!target) return;

    const interactiveEl = findInteractiveAncestor(target);
    if (!interactiveEl) return;
    const label = extractLabel(interactiveEl);
    const eventType = getEventType(interactiveEl);

    if (!eventType || !label || !shouldEmit(label)) return;

    emit({
      timestamp: Date.now(),
      type: eventType,
      label: `Clicked "${label}"`,
      targetDescription: describeElement(interactiveEl),
      url: sanitizeUrl(location.href),
    });
  };

  const onSubmit = (e: Event) => {
    const form = e.target as HTMLFormElement;
    const label = extractLabel(form) || "form";

    emit({
      timestamp: Date.now(),
      type: "form-submit",
      label: `Submitted ${label}`,
      targetDescription: describeElement(form),
      url: sanitizeUrl(location.href),
    });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const target = e.target as Element;
    if (!target || !target.matches("input, textarea, [contenteditable]"))
      return;

    // Never record interactions on sensitive inputs
    if (isSensitiveElement(target)) return;

    // Form Enter submissions are captured by onSubmit; avoid duplicate events.
    if (target.closest("form")) return;

    const label = extractLabel(target) || "input";
    if (!shouldEmit(label)) return;

    emit({
      timestamp: Date.now(),
      type: "form-submit",
      label: `Pressed Enter on "${label}"`,
      targetDescription: describeElement(target),
      url: sanitizeUrl(location.href),
    });
  };

  document.addEventListener("click", onClick, true);
  document.addEventListener("submit", onSubmit, true);
  document.addEventListener("keydown", onKeyDown, true);

  return () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("submit", onSubmit, true);
    document.removeEventListener("keydown", onKeyDown, true);
  };
}
