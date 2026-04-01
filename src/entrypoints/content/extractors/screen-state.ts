import { extractLabel } from "./labels";
import { sanitizeUrl } from "../../../lib/privacy";

export interface ScreenSnapshot {
  title: string;
  url: string;
  headings: string[];
  primaryActions: string[];
  secondaryActions: string[];
  visibleComponents: string[];
}

/**
 * Take a snapshot of the current screen state — headings, buttons, forms, etc.
 * Used for grouping events into meaningful screens.
 */
export function captureScreenSnapshot(): ScreenSnapshot {
  return {
    title: document.title || location.pathname,
    url: sanitizeUrl(location.href),
    headings: extractHeadings(),
    primaryActions: extractPrimaryActions(),
    secondaryActions: extractSecondaryActions(),
    visibleComponents: extractVisibleComponents(),
  };
}

function extractHeadings(): string[] {
  const headings = document.querySelectorAll("h1, h2, h3");
  return Array.from(headings)
    .map((h) => h.textContent?.trim())
    .filter((t): t is string => !!t && t.length > 0)
    .slice(0, 10);
}

function extractPrimaryActions(): string[] {
  // Primary actions: submit buttons, primary-styled buttons, CTAs
  const selectors = [
    'button[type="submit"]',
    ".btn-primary",
    '[class*="primary"]',
    '[class*="cta"]',
    'a[class*="primary"]',
  ];

  const elements = document.querySelectorAll(selectors.join(", "));
  return Array.from(elements)
    .map((el) => extractLabel(el))
    .filter((label) => label.length > 0)
    .slice(0, 5);
}

function extractSecondaryActions(): string[] {
  // Secondary: cancel, back, secondary buttons
  const selectors = [
    ".btn-secondary",
    '[class*="secondary"]',
    '[class*="cancel"]',
    '[class*="back"]',
  ];

  const elements = document.querySelectorAll(selectors.join(", "));
  return Array.from(elements)
    .map((el) => extractLabel(el))
    .filter((label) => label.length > 0)
    .slice(0, 5);
}

function extractVisibleComponents(): string[] {
  const components: string[] = [];

  // Check for common component types
  if (document.querySelector("table, [role='grid']"))
    components.push("Data table");
  if (document.querySelector("form")) components.push("Form");
  if (document.querySelector('[role="tablist"]')) components.push("Tabs");
  if (document.querySelector('[role="tree"]')) components.push("Tree view");
  if (document.querySelector('[role="search"], input[type="search"]'))
    components.push("Search");
  if (document.querySelector('[role="alert"]')) components.push("Alert");
  if (document.querySelector('[role="progressbar"]'))
    components.push("Progress bar");
  if (document.querySelector("details, [role='group']"))
    components.push("Accordion");
  if (
    document.querySelector(
      "ul > li, ol > li, [role='list'], [role='listbox']",
    )
  )
    components.push("List");
  if (document.querySelector("img, picture, svg.chart"))
    components.push("Visual content");

  return components;
}
