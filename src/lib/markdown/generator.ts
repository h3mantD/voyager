import type {
  CapturedEvent,
  Report,
  ScreenState,
  Screenshot,
  Session,
  UserNote,
} from "../types";
import { sanitizeUrl } from "../privacy";
import {
  getEventsBySession,
  getNotesBySession,
  getScreenshotsBySession,
  getScreenStatesBySession,
  getSession,
} from "../storage/session-repository";

/**
 * Generate a structured Markdown report from a recorded session.
 * This is the deterministic generator — no AI required.
 */
export async function generateMarkdownReport(
  sessionId: string,
  mode: "deterministic" | "ai-enhanced",
): Promise<Report> {
  const session = await getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const events = await getEventsBySession(sessionId);
  const notes = await getNotesBySession(sessionId);
  const screenshots = await getScreenshotsBySession(sessionId);
  const screenStates = await getScreenStatesBySession(sessionId);

  const markdown =
    mode === "ai-enhanced"
      ? await generateAIEnhancedReport(session, events, notes, screenshots, screenStates)
      : generateDeterministicReport(session, events, notes, screenshots, screenStates);

  const report: Report = {
    id: crypto.randomUUID(),
    sessionId,
    markdown,
    mode,
    generatedAt: Date.now(),
  };

  const { saveReport } = await import("../storage/session-repository");
  await saveReport(report);

  return report;
}

function generateDeterministicReport(
  session: Session,
  events: CapturedEvent[],
  notes: UserNote[],
  screenshots: Screenshot[],
  screenStates: ScreenState[],
): string {
  const sorted = deduplicateEvents(
    [...events].sort((a, b) => a.timestamp - b.timestamp),
  );
  const screens = groupIntoScreens(sorted);
  // Use rich extractor data if available, fall back to event-based heuristics
  const patterns = screenStates.length > 0
    ? extractPatternsFromStates(screenStates)
    : extractPatterns(sorted);
  const navItems = screenStates.length > 0
    ? extractNavigationFromStates(screenStates)
    : extractNavigationFromEvents(sorted);
  const duration = session.endTime
    ? Math.round((session.endTime - session.startTime) / 1000)
    : 0;

  let md = "";

  // ── YAML Frontmatter ──────────────────────────────────────────────
  md += `---\n`;
  md += `tool: voyager\n`;
  md += `version: "0.1.0"\n`;
  md += `product: ${escapeYaml(session.domain)}\n`;
  md += `domain: ${escapeYaml(session.domain)}\n`;
  md += `captured: ${new Date(session.startTime).toISOString()}\n`;
  md += `journey: ${escapeYaml(session.name)}\n`;
  md += `screens_count: ${screens.length}\n`;
  md += `events_count: ${sorted.length}\n`;
  md += `duration_seconds: ${duration}\n`;
  md += `patterns: [${patterns.map((p) => escapeYaml(p)).join(", ")}]\n`;
  md += `mode: deterministic\n`;
  md += `---\n\n`;

  // ── Title ─────────────────────────────────────────────────────────
  md += `# Product Exploration: ${session.domain}\n\n`;
  md += `**Session:** ${session.name}  \n`;
  md += `**Date:** ${new Date(session.startTime).toLocaleDateString()}  \n`;
  md += `**Duration:** ${formatDuration(duration)}  \n`;
  md += `**Events captured:** ${sorted.length}  \n\n`;

  if (session.notes) {
    md += `> **Session notes:** ${session.notes}\n\n`;
  }

  md += `---\n\n`;

  // ── Navigation Structure ──────────────────────────────────────────
  if (navItems.length > 0) {
    md += `## Navigation Structure\n\n`;
    for (const item of navItems) {
      md += `- ${item}\n`;
    }
    md += `\n`;
  }

  // ── Visual Design System ───────────────────────────────────────────
  md += generateVisualDesignSection(screenStates);

  // ── Journey Overview ──────────────────────────────────────────────
  md += `## Journey: ${session.name}\n\n`;
  md += `**Entry point:** ${sanitizeUrl(sorted[0]?.url ?? "Unknown")}  \n`;
  md += `**Exit point:** ${sanitizeUrl(sorted[sorted.length - 1]?.url ?? "Unknown")}  \n`;
  md += `**Steps:** ${screens.length} screens identified  \n\n`;

  // Step sequence
  md += `### Step Sequence\n\n`;
  for (let i = 0; i < screens.length; i++) {
    const screen = screens[i]!;
    md += `${i + 1}. **${screen.name}** — ${sanitizeUrl(screen.url)}\n`;
    for (const event of screen.events) {
      md += `   - ${event.label}\n`;
    }
    md += `\n`;
  }

  // ── Screen Breakdown ──────────────────────────────────────────────
  md += `## Screen Breakdown\n\n`;
  for (const screen of screens) {
    md += `### ${screen.name}\n\n`;
    md += `- **URL:** ${sanitizeUrl(screen.url)}\n`;
    md += `- **Events:** ${screen.events.length}\n`;
    md += `- **Duration:** ~${screen.durationSec}s\n\n`;

    if (screen.events.length > 0) {
      md += `| Action | Type | Detail |\n`;
      md += `|--------|------|--------|\n`;
      for (const event of screen.events) {
        md += `| ${escapeMdCell(event.label)} | ${event.type} | ${escapeMdCell(event.targetDescription)} |\n`;
      }
      md += `\n`;
    }
  }

  // ── UI Patterns ───────────────────────────────────────────────────
  if (patterns.length > 0) {
    md += `## UI Patterns Detected\n\n`;
    for (const pattern of patterns) {
      md += `- ${pattern}\n`;
    }
    md += `\n`;
  }

  // ── User Notes ────────────────────────────────────────────────────
  if (notes.length > 0) {
    md += `## User Notes\n\n`;
    for (const note of notes) {
      const time = new Date(note.timestamp).toLocaleTimeString();
      md += `- **[${time}]** ${note.text}\n`;
    }
    md += `\n`;
  }

  // ── Event Summary ──────────────────────────────────────────────────
  // Compact summary instead of full timeline to keep report LLM-friendly
  const typeCounts = new Map<string, number>();
  for (const event of sorted) {
    typeCounts.set(event.type, (typeCounts.get(event.type) ?? 0) + 1);
  }
  md += `## Event Summary\n\n`;
  md += `**Total events:** ${sorted.length}  \n\n`;
  md += `| Event Type | Count |\n`;
  md += `|------------|-------|\n`;
  for (const [type, count] of Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])) {
    md += `| ${type} | ${count} |\n`;
  }
  md += `\n`;

  // Only show the last 50 significant events (clicks, navigations, modals — not state-changes)
  const significantEvents = sorted.filter(
    (e) => e.type !== "state-change",
  );
  const recentEvents = significantEvents.slice(-50);
  if (recentEvents.length > 0) {
    md += `### Key Events (last ${recentEvents.length})\n\n`;
    md += `| Time | Type | Action |\n`;
    md += `|------|------|--------|\n`;
    for (const event of recentEvents) {
      const time = new Date(event.timestamp).toLocaleTimeString();
      md += `| ${time} | ${event.type} | ${escapeMdCell(event.label)} |\n`;
    }
    md += `\n`;
  }

  // ── Screenshot Summary ─────────────────────────────────────────────
  // PRIVACY: Screenshots are NOT embedded in the report by default because
  // they may contain visible passwords, API keys, or other sensitive data.
  // Screenshots are stored locally in IndexedDB for the user's own reference.
  if (screenshots.length > 0) {
    const sortedScreenshots = [...screenshots].sort(
      (a, b) => a.timestamp - b.timestamp,
    );
    md += `## Screenshots\n\n`;
    md += `> ${sortedScreenshots.length} screenshot(s) captured during this session. `;
    md += `Screenshots are stored locally and not included in this report to protect sensitive information.\n\n`;
    md += `| # | Time | URL |\n`;
    md += `|---|------|-----|\n`;
    for (let i = 0; i < sortedScreenshots.length; i++) {
      const ss = sortedScreenshots[i]!;
      const time = new Date(ss.timestamp).toLocaleTimeString();
      md += `| ${i + 1} | ${time} | ${escapeMdCell(sanitizeUrl(ss.url))} |\n`;
    }
    md += `\n`;
  }

  // ── LLM Context Block ────────────────────────────────────────────
  md += `---\n\n`;
  md += `## LLM Context Block\n\n`;
  md += `> Use this section as a system prompt prefix when working with this analysis in an LLM.\n\n`;
  md += `\`\`\`\n`;
  md += `I explored ${session.domain} and recorded the journey "${session.name}".\n`;
  md += `The exploration covered ${screens.length} screens with ${sorted.length} interactions over ${formatDuration(duration)}.\n`;
  if (patterns.length > 0) {
    md += `Key UI patterns observed: ${patterns.join(", ")}.\n`;
  }
  md += `Screens visited: ${screens.map((s) => s.name).join(" → ")}.\n`;
  md += `\`\`\`\n`;

  return md;
}

// ── Helpers ───────────────────────────────────────────────────────────────

export function escapeYaml(s: string): string {
  if (/[":{}[\],&*?|>!%#@`\n\r\t]/.test(s)) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}"`;
  }
  return s;
}

export function escapeMdCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export interface ScreenGroup {
  name: string;
  url: string;
  events: CapturedEvent[];
  startTime: number;
  endTime: number;
  durationSec: number;
}

/**
 * Remove duplicate and redundant events to produce a clean, minimal event list.
 * Handles: framework re-renders, duplicate pushState calls, modal spam, nav duplication.
 */
export function deduplicateEvents(events: CapturedEvent[]): CapturedEvent[] {
  const result: CapturedEvent[] = [];
  const lastSeen = new Map<string, number>();
  const NAV_DEDUP_WINDOW_MS = 2000;
  const INTERACTION_DEDUP_WINDOW_MS = 400;

  for (const event of events) {
    const isNavigation = event.type === "route-change";
    const key = isNavigation
      ? `route-change:${event.url}`
      : `${event.type}:${event.url}:${event.label}:${event.targetDescription}`;
    const dedupWindowMs = isNavigation
      ? NAV_DEDUP_WINDOW_MS
      : INTERACTION_DEDUP_WINDOW_MS;
    const prev = lastSeen.get(key);

    // First occurrence of any key always passes; subsequent must exceed the window
    if (prev !== undefined && event.timestamp - prev < dedupWindowMs) {
      continue;
    }

    // For modal events, also dedup by label (same modal re-detected across re-renders)
    if (event.type === "modal-open" || event.type === "drawer-open") {
      const modalKey = `${event.type}:${event.label}`;
      const modalPrev = lastSeen.get(modalKey);
      if (modalPrev !== undefined && event.timestamp - modalPrev < NAV_DEDUP_WINDOW_MS) {
        continue;
      }
      lastSeen.set(modalKey, event.timestamp);
    }

    // Stamp primary key AFTER all dedup checks pass (not before)
    lastSeen.set(key, event.timestamp);
    result.push(event);
  }

  return result;
}

export function groupIntoScreens(events: CapturedEvent[]): ScreenGroup[] {
  const screens: ScreenGroup[] = [];
  let currentUrl = "";
  let currentEvents: CapturedEvent[] = [];
  let screenStart = 0;

  for (const event of events) {
    const isNewScreen =
      event.type === "route-change" || event.url !== currentUrl;

    if (isNewScreen && currentEvents.length > 0) {
      screens.push({
        name: deriveScreenName(currentEvents, currentUrl),
        url: currentUrl,
        events: currentEvents,
        startTime: screenStart,
        endTime: event.timestamp,
        durationSec: Math.round((event.timestamp - screenStart) / 1000),
      });
      currentEvents = [];
    }

    if (isNewScreen) {
      currentUrl = event.url;
      screenStart = event.timestamp;
    }

    currentEvents.push(event);
  }

  // Push last screen
  if (currentEvents.length > 0) {
    const lastEvent = currentEvents[currentEvents.length - 1]!;
    screens.push({
      name: deriveScreenName(currentEvents, currentUrl),
      url: currentUrl,
      events: currentEvents,
      startTime: screenStart,
      endTime: lastEvent.timestamp,
      durationSec: Math.round((lastEvent.timestamp - screenStart) / 1000),
    });
  }

  return screens;
}

function deriveScreenName(events: CapturedEvent[], url: string): string {
  // Use the first navigation or page event's label
  const navEvent = events.find(
    (e) => e.type === "route-change",
  );
  if (navEvent?.label && navEvent.label !== "Page load") {
    return navEvent.label;
  }

  // Fall back to URL path
  try {
    const path = new URL(url).pathname;
    if (path === "/") return "Home";
    return path
      .split("/")
      .filter(Boolean)
      .map((segment) => segment.replace(/-/g, " "))
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" > ");
  } catch {
    return "Unknown Screen";
  }
}

function extractPatterns(events: CapturedEvent[]): string[] {
  const patterns: string[] = [];
  const types = new Set(events.map((e) => e.type));

  if (types.has("modal-open")) patterns.push("Modal dialogs");
  if (types.has("drawer-open")) patterns.push("Drawer panels");
  if (types.has("tab-switch")) patterns.push("Tabbed navigation");
  if (types.has("form-submit")) patterns.push("Form submissions");
  if (types.has("dropdown-select")) patterns.push("Dropdown selections");

  return patterns;
}

function extractNavigationFromEvents(events: CapturedEvent[]): string[] {
  const urls = new Set<string>();
  for (const event of events) {
    if (event.type === "route-change") {
      try {
        const path = new URL(event.url).pathname;
        urls.add(path);
      } catch {
        // skip invalid URLs
      }
    }
  }
  return Array.from(urls);
}

function extractPatternsFromStates(states: ScreenState[]): string[] {
  const allPatterns = new Set<string>();
  for (const state of states) {
    const meta = state.metadata as { patterns?: string[] } | undefined;
    if (meta?.patterns) {
      for (const p of meta.patterns) allPatterns.add(p);
    }
  }
  return Array.from(allPatterns);
}

function extractNavigationFromStates(states: ScreenState[]): string[] {
  const navItems = new Set<string>();
  for (const state of states) {
    const meta = state.metadata as {
      navStructure?: {
        primaryNav?: { label: string }[];
        secondaryNav?: { label: string }[];
      };
    } | undefined;
    if (meta?.navStructure) {
      for (const item of meta.navStructure.primaryNav ?? []) {
        navItems.add(item.label);
      }
      for (const item of meta.navStructure.secondaryNav ?? []) {
        navItems.add(item.label);
      }
    }
  }
  return Array.from(navItems);
}

// ── Visual Design System Section ────────────────────────────────────────────

interface VisualStyles {
  colorPalette?: { role: string; value: string; usage: string }[];
  typography?: {
    role: string;
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    letterSpacing: string;
    color: string;
  }[];
  buttons?: {
    label: string;
    variant: string;
    backgroundColor: string;
    textColor: string;
    borderRadius: string;
    padding: string;
    fontSize: string;
    fontWeight: string;
    border: string;
    shadow: string;
    hasHoverEffect: boolean;
    hasIcon: boolean;
  }[];
  inputs?: {
    type: string;
    backgroundColor: string;
    borderRadius: string;
    border: string;
    padding: string;
    fontSize: string;
    height: string;
  }[];
  modals?: {
    width: string;
    maxWidth: string;
    borderRadius: string;
    backgroundColor: string;
    shadow: string;
    hasOverlay: boolean;
    overlayColor: string;
    padding: string;
    hasCloseButton: boolean;
    animation: string;
  }[];
  cards?: {
    backgroundColor: string;
    borderRadius: string;
    border: string;
    shadow: string;
    padding: string;
  }[];
  animations?: {
    element: string;
    property: string;
    duration: string;
    timingFunction: string;
    type: string;
  }[];
  layout?: {
    type: string;
    mainContentWidth: string;
    sidebarWidth: string;
    hasFixedHeader: boolean;
    hasFixedSidebar: boolean;
    gridColumns: string;
    containerMaxWidth: string;
  };
  spacing?: {
    commonGaps: string[];
    commonPaddings: string[];
    sectionSpacing: string;
    cardGap: string;
  };
  iconStyle?: string;
  theme?: string;
}

export function mergeVisualStyles(allStyles: VisualStyles[]): VisualStyles {
  if (allStyles.length === 1) return allStyles[0]!;

  // Start with the latest capture as the base
  const base = { ...allStyles[allStyles.length - 1]! };

  // Ensure arrays exist so merging can push into them
  base.colorPalette ??= [];
  base.buttons ??= [];
  base.animations ??= [];

  // Merge color palettes — union by role:value
  const seenColors = new Set(
    base.colorPalette?.map((c) => `${c.role}:${c.value}`) ?? [],
  );
  for (const s of allStyles.slice(0, -1)) {
    for (const c of s.colorPalette ?? []) {
      const key = `${c.role}:${c.value}`;
      if (!seenColors.has(key)) {
        base.colorPalette?.push(c);
        seenColors.add(key);
      }
    }
  }

  // Merge button styles — union by variant:backgroundColor
  const seenButtons = new Set(
    base.buttons?.map((b) => `${b.variant}:${b.backgroundColor}`) ?? [],
  );
  for (const s of allStyles.slice(0, -1)) {
    for (const b of s.buttons ?? []) {
      const key = `${b.variant}:${b.backgroundColor}`;
      if (!seenButtons.has(key)) {
        base.buttons?.push(b);
        seenButtons.add(key);
      }
    }
  }

  // Merge animations — union by element:property
  const seenAnims = new Set(
    base.animations?.map((a) => `${a.element}:${a.property}`) ?? [],
  );
  for (const s of allStyles.slice(0, -1)) {
    for (const a of s.animations ?? []) {
      const key = `${a.element}:${a.property}`;
      if (!seenAnims.has(key)) {
        base.animations?.push(a);
        seenAnims.add(key);
      }
    }
  }

  return base;
}

function generateVisualDesignSection(screenStates: ScreenState[]): string {
  // Merge visual styles from all screen states (use the richest/latest capture)
  const allStyles: VisualStyles[] = [];
  for (const state of screenStates) {
    const meta = state.metadata as { visualStyles?: VisualStyles } | undefined;
    if (meta?.visualStyles) allStyles.push(meta.visualStyles);
  }

  if (allStyles.length === 0) return "";

  // Merge visual styles across all screen states to capture the full design language
  const vs = mergeVisualStyles(allStyles);
  let md = `## Visual Design System\n\n`;

  // Theme & Layout
  if (vs.theme || vs.layout) {
    md += `### Theme & Layout\n\n`;
    if (vs.theme) md += `- **Theme:** ${vs.theme}\n`;
    if (vs.layout) {
      md += `- **Layout:** ${escapeMdCell(vs.layout.type)}\n`;
      if (vs.layout.containerMaxWidth && vs.layout.containerMaxWidth !== "none")
        md += `- **Container max-width:** ${vs.layout.containerMaxWidth}\n`;
      if (vs.layout.sidebarWidth && vs.layout.sidebarWidth !== "0")
        md += `- **Sidebar width:** ${vs.layout.sidebarWidth}\n`;
      md += `- **Fixed header:** ${vs.layout.hasFixedHeader ? "Yes" : "No"}\n`;
      md += `- **Fixed sidebar:** ${vs.layout.hasFixedSidebar ? "Yes" : "No"}\n`;
      if (vs.layout.gridColumns)
        md += `- **Grid columns:** ${escapeMdCell(vs.layout.gridColumns)}\n`;
    }
    md += `\n`;
  }

  // Color Palette
  if (vs.colorPalette && vs.colorPalette.length > 0) {
    md += `### Color Palette\n\n`;
    md += `| Role | Color | Usage |\n`;
    md += `|------|-------|-------|\n`;
    for (const c of vs.colorPalette) {
      md += `| ${escapeMdCell(c.role)} | \`${c.value}\` | ${escapeMdCell(c.usage)} |\n`;
    }
    md += `\n`;
  }

  // Typography
  if (vs.typography && vs.typography.length > 0) {
    md += `### Typography\n\n`;
    md += `| Role | Font | Size | Weight | Line Height | Spacing | Color |\n`;
    md += `|------|------|------|--------|-------------|---------|-------|\n`;
    for (const t of vs.typography) {
      md += `| ${escapeMdCell(t.role)} | ${escapeMdCell(t.fontFamily)} | ${t.fontSize} | ${t.fontWeight} | ${t.lineHeight} | ${t.letterSpacing || "0"} | \`${t.color}\` |\n`;
    }
    md += `\n`;
  }

  // Button Styles
  if (vs.buttons && vs.buttons.length > 0) {
    md += `### Button Styles\n\n`;
    for (const btn of vs.buttons) {
      md += `**${escapeMdCell(btn.label)}** (${btn.variant})\n`;
      md += `- Background: \`${btn.backgroundColor}\`, Text: \`${btn.textColor}\`\n`;
      md += `- Border radius: ${btn.borderRadius}, Padding: ${btn.padding}\n`;
      md += `- Font: ${btn.fontSize} / ${btn.fontWeight}\n`;
      if (btn.border !== "none") md += `- Border: ${escapeMdCell(btn.border)}\n`;
      if (btn.shadow !== "none") md += `- Shadow: ${escapeMdCell(btn.shadow)}\n`;
      if (btn.hasHoverEffect) md += `- Has hover effect\n`;
      if (btn.hasIcon) md += `- Has icon\n`;
      md += `\n`;
    }
  }

  // Input Styles
  if (vs.inputs && vs.inputs.length > 0) {
    md += `### Input Styles\n\n`;
    md += `| Type | Border Radius | Border | Padding | Height | Font Size |\n`;
    md += `|------|---------------|--------|---------|--------|-----------|\n`;
    for (const inp of vs.inputs) {
      md += `| ${inp.type} | ${inp.borderRadius} | ${escapeMdCell(inp.border)} | ${inp.padding} | ${inp.height} | ${inp.fontSize} |\n`;
    }
    md += `\n`;
  }

  // Modal Styles
  if (vs.modals && vs.modals.length > 0) {
    md += `### Modal / Dialog Styles\n\n`;
    for (const m of vs.modals) {
      md += `- **Size:** ${m.width} (max: ${m.maxWidth})\n`;
      md += `- **Border radius:** ${m.borderRadius}\n`;
      md += `- **Background:** \`${m.backgroundColor}\`\n`;
      if (m.shadow !== "none") md += `- **Shadow:** ${escapeMdCell(m.shadow)}\n`;
      md += `- **Overlay:** ${m.hasOverlay ? `Yes (${m.overlayColor})` : "No"}\n`;
      md += `- **Close button:** ${m.hasCloseButton ? "Yes" : "No"}\n`;
      if (m.animation && m.animation !== "none" && m.animation !== "all 0s ease 0s")
        md += `- **Animation:** ${escapeMdCell(m.animation)}\n`;
      md += `\n`;
    }
  }

  // Card Styles
  if (vs.cards && vs.cards.length > 0) {
    md += `### Card / Panel Styles\n\n`;
    md += `| Background | Border Radius | Border | Shadow | Padding |\n`;
    md += `|------------|---------------|--------|--------|---------|\n`;
    for (const c of vs.cards) {
      md += `| \`${c.backgroundColor}\` | ${c.borderRadius} | ${escapeMdCell(c.border)} | ${escapeMdCell(c.shadow)} | ${c.padding} |\n`;
    }
    md += `\n`;
  }

  // Animations & Transitions
  if (vs.animations && vs.animations.length > 0) {
    md += `### Animations & Transitions\n\n`;
    md += `| Element | Type | Property | Duration | Easing |\n`;
    md += `|---------|------|----------|----------|--------|\n`;
    for (const a of vs.animations) {
      md += `| ${escapeMdCell(a.element)} | ${a.type} | ${escapeMdCell(a.property)} | ${a.duration} | ${escapeMdCell(a.timingFunction)} |\n`;
    }
    md += `\n`;
  }

  // Spacing
  if (vs.spacing) {
    const sp = vs.spacing;
    if (sp.commonGaps.length > 0 || sp.commonPaddings.length > 0) {
      md += `### Spacing System\n\n`;
      if (sp.commonGaps.length > 0)
        md += `- **Common gaps:** ${sp.commonGaps.join(", ")}\n`;
      if (sp.commonPaddings.length > 0)
        md += `- **Common paddings:** ${sp.commonPaddings.join(", ")}\n`;
      if (sp.sectionSpacing)
        md += `- **Section spacing:** ${sp.sectionSpacing}\n`;
      if (sp.cardGap) md += `- **Card gap:** ${sp.cardGap}\n`;
      md += `\n`;
    }
  }

  // Icons
  if (vs.iconStyle && vs.iconStyle !== "No icons detected") {
    md += `### Icon Style\n\n`;
    md += `${escapeMdCell(vs.iconStyle)}\n\n`;
  }

  return md;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

async function generateAIEnhancedReport(
  session: Session,
  events: CapturedEvent[],
  notes: UserNote[],
  screenshots: Screenshot[],
  screenStates: ScreenState[],
): Promise<string> {
  // For now, fall back to deterministic. AI integration in Phase 3.
  return (
    generateDeterministicReport(session, events, notes, screenshots, screenStates) +
    "\n\n> *AI enhancement coming soon. This report was generated deterministically.*\n"
  );
}
