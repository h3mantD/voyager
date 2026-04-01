import { LABEL_ATTRIBUTES } from "../../../lib/constants";
import { isSensitiveElement } from "../../../lib/privacy";

/**
 * Extract the most human-readable label from a DOM element.
 * Priority: aria-label > title > placeholder (non-sensitive) > innerText > tag description
 *
 * PRIVACY: Never reads element.value. Skips placeholder on password/secret fields.
 * Limits textContent fallback to small elements to avoid capturing container content.
 */
export function extractLabel(element: Element): string {
  // Never extract labels from sensitive inputs
  if (isSensitiveElement(element)) {
    return "[password field]";
  }

  // Check aria and data attributes
  for (const attr of LABEL_ATTRIBUTES) {
    // Skip placeholder on sensitive-looking inputs
    if (attr === "placeholder" && element instanceof HTMLInputElement) {
      if (isSensitiveElement(element)) continue;
    }
    const value = element.getAttribute(attr);
    if (value?.trim()) return truncate(value.trim(), 80);
  }

  // Check for aria-labelledby reference (supports space-separated IDs)
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(" ");
    if (text) return truncate(text, 80);
  }

  // Check direct text content (only shallow — avoid pulling in child element text)
  const directText = getShallowText(element);
  if (directText) return truncate(directText, 80);

  // Full textContent fallback — ONLY for small elements (buttons, links, tabs)
  // Skip for containers (dialogs, modals, sections) that could hold sensitive content
  const childCount = element.children.length;
  if (childCount <= 3) {
    const fullText = element.textContent?.trim();
    if (fullText && fullText.length < 200) return truncate(fullText, 80);
  }

  // For images
  if (element instanceof HTMLImageElement && element.alt) {
    return truncate(element.alt, 80);
  }

  return "";
}

/**
 * Get text directly owned by this element (not from children).
 */
function getShallowText(element: Element): string {
  let text = "";
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    }
  }
  return text.trim();
}

/**
 * Describe an element for the report (tag + id + key classes).
 * PRIVACY: Only structural info — never reads content or values.
 */
export function describeElement(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const role = element.getAttribute("role");
  const roleStr = role ? `[role="${role}"]` : "";

  // Pick at most 2 meaningful classes (skip utility/hash classes)
  const classes = Array.from(element.classList)
    .filter((c) => !c.match(/^[a-z]{1,2}-/) && c.length < 30)
    .slice(0, 2)
    .map((c) => `.${c}`)
    .join("");

  return `${tag}${id}${roleStr}${classes}`;
}

function truncate(text: string, maxLen: number): string {
  // Collapse whitespace
  const cleaned = text.replace(/\s+/g, " ");
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 1) + "\u2026";
}
