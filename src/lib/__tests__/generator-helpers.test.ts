import { describe, it, expect } from "vitest";
import {
  escapeYaml,
  escapeMdCell,
  deduplicateEvents,
  groupIntoScreens,
  formatDuration,
  mergeVisualStyles,
} from "../markdown/generator";
import type { CapturedEvent } from "../types";

// ── Helper to create test events ────────────────────────────────────────────

function makeEvent(
  overrides: Partial<CapturedEvent> & { timestamp: number },
): CapturedEvent {
  return {
    id: crypto.randomUUID(),
    sessionId: "test-session",
    type: "click",
    label: "Click button",
    targetDescription: "button.primary",
    url: "https://app.com/dashboard",
    ...overrides,
  };
}

// ── escapeYaml ──────────────────────────────────────────────────────────────

describe("escapeYaml", () => {
  it("returns plain strings as-is", () => {
    expect(escapeYaml("hello")).toBe("hello");
  });

  it("wraps strings with double quotes when they contain special chars", () => {
    expect(escapeYaml('hello "world"')).toBe('"hello \\"world\\""');
  });

  it("escapes newlines", () => {
    expect(escapeYaml("line1\nline2")).toBe('"line1\\nline2"');
  });

  it("escapes carriage returns", () => {
    expect(escapeYaml("line1\rline2")).toBe('"line1\\rline2"');
  });

  it("escapes tabs", () => {
    expect(escapeYaml("col1\tcol2")).toBe('"col1\\tcol2"');
  });

  it("escapes backslashes inside quoted strings", () => {
    // A string with both a newline (triggers quoting) and a backslash
    expect(escapeYaml("path\\to\nfile")).toBe('"path\\\\to\\nfile"');
  });

  it("wraps strings with colons", () => {
    expect(escapeYaml("key: value")).toBe('"key: value"');
  });

  it("wraps strings with brackets", () => {
    expect(escapeYaml("[item]")).toBe('"[item]"');
  });
});

// ── escapeMdCell ────────────────────────────────────────────────────────────

describe("escapeMdCell", () => {
  it("returns normal text as-is", () => {
    expect(escapeMdCell("hello")).toBe("hello");
  });

  it("escapes pipe characters", () => {
    expect(escapeMdCell("a | b | c")).toBe("a \\| b \\| c");
  });

  it("replaces newlines with spaces", () => {
    expect(escapeMdCell("line1\nline2")).toBe("line1 line2");
  });

  it("handles both pipes and newlines", () => {
    expect(escapeMdCell("col1 | col2\nnext")).toBe("col1 \\| col2 next");
  });
});

// ── formatDuration ──────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("formats seconds under a minute", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  it("formats exactly one minute", () => {
    expect(formatDuration(60)).toBe("1m 0s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(152)).toBe("2m 32s");
  });

  it("formats zero seconds", () => {
    expect(formatDuration(0)).toBe("0s");
  });
});

// ── deduplicateEvents ───────────────────────────────────────────────────────

describe("deduplicateEvents", () => {
  it("keeps unique events", () => {
    const events = [
      makeEvent({ timestamp: 1000, type: "click", label: "Button A" }),
      makeEvent({ timestamp: 2000, type: "click", label: "Button B" }),
      makeEvent({ timestamp: 3000, type: "route-change", url: "https://app.com/page2" }),
    ];
    expect(deduplicateEvents(events)).toHaveLength(3);
  });

  it("removes duplicate route-change events within 2s window", () => {
    const events = [
      makeEvent({ timestamp: 1000, type: "route-change", url: "https://app.com/page1" }),
      makeEvent({ timestamp: 1100, type: "route-change", url: "https://app.com/page1" }),
      makeEvent({ timestamp: 1200, type: "route-change", url: "https://app.com/page1" }),
    ];
    expect(deduplicateEvents(events)).toHaveLength(1);
  });

  it("keeps route-change events after 2s gap", () => {
    const events = [
      makeEvent({ timestamp: 1000, type: "route-change", url: "https://app.com/page1" }),
      makeEvent({ timestamp: 4000, type: "route-change", url: "https://app.com/page1" }),
    ];
    expect(deduplicateEvents(events)).toHaveLength(2);
  });

  it("deduplicates modal-open events by label within 2s", () => {
    const events = [
      makeEvent({ timestamp: 1000, type: "modal-open", label: 'Modal opened: "Settings"' }),
      makeEvent({
        timestamp: 1500,
        type: "modal-open",
        label: 'Modal opened: "Settings"',
        targetDescription: "div.modal-v2", // different target (re-render)
      }),
    ];
    expect(deduplicateEvents(events)).toHaveLength(1);
  });

  it("keeps modal-open events with different labels", () => {
    const events = [
      makeEvent({ timestamp: 1000, type: "modal-open", label: 'Modal: "Settings"' }),
      makeEvent({ timestamp: 1500, type: "modal-open", label: 'Modal: "Delete"' }),
    ];
    expect(deduplicateEvents(events)).toHaveLength(2);
  });

  it("removes duplicate clicks within 400ms window", () => {
    const events = [
      makeEvent({ timestamp: 1000, type: "click", label: "Save" }),
      makeEvent({ timestamp: 1200, type: "click", label: "Save" }),
    ];
    expect(deduplicateEvents(events)).toHaveLength(1);
  });

  it("keeps clicks with different labels even within window", () => {
    const events = [
      makeEvent({ timestamp: 1000, type: "click", label: "Save" }),
      makeEvent({ timestamp: 1100, type: "click", label: "Cancel" }),
    ];
    expect(deduplicateEvents(events)).toHaveLength(2);
  });

  it("does not let skipped modal events poison later events", () => {
    // A modal that is skipped by secondary dedup should not prevent
    // a later legitimate event from being emitted
    const events = [
      makeEvent({ timestamp: 1000, type: "modal-open", label: "Modal: X", targetDescription: "div.a" }),
      makeEvent({ timestamp: 1100, type: "modal-open", label: "Modal: X", targetDescription: "div.b" }),
      makeEvent({ timestamp: 4000, type: "modal-open", label: "Modal: X", targetDescription: "div.c" }),
    ];
    const result = deduplicateEvents(events);
    expect(result).toHaveLength(2); // first + third (after 2s gap)
  });
});

// ── groupIntoScreens ────────────────────────────────────────────────────────

describe("groupIntoScreens", () => {
  it("groups events by URL", () => {
    const events = [
      makeEvent({ timestamp: 1000, type: "route-change", url: "https://app.com/a" }),
      makeEvent({ timestamp: 2000, type: "click", url: "https://app.com/a" }),
      makeEvent({ timestamp: 3000, type: "route-change", url: "https://app.com/b" }),
      makeEvent({ timestamp: 4000, type: "click", url: "https://app.com/b" }),
    ];
    const screens = groupIntoScreens(events);
    expect(screens).toHaveLength(2);
    expect(screens[0]!.url).toBe("https://app.com/a");
    expect(screens[1]!.url).toBe("https://app.com/b");
  });

  it("creates a new screen on route-change even if URL is same", () => {
    const events = [
      makeEvent({ timestamp: 1000, type: "route-change", url: "https://app.com/a" }),
      makeEvent({ timestamp: 2000, type: "click", url: "https://app.com/a" }),
      makeEvent({ timestamp: 3000, type: "route-change", url: "https://app.com/a" }),
    ];
    const screens = groupIntoScreens(events);
    // route-change splits screens even on same URL
    expect(screens.length).toBeGreaterThanOrEqual(2);
  });

  it("does NOT split on state-change events", () => {
    const events = [
      makeEvent({ timestamp: 1000, type: "route-change", url: "https://app.com/a" }),
      makeEvent({ timestamp: 2000, type: "state-change", url: "https://app.com/a" }),
      makeEvent({ timestamp: 3000, type: "click", url: "https://app.com/a" }),
    ];
    const screens = groupIntoScreens(events);
    expect(screens).toHaveLength(1); // all on same URL, state-change doesn't split
  });

  it("derives screen name from URL path", () => {
    const events = [
      makeEvent({
        timestamp: 1000,
        type: "click",
        url: "https://app.com/settings/billing",
      }),
    ];
    const screens = groupIntoScreens(events);
    expect(screens[0]!.name).toContain("Settings");
  });

  it("handles empty events list", () => {
    expect(groupIntoScreens([])).toHaveLength(0);
  });
});

// ── mergeVisualStyles ───────────────────────────────────────────────────────

describe("mergeVisualStyles", () => {
  it("returns single style as-is", () => {
    const styles = [
      {
        colorPalette: [{ role: "bg", value: "#fff", usage: "body" }],
        buttons: [],
        animations: [],
      },
    ];
    const result = mergeVisualStyles(styles);
    expect(result.colorPalette).toHaveLength(1);
  });

  it("merges unique colors from earlier captures", () => {
    const styles = [
      {
        colorPalette: [{ role: "accent", value: "#f00", usage: "login page" }],
      },
      {
        colorPalette: [{ role: "bg", value: "#fff", usage: "dashboard" }],
      },
    ];
    const result = mergeVisualStyles(styles);
    expect(result.colorPalette).toHaveLength(2);
  });

  it("does not duplicate same role:value colors", () => {
    const styles = [
      {
        colorPalette: [{ role: "bg", value: "#fff", usage: "page1" }],
      },
      {
        colorPalette: [{ role: "bg", value: "#fff", usage: "page2" }],
      },
    ];
    const result = mergeVisualStyles(styles);
    expect(result.colorPalette).toHaveLength(1);
  });

  it("initializes undefined arrays before merging", () => {
    const styles = [
      {
        colorPalette: [{ role: "accent", value: "#f00", usage: "page1" }],
        buttons: [{ label: "Save", variant: "primary", backgroundColor: "#00f", textColor: "#fff", borderRadius: "4px", padding: "8px", fontSize: "14px", fontWeight: "500", border: "none", shadow: "none", hasHoverEffect: false, hasIcon: false }],
      },
      {
        // base has no colorPalette or buttons
      },
    ];
    const result = mergeVisualStyles(styles);
    // Should have merged from earlier state even though base was empty
    expect(result.colorPalette).toHaveLength(1);
    expect(result.buttons).toHaveLength(1);
  });
});
