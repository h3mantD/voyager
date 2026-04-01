import { UI_PATTERNS, OVERLAY_SELECTORS } from "../../../lib/constants";

/**
 * Detect commonly used UI patterns on the current page.
 * Returns human-readable pattern names.
 */
export function detectUIPatterns(): string[] {
  const patterns: string[] = [];

  // Sidebar navigation
  if (
    document.querySelector(
      'aside nav, [role="navigation"] aside, .sidebar nav',
    )
  ) {
    patterns.push(UI_PATTERNS.SIDEBAR_NAV);
  }

  // Top navigation bar
  if (document.querySelector("header nav, nav.navbar, nav.topbar")) {
    patterns.push(UI_PATTERNS.TOP_NAV);
  }

  // List-detail layout (sidebar list + main content area)
  if (
    document.querySelector(
      '[class*="list"] + [class*="detail"], [class*="sidebar"] + main',
    )
  ) {
    patterns.push(UI_PATTERNS.LIST_DETAIL);
  }

  // Multi-step wizard (progress indicators, step numbers)
  if (
    document.querySelector(
      '[class*="step"], [class*="wizard"], [role="progressbar"], .stepper',
    )
  ) {
    patterns.push(UI_PATTERNS.WIZARD);
  }

  // Tabbed interface
  if (document.querySelector('[role="tablist"]')) {
    patterns.push(UI_PATTERNS.TABS);
  }

  // Modal / dialog
  if (document.querySelector(OVERLAY_SELECTORS)) {
    patterns.push(UI_PATTERNS.CONFIRMATION_MODAL);
  }

  // Toast notifications
  if (
    document.querySelector(
      '[class*="toast"], [class*="snackbar"], [role="status"]',
    )
  ) {
    patterns.push(UI_PATTERNS.TOAST_FEEDBACK);
  }

  // Table with actions
  const tables = document.querySelectorAll("table, [role='grid']");
  for (const table of tables) {
    if (
      table.querySelector(
        'button, a, [role="button"], [class*="action"]',
      )
    ) {
      patterns.push(UI_PATTERNS.TABLE_ACTIONS);
      break;
    }
  }

  // Breadcrumbs
  if (
    document.querySelector(
      '[aria-label*="breadcrumb"], [class*="breadcrumb"]',
    )
  ) {
    patterns.push(UI_PATTERNS.BREADCRUMBS);
  }

  // Search + filter
  if (
    document.querySelector('input[type="search"], [role="search"]') &&
    document.querySelector('[class*="filter"], select')
  ) {
    patterns.push(UI_PATTERNS.SEARCH_FILTER);
  }

  // Inline form validation
  if (
    document.querySelector(
      '[class*="error"], [class*="invalid"], [aria-invalid="true"]',
    )
  ) {
    patterns.push(UI_PATTERNS.FORM_VALIDATION);
  }

  // Empty state
  if (document.querySelector('[class*="empty"], [class*="no-data"]')) {
    patterns.push(UI_PATTERNS.EMPTY_STATE);
  }

  return patterns;
}
