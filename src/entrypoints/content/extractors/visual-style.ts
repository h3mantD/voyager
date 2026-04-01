/**
 * Visual Style Extractor — captures the "design DNA" of the page:
 * colors, typography, button/modal/input styles, animations, spacing, layout.
 * Used so someone can replicate the UX of a product.
 */

// ── Public API ──────────────────────────────────────────────────────────────

export interface VisualStyleSnapshot {
  colorPalette: ColorInfo[];
  typography: TypographyInfo[];
  buttons: ButtonStyle[];
  inputs: InputStyle[];
  modals: ModalStyle[];
  cards: CardStyle[];
  animations: AnimationInfo[];
  layout: LayoutInfo;
  spacing: SpacingInfo;
  iconStyle: string;
  theme: "light" | "dark" | "mixed";
}

export interface ColorInfo {
  role: string; // "background", "text-primary", "accent", "border", "button-primary", etc.
  value: string; // hex or rgb
  usage: string; // where it was found
}

export interface TypographyInfo {
  role: string; // "heading-1", "body", "caption", "button-text", etc.
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  color: string;
}

export interface ButtonStyle {
  label: string;
  variant: string; // "primary", "secondary", "ghost", "icon", etc.
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
}

export interface InputStyle {
  type: string;
  backgroundColor: string;
  borderRadius: string;
  border: string;
  padding: string;
  fontSize: string;
  placeholder: string;
  height: string;
}

export interface ModalStyle {
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
}

export interface CardStyle {
  backgroundColor: string;
  borderRadius: string;
  border: string;
  shadow: string;
  padding: string;
}

export interface AnimationInfo {
  element: string;
  property: string;
  duration: string;
  timingFunction: string;
  type: "transition" | "keyframe";
}

export interface LayoutInfo {
  type: string; // "sidebar-main", "top-nav-content", "full-width", "centered", etc.
  mainContentWidth: string;
  sidebarWidth: string;
  hasFixedHeader: boolean;
  hasFixedSidebar: boolean;
  gridColumns: string;
  containerMaxWidth: string;
}

export interface SpacingInfo {
  commonGaps: string[];
  commonPaddings: string[];
  sectionSpacing: string;
  cardGap: string;
}

export function extractVisualStyles(): VisualStyleSnapshot {
  return {
    colorPalette: extractColorPalette(),
    typography: extractTypography(),
    buttons: extractButtonStyles(),
    inputs: extractInputStyles(),
    modals: extractModalStyles(),
    cards: extractCardStyles(),
    animations: extractAnimations(),
    layout: extractLayout(),
    spacing: extractSpacing(),
    iconStyle: detectIconStyle(),
    theme: detectTheme(),
  };
}

// ── Color Palette ───────────────────────────────────────────────────────────

function extractColorPalette(): ColorInfo[] {
  const colors: ColorInfo[] = [];
  const seen = new Set<string>();

  function addColor(role: string, value: string, usage: string) {
    const hex = rgbToHex(value);
    if (!hex || seen.has(`${role}:${hex}`)) return;
    seen.add(`${role}:${hex}`);
    colors.push({ role, value: hex, usage });
  }

  // Body background
  const bodyStyle = getComputedStyle(document.body);
  addColor("background", bodyStyle.backgroundColor, "body");
  addColor("text-primary", bodyStyle.color, "body");

  // Header/nav
  const header =
    document.querySelector("header") ??
    document.querySelector("nav") ??
    document.querySelector('[role="banner"]');
  if (header) {
    const s = getComputedStyle(header);
    addColor("header-background", s.backgroundColor, "header/nav");
    addColor("header-text", s.color, "header/nav");
  }

  // Sidebar
  const sidebar =
    document.querySelector("aside") ??
    document.querySelector(".sidebar") ??
    document.querySelector('[class*="sidebar"]');
  if (sidebar) {
    const s = getComputedStyle(sidebar);
    addColor("sidebar-background", s.backgroundColor, "sidebar");
  }

  // Primary buttons
  const primaryBtn = findPrimaryButton();
  if (primaryBtn) {
    const s = getComputedStyle(primaryBtn);
    addColor("button-primary", s.backgroundColor, "primary button");
    addColor("button-primary-text", s.color, "primary button");
  }

  // Links
  const link = document.querySelector("a:not([role])");
  if (link) {
    const s = getComputedStyle(link);
    addColor("link", s.color, "anchor");
  }

  // Borders — sample from a card or container
  const card = document.querySelector(
    '[class*="card"], [class*="panel"], .border',
  );
  if (card) {
    const s = getComputedStyle(card);
    if (s.borderColor && s.borderColor !== "rgb(0, 0, 0)") {
      addColor("border", s.borderColor, "card/panel");
    }
  }

  // Accent / focus
  const focused = document.querySelector(
    '[class*="active"], [class*="selected"], [aria-selected="true"]',
  );
  if (focused) {
    const s = getComputedStyle(focused);
    addColor("accent", s.backgroundColor || s.color, "active/selected element");
  }

  // Error / success / warning (if visible)
  for (const [role, selector] of [
    ["error", '[class*="error"], [class*="danger"], .text-red'],
    ["success", '[class*="success"], .text-green'],
    ["warning", '[class*="warning"], .text-yellow, .text-amber'],
  ] as const) {
    const el = document.querySelector(selector);
    if (el) {
      addColor(role, getComputedStyle(el).color, selector);
    }
  }

  return colors;
}

// ── Typography ──────────────────────────────────────────────────────────────

function extractTypography(): TypographyInfo[] {
  const typo: TypographyInfo[] = [];

  const headingMap: [string, string][] = [
    ["h1", "heading-1"],
    ["h2", "heading-2"],
    ["h3", "heading-3"],
  ];
  for (const [sel, role] of headingMap) {
    const el = document.querySelector(sel);
    if (el) typo.push(getTypoInfo(role, el));
  }

  // Body text
  const bodyP = document.querySelector("p, [class*='body'], main");
  if (bodyP) typo.push(getTypoInfo("body", bodyP));

  // Caption / small text
  const caption = document.querySelector(
    "small, .caption, [class*='caption'], .text-xs, .text-sm",
  );
  if (caption) typo.push(getTypoInfo("caption", caption));

  // Button text
  const btn = findPrimaryButton();
  if (btn) typo.push(getTypoInfo("button", btn));

  // Navigation text
  const navLink = document.querySelector("nav a, [role='navigation'] a");
  if (navLink) typo.push(getTypoInfo("nav-link", navLink));

  return typo;
}

function getTypoInfo(role: string, el: Element): TypographyInfo {
  const s = getComputedStyle(el);
  return {
    role,
    fontFamily: cleanFontFamily(s.fontFamily),
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing === "normal" ? "0" : s.letterSpacing,
    color: toHexOrRaw(s.color),
  };
}

// ── Button Styles ───────────────────────────────────────────────────────────

function extractButtonStyles(): ButtonStyle[] {
  const buttons = document.querySelectorAll(
    'button, [role="button"], a.btn, a[class*="button"]',
  );
  const styles: ButtonStyle[] = [];
  const seen = new Set<string>();

  for (const btn of Array.from(buttons).slice(0, 15)) {
    const s = getComputedStyle(btn);
    const bg = toHexOrRaw(s.backgroundColor);
    const variant = classifyButtonVariant(btn, s);
    const key = `${variant}:${bg}:${s.borderRadius}`;
    if (seen.has(key)) continue;
    seen.add(key);

    styles.push({
      label: btn.textContent?.trim().slice(0, 30) || "button",
      variant,
      backgroundColor: bg,
      textColor: toHexOrRaw(s.color),
      borderRadius: s.borderRadius,
      padding: s.padding,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      border: s.border === "0px none rgb(0, 0, 0)" ? "none" : s.border,
      shadow: s.boxShadow === "none" ? "none" : s.boxShadow,
      hasHoverEffect:
        btn.matches('[class*="hover"]') ||
        s.transition !== "all 0s ease 0s",
      hasIcon: btn.querySelector("svg, img, i, [class*='icon']") !== null,
    });
  }

  return styles;
}

function classifyButtonVariant(el: Element, style: CSSStyleDeclaration): string {
  const classes = el.className?.toString().toLowerCase() ?? "";
  if (classes.includes("primary") || classes.includes("cta")) return "primary";
  if (classes.includes("secondary")) return "secondary";
  if (classes.includes("ghost") || classes.includes("text"))
    return "ghost";
  if (classes.includes("outline")) return "outline";
  if (classes.includes("icon") || !el.textContent?.trim()) return "icon";
  if (classes.includes("destructive") || classes.includes("danger"))
    return "destructive";

  // Infer from styles
  if (
    style.backgroundColor === "transparent" ||
    style.backgroundColor === "rgba(0, 0, 0, 0)"
  ) {
    return style.border !== "0px none rgb(0, 0, 0)" ? "outline" : "ghost";
  }
  return "filled";
}

// ── Input Styles ────────────────────────────────────────────────────────────

function extractInputStyles(): InputStyle[] {
  // Exclude password fields — capture only non-sensitive input styling
  const inputs = document.querySelectorAll(
    'input[type="text"], input[type="email"], input[type="search"], input:not([type]), textarea, select',
  );
  const styles: InputStyle[] = [];
  const seen = new Set<string>();

  for (const input of Array.from(inputs).slice(0, 8)) {
    const s = getComputedStyle(input);
    const key = `${s.borderRadius}:${s.border}:${s.padding}`;
    if (seen.has(key)) continue;
    seen.add(key);

    styles.push({
      type: input.tagName.toLowerCase() === "textarea"
        ? "textarea"
        : (input as HTMLInputElement).type || "text",
      backgroundColor: toHexOrRaw(s.backgroundColor),
      borderRadius: s.borderRadius,
      border: s.border,
      padding: s.padding,
      fontSize: s.fontSize,
      placeholder: "", // Never store placeholder text — could contain sensitive hints
      height: s.height,
    });
  }

  return styles;
}

// ── Modal Styles ────────────────────────────────────────────────────────────

function extractModalStyles(): ModalStyle[] {
  const modals = document.querySelectorAll(
    '[role="dialog"], [aria-modal="true"], dialog, [class*="modal"]',
  );
  const styles: ModalStyle[] = [];

  for (const modal of modals) {
    const rect = modal.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const s = getComputedStyle(modal);

    // Detect overlay/backdrop — check named elements, siblings, and parent
    let hasOverlay = false;
    let overlayColor = "";

    // 1. Check for explicit backdrop/overlay elements anywhere in the DOM
    const backdropEl = document.querySelector(
      '[class*="backdrop"], [class*="overlay"], [class*="mask"], [data-backdrop]',
    );
    if (backdropEl) {
      const bs = getComputedStyle(backdropEl);
      if (isSemiTransparent(bs.backgroundColor)) {
        hasOverlay = true;
        overlayColor = bs.backgroundColor;
      }
    }

    // 2. Check previous sibling (common portal pattern: backdrop then dialog)
    if (!hasOverlay) {
      const prev = modal.previousElementSibling;
      if (prev) {
        const ps = getComputedStyle(prev);
        if (
          (ps.position === "fixed" || ps.position === "absolute") &&
          isSemiTransparent(ps.backgroundColor)
        ) {
          hasOverlay = true;
          overlayColor = ps.backgroundColor;
        }
      }
    }

    // 3. Check parent wrapper (some libs wrap overlay + dialog in a container)
    if (!hasOverlay && modal.parentElement && modal.parentElement !== document.body) {
      const parentS = getComputedStyle(modal.parentElement);
      if (
        (parentS.position === "fixed" || parentS.position === "absolute") &&
        isSemiTransparent(parentS.backgroundColor)
      ) {
        hasOverlay = true;
        overlayColor = parentS.backgroundColor;
      }
    }

    styles.push({
      width: s.width,
      maxWidth: s.maxWidth,
      borderRadius: s.borderRadius,
      backgroundColor: toHexOrRaw(s.backgroundColor),
      shadow: s.boxShadow === "none" ? "none" : summarizeShadow(s.boxShadow),
      hasOverlay,
      overlayColor,
      padding: s.padding,
      hasCloseButton:
        modal.querySelector(
          '[aria-label*="close"], [aria-label*="Close"], .close, [class*="close"]',
        ) !== null,
      animation: s.animation === "none" ? s.transition : s.animation,
    });
  }

  return styles;
}

// ── Card Styles ─────────────────────────────────────────────────────────────

function extractCardStyles(): CardStyle[] {
  const cards = document.querySelectorAll(
    '[class*="card"], [class*="panel"], [class*="tile"], [class*="item"]',
  );
  const styles: CardStyle[] = [];
  const seen = new Set<string>();

  for (const card of Array.from(cards).slice(0, 8)) {
    const s = getComputedStyle(card);
    const key = `${s.borderRadius}:${s.boxShadow}:${s.border}`;
    if (seen.has(key)) continue;
    seen.add(key);

    styles.push({
      backgroundColor: toHexOrRaw(s.backgroundColor),
      borderRadius: s.borderRadius,
      border: s.border === "0px none rgb(0, 0, 0)" ? "none" : s.border,
      shadow: s.boxShadow === "none" ? "none" : summarizeShadow(s.boxShadow),
      padding: s.padding,
    });
  }

  return styles;
}

// ── Animations & Transitions ────────────────────────────────────────────────

function extractAnimations(): AnimationInfo[] {
  const animations: AnimationInfo[] = [];
  const seen = new Set<string>();

  // Sample interactive elements and containers for transitions
  const selectors = [
    "button",
    '[role="button"]',
    "a",
    '[class*="card"]',
    '[role="dialog"]',
    '[class*="modal"]',
    '[class*="drawer"]',
    '[class*="dropdown"]',
    '[class*="menu"]',
    '[class*="tooltip"]',
    '[class*="collapse"]',
    '[class*="accordion"]',
  ];

  for (const sel of selectors) {
    const elements = document.querySelectorAll(sel);
    for (const el of Array.from(elements).slice(0, 5)) {
      const s = getComputedStyle(el);

      // CSS Transitions — filter out elements with no real transition (duration 0s)
      if (s.transitionProperty !== "none" && s.transitionDuration && s.transitionDuration !== "0s") {
        const key = `t:${s.transitionProperty}:${s.transitionDuration}`;
        if (!seen.has(key)) {
          seen.add(key);
          animations.push({
            element: describeEl(el),
            property: s.transitionProperty,
            duration: s.transitionDuration,
            timingFunction: s.transitionTimingFunction,
            type: "transition",
          });
        }
      }

      // CSS Keyframe Animations
      if (s.animationName && s.animationName !== "none") {
        const key = `k:${s.animationName}`;
        if (!seen.has(key)) {
          seen.add(key);
          animations.push({
            element: describeEl(el),
            property: s.animationName,
            duration: s.animationDuration,
            timingFunction: s.animationTimingFunction,
            type: "keyframe",
          });
        }
      }
    }
  }

  return animations;
}

// ── Layout ──────────────────────────────────────────────────────────────────

function extractLayout(): LayoutInfo {
  const body = document.body;
  const main =
    document.querySelector("main") ??
    document.querySelector('[role="main"]') ??
    document.querySelector("#app") ??
    document.querySelector("#root");

  const sidebar =
    document.querySelector("aside") ??
    document.querySelector('[class*="sidebar"]');

  const header =
    document.querySelector("header") ??
    document.querySelector('[role="banner"]');

  let type = "full-width";
  let sidebarWidth = "0";
  let hasFixedSidebar = false;

  if (sidebar) {
    const sidebarStyle = getComputedStyle(sidebar);
    sidebarWidth = sidebarStyle.width;
    hasFixedSidebar =
      sidebarStyle.position === "fixed" ||
      sidebarStyle.position === "sticky";
    type = "sidebar-main";
  }

  let hasFixedHeader = false;
  if (header) {
    const headerStyle = getComputedStyle(header);
    hasFixedHeader =
      headerStyle.position === "fixed" ||
      headerStyle.position === "sticky";
    type = sidebar ? "sidebar-main" : "top-nav-content";
  }

  let mainContentWidth = "100%";
  let gridColumns = "";
  let containerMaxWidth = "";

  if (main) {
    const mainStyle = getComputedStyle(main);
    mainContentWidth = mainStyle.width;
    if (mainStyle.display === "grid") {
      gridColumns = mainStyle.gridTemplateColumns;
    }
    containerMaxWidth = mainStyle.maxWidth;
  }

  // Check if content is centered (don't overwrite sidebar/header classification)
  if (!sidebar && main) {
    const mainStyle = getComputedStyle(main);
    if (
      mainStyle.marginLeft === "auto" ||
      mainStyle.maxWidth !== "none"
    ) {
      type = type === "top-nav-content" ? "top-nav-centered" : "centered";
    }
  }

  return {
    type,
    mainContentWidth,
    sidebarWidth,
    hasFixedHeader,
    hasFixedSidebar,
    gridColumns,
    containerMaxWidth,
  };
}

// ── Spacing ─────────────────────────────────────────────────────────────────

function extractSpacing(): SpacingInfo {
  const gaps = new Map<string, number>();
  const paddings = new Map<string, number>();

  // Sample containers for spacing patterns
  const containers = document.querySelectorAll(
    "main, section, [class*='container'], [class*='content'], [class*='wrapper']",
  );
  for (const el of Array.from(containers).slice(0, 10)) {
    const s = getComputedStyle(el);
    incr(paddings, s.padding);
    if (s.gap && s.gap !== "normal") incr(gaps, s.gap);
    if (s.rowGap && s.rowGap !== "normal") incr(gaps, s.rowGap);
  }

  // Sample list/grid items for gap
  const lists = document.querySelectorAll(
    "ul, ol, [class*='list'], [class*='grid']",
  );
  for (const el of Array.from(lists).slice(0, 10)) {
    const s = getComputedStyle(el);
    if (s.gap && s.gap !== "normal") incr(gaps, s.gap);
  }

  // Section spacing
  const sections = document.querySelectorAll("section, [class*='section']");
  let sectionSpacing = "";
  if (sections.length > 1) {
    const s = getComputedStyle(sections[0]!);
    sectionSpacing = s.marginBottom || s.paddingBottom;
  }

  // Card gap
  let cardGap = "";
  const cardContainer = document.querySelector(
    '[class*="card"]'
  )?.parentElement;
  if (cardContainer) {
    const s = getComputedStyle(cardContainer);
    cardGap = s.gap || "";
  }

  return {
    commonGaps: topN(gaps, 3),
    commonPaddings: topN(paddings, 3),
    sectionSpacing,
    cardGap,
  };
}

// ── Theme Detection ─────────────────────────────────────────────────────────

function detectTheme(): "light" | "dark" | "mixed" {
  const bg = getComputedStyle(document.body).backgroundColor;
  const rgb = parseRgb(bg);
  if (!rgb) return "light";

  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;

  // Check if sidebar has different theme
  const sidebar = document.querySelector("aside, [class*='sidebar']");
  if (sidebar) {
    const sidebarBg = getComputedStyle(sidebar).backgroundColor;
    const sRgb = parseRgb(sidebarBg);
    if (sRgb) {
      const sLum =
        (0.299 * sRgb[0] + 0.587 * sRgb[1] + 0.114 * sRgb[2]) / 255;
      if (
        (luminance > 0.5 && sLum < 0.3) ||
        (luminance < 0.3 && sLum > 0.5)
      ) {
        return "mixed";
      }
    }
  }

  return luminance > 0.5 ? "light" : "dark";
}

// ── Icon Style Detection ────────────────────────────────────────────────────

function detectIconStyle(): string {
  const svgIcons = document.querySelectorAll("svg");
  const fontIcons = document.querySelectorAll(
    'i[class*="icon"], i[class*="fa-"], span[class*="material"], span[class*="icon"]',
  );
  const imgIcons = document.querySelectorAll(
    'img[class*="icon"], img[src*="icon"]',
  );

  const parts: string[] = [];
  if (svgIcons.length > 0) {
    const sample = svgIcons[0]!;
    const fill = sample.getAttribute("fill") || getComputedStyle(sample).color;
    const strokeW = sample.getAttribute("stroke-width");
    parts.push(
      `SVG icons (${svgIcons.length} found${strokeW ? `, stroke-width: ${strokeW}` : ""}${fill ? `, color: ${toHexOrRaw(fill)}` : ""})`,
    );
  }
  if (fontIcons.length > 0) parts.push(`Font icons (${fontIcons.length} found)`);
  if (imgIcons.length > 0) parts.push(`Image icons (${imgIcons.length} found)`);

  return parts.join(", ") || "No icons detected";
}

// ── Utility Functions ───────────────────────────────────────────────────────

function findPrimaryButton(): Element | null {
  return (
    document.querySelector(
      '[class*="primary"], [class*="cta"], button[type="submit"]',
    ) ?? document.querySelector("button")
  );
}

function isSemiTransparent(bg: string): boolean {
  const match = bg.match(/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
  if (!match) return false;
  const alpha = parseFloat(match[1]!);
  return alpha > 0 && alpha < 1;
}

function toHexOrRaw(color: string): string {
  if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return "transparent";
  return rgbToHex(color) ?? color;
}

function cleanFontFamily(raw: string): string {
  // Return just the first font family, without quotes
  return raw.split(",")[0]?.trim().replace(/['"]/g, "") ?? raw;
}

function rgbToHex(color: string): string | null {
  const match = color.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)/,
  );
  if (!match) return null;
  const [, r, g, b] = match;
  return (
    "#" +
    [r, g, b]
      .map((c) => parseInt(c!, 10).toString(16).padStart(2, "0"))
      .join("")
  );
}

function parseRgb(color: string): [number, number, number] | null {
  const match = color.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)/,
  );
  if (!match) return null;
  return [
    parseInt(match[1]!, 10),
    parseInt(match[2]!, 10),
    parseInt(match[3]!, 10),
  ];
}

function summarizeShadow(shadow: string): string {
  // Count shadows and describe
  const parts = shadow.split(/,(?![^(]*\))/);
  if (parts.length === 1) return shadow.slice(0, 60);
  return `${parts.length} layers (${shadow.slice(0, 50)}...)`;
}

function describeEl(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const cls = Array.from(el.classList).slice(0, 2).join(".");
  return cls ? `${tag}.${cls}` : tag;
}

function incr(map: Map<string, number>, key: string) {
  if (!key || key === "0px") return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topN(map: Map<string, number>, n: number): string[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}
