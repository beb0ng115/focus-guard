/**
 * Focus Guard — Background Service Worker
 * Handles URL blocking via declarativeNetRequest and block counting.
 */

// Track blocks
chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener((info) => {
  incrementBlockCount();
});

// Also count from content script messages
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "blocked") {
    incrementBlockCount();
  }
});

function incrementBlockCount() {
  const today = new Date().toDateString();
  chrome.storage.local.get(["blockCount", "blockCountDate"], (result) => {
    if (result.blockCountDate === today) {
      chrome.storage.local.set({ blockCount: (result.blockCount || 0) + 1 });
    } else {
      chrome.storage.local.set({ blockCount: 1, blockCountDate: today });
    }
  });
}

// Enable/disable declarativeNetRequest rules based on toggle
chrome.storage.onChanged.addListener((changes) => {
  if (changes.focusGuardEnabled) {
    const enabled = changes.focusGuardEnabled.newValue !== false;
    chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: enabled ? ["block_rules"] : [],
      disableRulesetIds: enabled ? [] : ["block_rules"],
    });
  }
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    focusGuardEnabled: true,
    blockedSites: {
      youtube: true,
      facebook: true,
      tiktok: true,
      instagram: true,
    },
    blockCount: 0,
    blockCountDate: new Date().toDateString(),
  });
});
