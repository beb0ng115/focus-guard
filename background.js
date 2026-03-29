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
    return true;
  }
  if (message.type === "aiBlocked") {
    incrementAiBlockCount();
  }
  if (message.type === "classifyVideos") {
    classifyVideoCategories(message.videos)
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ categories: {} }));
    return true;
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

// --- Video Category Classification ---
async function classifyVideoCategories(videos) {
  // videos = [{ id: "xxx", title: "video title", channel: "channel name" }, ...]
  const data = await chrome.storage.local.get(["geminiApiKey", "geminiModel"]);
  if (!data.geminiApiKey || videos.length === 0) return { categories: {} };

  const model = data.geminiModel || "gemini-2.0-flash";

  const videoList = videos.map((v, i) => `${i + 1}. "${v.title}" by ${v.channel || "unknown"}`).join("\n");

  const prompt = `Classify each video into ONE category. Use these standard categories:
- Entertainment (variety shows, vlogs, comedy, drama, movies, TV clips)
- Music (songs, concerts, music videos, covers, lyrics)
- Gaming (gameplay, walkthroughs, esports, game reviews)
- Education (tutorials, courses, lectures, how-to, science)
- Technology (tech reviews, programming, software, gadgets)
- News (current events, politics, world news)
- Sports (matches, highlights, fitness, workout)
- Lifestyle (cooking, fashion, travel, beauty, DIY)
- Business (finance, investing, entrepreneurship, career)
- Science (research, experiments, documentaries)

Videos:
${videoList}

Respond with ONLY a JSON object mapping video number to category (no markdown, no backticks):
{"1": "Music", "2": "Gaming", "3": "Education"}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(data.geminiApiKey)}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      }),
    });

    if (!response.ok) return { categories: {} };

    const result = await response.json();
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = JSON.parse(responseText.trim());

    // Map back: { videoId: category }
    const mapped = {};
    for (const [num, category] of Object.entries(parsed)) {
      const idx = parseInt(num) - 1;
      if (videos[idx]) {
        mapped[videos[idx].id] = category;
      }
    }

    // Update aggregate counts in storage
    const stored = await chrome.storage.local.get(["detectedCategories"]);
    const counts = stored.detectedCategories || {};
    for (const cat of Object.values(mapped)) {
      counts[cat] = (counts[cat] || 0) + 1;
    }
    await chrome.storage.local.set({ detectedCategories: counts });

    return { categories: mapped };
  } catch {
    return { categories: {} };
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
