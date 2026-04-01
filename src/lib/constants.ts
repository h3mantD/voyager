// ── Event filtering ─────────────────────────────────────────────────────────

/** Minimum milliseconds between events of the same type to avoid noise */
export const EVENT_DEBOUNCE_MS = 300;

/** Minimum DOM nodes changed to consider it a state boundary.
 * Set high enough to avoid noise from table refreshes, infinite scroll, live data.
 * 100 nodes = a real page transition or major section swap. */
export const STATE_CHANGE_THRESHOLD = 100;

/** Debounce for MutationObserver batches — wait for DOM to settle */
export const MUTATION_BATCH_MS = 800;

// ── Label extraction priority ───────────────────────────────────────────────

export const LABEL_ATTRIBUTES = [
  "aria-label",
  "title",
  "alt",
  "placeholder",
  "name",
  "data-testid",
] as const;

// ── Interactive element selectors ───────────────────────────────────────────

export const INTERACTIVE_SELECTORS = [
  "a[href]",
  "button",
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="link"]',
  "input[type=submit]",
  "input[type=button]",
  "select",
  "details > summary",
].join(", ");

// ── Navigation selectors ────────────────────────────────────────────────────

export const NAV_SELECTORS = [
  "nav",
  '[role="navigation"]',
  '[role="tablist"]',
  '[role="menubar"]',
  "aside",
  ".sidebar",
  ".nav",
  ".navigation",
].join(", ");

// ── Modal / drawer selectors ────────────────────────────────────────────────

export const OVERLAY_SELECTORS = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[aria-modal="true"]',
  ".modal",
  ".drawer",
  '[class*="modal"]',
  '[class*="drawer"]',
  '[class*="overlay"]',
  "dialog",
].join(", ");

// ── UI pattern names ────────────────────────────────────────────────────────

export const UI_PATTERNS = {
  SIDEBAR_NAV: "Left sidebar navigation",
  TOP_NAV: "Top navigation bar",
  LIST_DETAIL: "List-detail layout",
  WIZARD: "Multi-step wizard",
  REVIEW_SUBMIT: "Review-before-submit",
  CONFIRMATION_MODAL: "Confirmation modal",
  TOAST_FEEDBACK: "Toast notification feedback",
  TABLE_ACTIONS: "Table with row actions",
  TABS: "Tabbed interface",
  BREADCRUMBS: "Breadcrumb navigation",
  SEARCH_FILTER: "Search and filter pattern",
  FORM_VALIDATION: "Inline form validation",
  EMPTY_STATE: "Empty state with CTA",
} as const;

// ── Storage keys ────────────────────────────────────────────────────────────

export const DB_NAME = "voyager-db";
export const DB_VERSION = 1;

export const STORES = {
  SESSIONS: "sessions",
  EVENTS: "events",
  SCREENSHOTS: "screenshots",
  SCREEN_STATES: "screen-states",
  JOURNEYS: "journeys",
  NOTES: "notes",
  REPORTS: "reports",
  PROJECTS: "projects",
} as const;
