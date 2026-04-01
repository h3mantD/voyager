import type { AIMessage } from "../client";

/**
 * Build the prompt for AI-enhanced report generation.
 *
 * Strategy: Don't send the full report — it's too large for most models.
 * Instead, extract only the parts that benefit from AI enhancement (journey,
 * screens, navigation) and send those. The Visual Design System, Event Summary,
 * Screenshots, and LLM Context Block are kept as-is since they contain precise
 * data the AI should not modify.
 */
export function buildReportPolishPrompt(
  deterministicReport: string,
): AIMessage[] {
  const condensed = extractEnhanceableContent(deterministicReport);

  return [
    {
      role: "system",
      content: `You are a product analyst. You receive raw data from a recorded exploration of a SaaS product and produce an enhanced analysis.

Output these sections in Markdown (nothing else):

## Product Summary
2-3 sentences: what the product is, who it's for, what was explored.

## Journey Summary
A narrative of the user's exploration path — what they did and in what order.

## Screen Inventory
A clean, deduplicated list of the distinct screens visited. Use human-friendly names (e.g., "Billing Settings" not "Org > Hemant > Settings > Billing"). For each screen, one line describing what it contains.

## Inferred Mental Model
How the product is organized from a user's perspective — modules, hierarchy, key concepts.

## UX Observations
Notable design patterns, interaction conventions, or UX choices visible from the exploration.

## Adaptation Notes
What elements are worth preserving and what could be simplified when building a similar product.

Rules:
- ONLY use information present in the data below. NEVER invent screens or features not visited.
- Be concise — this will be inserted into a larger report.
- Output valid Markdown only.`,
    },
    {
      role: "user",
      content: condensed,
    },
  ];
}

/**
 * Extract only the parts of the report that benefit from AI enhancement.
 * Strips Visual Design System, Event Summary details, Screenshots, and
 * LLM Context Block to reduce token usage.
 */
function extractEnhanceableContent(report: string): string {
  const lines = report.split("\n");
  const parts: string[] = [];

  // Extract YAML frontmatter
  if (lines[0] === "---") {
    const endIdx = lines.indexOf("---", 1);
    if (endIdx > 0) {
      parts.push(lines.slice(0, endIdx + 1).join("\n"));
    }
  }

  // Extract specific sections, skip heavy ones
  const keepSections = [
    "# Product Exploration",
    "## Navigation Structure",
    "## Journey:",
    "### Step Sequence",
    "## UI Patterns Detected",
    "## User Notes",
  ];

  const skipSections = [
    "## Visual Design System",
    "## Screen Breakdown",
    "## Event Summary",
    "## Screenshots",
    "## LLM Context Block",
  ];

  let capturing = false;
  let skipping = false;

  for (const line of lines) {
    // Check if we hit a section header
    if (line.startsWith("#")) {
      skipping = skipSections.some((s) => line.startsWith(s));
      capturing = !skipping && keepSections.some((s) => line.startsWith(s));

      if (capturing) {
        parts.push(""); // blank line before section
        parts.push(line);
        continue;
      }
    }

    if (capturing && !skipping) {
      parts.push(line);
    }
  }

  return parts.join("\n").trim();
}

/**
 * Stitch the AI-generated analysis sections into the full deterministic report.
 * Inserts AI sections after Navigation Structure and before Journey.
 */
export function stitchAIIntoReport(
  deterministicReport: string,
  aiSections: string,
): string {
  // Find insertion point: after Navigation Structure, before Journey
  const journeyIdx = deterministicReport.indexOf("\n## Journey:");
  if (journeyIdx === -1) {
    // Fallback: prepend AI sections after the first ---
    const firstHr = deterministicReport.indexOf("\n---\n", 10);
    if (firstHr === -1) return aiSections + "\n\n" + deterministicReport;
    return (
      deterministicReport.slice(0, firstHr + 5) +
      "\n" +
      aiSections +
      "\n" +
      deterministicReport.slice(firstHr + 5)
    );
  }

  return (
    deterministicReport.slice(0, journeyIdx) +
    "\n" +
    aiSections +
    "\n" +
    deterministicReport.slice(journeyIdx)
  );
}
