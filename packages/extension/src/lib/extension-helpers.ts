/**
 * Helper utilities for Chrome Extension API calls
 */

export type TabInfo = {
  id: number;
  title: string;
  url: string;
  active: boolean;
  windowId: number;
};

/**
 * Get the ID of the currently active tab
 * @returns The tab ID or null if no active tab found
 */
export async function getActiveTabId(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id ?? null;
}

/**
 * Get all open tabs across all windows
 * @returns Array of TabInfo objects
 */
export async function getAllTabs(): Promise<TabInfo[]> {
  const tabs = await chrome.tabs.query({});

  return tabs.map((tab) => ({
    id: tab.id!,
    title: tab.title ?? "",
    url: tab.url ?? "",
    active: tab.active,
    windowId: tab.windowId,
  }));
}
