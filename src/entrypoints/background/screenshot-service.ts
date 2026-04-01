import type { Screenshot } from "../../lib/types";
import { addScreenshot } from "../../lib/storage/session-repository";

export async function captureScreenshot(
  sessionId: string,
  recordingTabId: number,
): Promise<Screenshot | null> {
  try {
    const tab = await chrome.tabs.get(recordingTabId);
    if (!tab.active) return null;

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
      quality: 80,
    });

    const screenshot: Screenshot = {
      id: crypto.randomUUID(),
      sessionId,
      timestamp: Date.now(),
      dataUrl,
      url: tab.url ?? "",
    };

    await addScreenshot(screenshot);
    return screenshot;
  } catch (error) {
    console.warn("[Voyager] Screenshot capture failed:", error);
    return null;
  }
}
