/**
 * Focus Guard — Background Service Worker
 * Handles URL blocking via declarativeNetRequest, block counting, and AI content analysis.
 */

// Track blocks
chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener((info) => {
  incrementBlockCount();
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "blocked") {
    incrementBlockCount();
  }
  if (message.type === "analyzeContent") {
    analyzeWithGemini(message.text, message.title)
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ block: false, reason: "" }));
    return true; // keep channel open for async response
  }
  if (message.type === "aiBlocked") {
    incrementAiBlockCount();
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

function incrementAiBlockCount() {
  const today = new Date().toDateString();
  chrome.storage.local.get(["aiBlockCount", "aiBlockCountDate"], (result) => {
    if (result.aiBlockCountDate === today) {
      chrome.storage.local.set({ aiBlockCount: (result.aiBlockCount || 0) + 1 });
    } else {
      chrome.storage.local.set({ aiBlockCount: 1, aiBlockCountDate: today });
    }
  });
}

// --- AI Content Analysis ---
async function analyzeWithGemini(text, title) {
  const data = await chrome.storage.local.get(["geminiApiKey", "geminiModel", "aiCategories"]);
  if (!data.geminiApiKey) return { block: false, reason: "" };

  const model = data.geminiModel || "gemini-2.0-flash";
  const categories = data.aiCategories || {};

  const activeCategories = Object.entries(categories)
    .filter(([, v]) => v)
    .map(([k]) => {
      const labels = {
        nsfw: "NSFW/adult/sexual content",
        clickbait: "clickbait/rage-bait/sensationalism",
        gossip: "celebrity gossip/drama",
        doom: "doom-scrolling/extreme negativity/fear-mongering",
        gambling: "gambling/scams/get-rich-quick schemes",
      };
      return labels[k] || k;
    });

  if (activeCategories.length === 0) return { block: false, reason: "" };

  const prompt = `You are a content filter. Analyze this content and determine if it should be blocked.

Block if the content is about ANY of these categories:
${activeCategories.map((c) => "- " + c).join("\n")}

Content title: "${title || ""}"
Content text: "${text}"

Respond with ONLY a JSON object (no markdown, no backticks):
{"block": true/false, "reason": "short reason" }`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(data.geminiApiKey)}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 100 },
      }),
    });

    if (!response.ok) return { block: false, reason: "" };

    const result = await response.json();
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = JSON.parse(responseText.trim());
    return { block: !!parsed.block, reason: parsed.reason || "" };
  } catch {
    return { block: false, reason: "" };
  }
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
    aiEnabled: false,
    aiBlockCount: 0,
    aiBlockCountDate: new Date().toDateString(),
  });
});
