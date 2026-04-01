import {
  MUTATION_BATCH_MS,
  STATE_CHANGE_THRESHOLD,
} from "../../../lib/constants";
import type { CapturedEvent } from "../../../lib/types";
import { sanitizeUrl } from "../../../lib/privacy";

type EmitFn = (event: Omit<CapturedEvent, "id" | "sessionId">) => void;
type StateBoundaryFn = () => void;

/** Minimum ms between state-change emissions to prevent flooding */
const STATE_CHANGE_COOLDOWN_MS = 3000;

export function setupMutationObserver(
  emit: EmitFn,
  onStateBoundary: StateBoundaryFn,
): () => void {
  let batchedMutations: MutationRecord[] = [];
  let batchTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastEmitTime = 0;

  function processBatch() {
    const mutations = batchedMutations;
    batchedMutations = [];

    // Count significant DOM changes
    let addedNodes = 0;
    let removedNodes = 0;

    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        addedNodes += mutation.addedNodes.length;
        removedNodes += mutation.removedNodes.length;
      }
    }

    const totalChanges = addedNodes + removedNodes;
    const now = Date.now();

    // Only emit if: change is significant AND cooldown has elapsed
    if (
      totalChanges >= STATE_CHANGE_THRESHOLD &&
      now - lastEmitTime >= STATE_CHANGE_COOLDOWN_MS
    ) {
      lastEmitTime = now;

      emit({
        timestamp: now,
        type: "state-change",
        label: `Major UI update (${addedNodes} added, ${removedNodes} removed)`,
        targetDescription: "DOM state change detected",
        url: sanitizeUrl(location.href),
      });

      onStateBoundary();
    }
  }

  const observer = new MutationObserver((mutations) => {
    batchedMutations.push(...mutations);

    // Debounce: wait for mutations to settle before processing
    if (batchTimeout) clearTimeout(batchTimeout);
    batchTimeout = setTimeout(processBatch, MUTATION_BATCH_MS);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return () => {
    observer.disconnect();
    if (batchTimeout) clearTimeout(batchTimeout);
  };
}
