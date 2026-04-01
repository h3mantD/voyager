import { NAV_SELECTORS } from "../../../lib/constants";
import { extractLabel } from "./labels";

export interface NavItem {
  label: string;
  href: string;
  isActive: boolean;
}

export interface NavigationStructure {
  primaryNav: NavItem[];
  secondaryNav: NavItem[];
  breadcrumbs: string[];
}

/**
 * Extract navigation structure from the current page.
 * Identifies sidebar nav, top nav, breadcrumbs, and active states.
 */
export function extractNavigationStructure(): NavigationStructure {
  const navElements = document.querySelectorAll(NAV_SELECTORS);
  const allNavItems: NavItem[] = [];

  for (const nav of navElements) {
    const links = nav.querySelectorAll("a[href]");
    for (const link of links) {
      const label = extractLabel(link);
      if (!label) continue;

      const href = link.getAttribute("href") ?? "";
      const isActive =
        link.classList.contains("active") ||
        link.getAttribute("aria-current") === "page" ||
        link.getAttribute("aria-selected") === "true" ||
        link.closest("[aria-current='page']") !== null;

      allNavItems.push({ label, href, isActive });
    }
  }

  // Deduplicate by label
  const seen = new Set<string>();
  const unique = allNavItems.filter((item) => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Extract breadcrumbs
  const breadcrumbs = extractBreadcrumbs();

  // Split into primary (first nav) and secondary (rest)
  const midpoint = Math.ceil(unique.length / 2);

  return {
    primaryNav: unique.slice(0, midpoint),
    secondaryNav: unique.slice(midpoint),
    breadcrumbs,
  };
}

function extractBreadcrumbs(): string[] {
  const breadcrumbEl =
    document.querySelector('[aria-label="breadcrumb"]') ??
    document.querySelector('[aria-label="Breadcrumb"]') ??
    document.querySelector(".breadcrumb") ??
    document.querySelector('[class*="breadcrumb"]');

  if (!breadcrumbEl) return [];

  const items = breadcrumbEl.querySelectorAll("a, span, li");
  return Array.from(items)
    .map((el) => el.textContent?.trim())
    .filter((text): text is string => !!text && text.length > 0);
}
