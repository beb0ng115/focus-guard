/**
 * Focus Guard — Content Script
 * Hides Reels/Shorts elements on YouTube, Facebook, TikTok, Instagram.
 * Runs at document_start, observes DOM mutations continuously.
 */

(function () {
  "use strict";

  const SITE_CONFIGS = {
    "www.youtube.com": {
      selectors: [
        // Shorts shelf on homepage
        'ytd-rich-shelf-renderer[is-shorts]',
        'ytd-reel-shelf-renderer',
        // Shorts tab in sidebar
        'ytd-guide-entry-renderer a[title="Shorts"]',
        'ytd-mini-guide-entry-renderer a[title="Shorts"]',
        // Shorts in search results
        'ytd-video-renderer a[href*="/shorts/"]',
        'ytd-grid-video-renderer a[href*="/shorts/"]',
        // Shorts player page
        'ytd-shorts',
        // Shorts chips/pills
        'yt-chip-cloud-chip-renderer:has([title="Shorts"])',
        // Shorts in recommendations
        'ytd-compact-video-renderer:has(a[href*="/shorts/"])',
        'ytd-rich-item-renderer:has(a[href*="/shorts/"])',
      ],
      urlBlock: /\/shorts\//,
    },
    "www.facebook.com": {
      selectors: [
        // Reels section
        '[aria-label="Reels"]',
        'a[href*="/reel/"]',
        'a[href*="/reels/"]',
        // Reels in feed — parent containers
        'div[data-pagelet*="Reels"]',
        // Watch tab reels
        'a[href*="reel_id"]',
        // Stories + Reels combined section at top
        'div[aria-label="Stories and reels"]',
      ],
      // Suggested/Sponsored content selectors
      suggestionSelectors: [
        // "Suggested for you" sections
        'div[data-pagelet*="FeedUnit"]:has(span:is([dir="auto"]):is(:where(:text("Suggested for you"))))',
        // Sponsored posts
        'div[data-pagelet*="FeedUnit"]:has(a[href*="/ads/"])',
      ],
      urlBlock: /\/(reel|reels)\//,
    },
    "m.facebook.com": {
      selectors: [
        'a[href*="/reel/"]',
        'a[href*="/reels/"]',
      ],
      suggestionSelectors: [],
      urlBlock: /\/(reel|reels)\//,
    },
    "www.tiktok.com": {
      selectors: ["body"], // block entire page
      urlBlock: /.*/,
    },
    "www.instagram.com": {
      selectors: [
        'a[href*="/reels/"]',
        'a[href="/reels/"]',
      ],
      urlBlock: /\/reels\//,
    },
  };

  const hostname = window.location.hostname;
  const config = SITE_CONFIGS[hostname];
  if (!config) return;

  let enabled = true;
  let blockFbSuggestions = true;
  const selectors = config.selectors;

  // Load state from storage
  chrome.storage.local.get(["focusGuardEnabled", "blockFbSuggestions"], (result) => {
    enabled = result.focusGuardEnabled !== false;
    blockFbSuggestions = result.blockFbSuggestions !== false; // default: enabled
    if (enabled) {
      applyBlocking();
      checkUrlBlock();
    }
  });

  // Listen for toggle changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.focusGuardEnabled) {
      enabled = changes.focusGuardEnabled.newValue !== false;
      if (enabled) {
        applyBlocking();
        checkUrlBlock();
      } else {
        removeBlocking();
      }
    }
    if (changes.blockFbSuggestions) {
      blockFbSuggestions = changes.blockFbSuggestions.newValue !== false;
      if (enabled) hideMatchingElements();
    }
  });

  function checkUrlBlock() {
    if (!enabled) return;
    if (config.urlBlock && config.urlBlock.test(window.location.pathname)) {
      // Redirect to homepage of the site
      if (hostname === "www.tiktok.com") {
        showBlockPage("TikTok");
      } else {
        showBlockPage(getBlockedType());
      }
    }
  }

  function getBlockedType() {
    const path = window.location.pathname;
    if (path.includes("shorts")) return "YouTube Shorts";
    if (path.includes("reel")) return "Facebook/Instagram Reels";
    return "Short-form video";
  }

  function showBlockPage(type) {
    document.documentElement.innerHTML = `
      <head><title>Blocked — Focus Guard</title></head>
      <body style="
        display: flex; align-items: center; justify-content: center;
        height: 100vh; margin: 0;
        background: #1a1a2e; color: #eee;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      ">
        <div style="text-align: center; max-width: 480px; padding: 2rem;">
          <div style="font-size: 64px; margin-bottom: 1rem;">🛡️</div>
          <h1 style="font-size: 1.8rem; margin-bottom: 0.5rem; color: #e94560;">Blocked</h1>
          <p style="font-size: 1.1rem; color: #aaa; margin-bottom: 2rem;">
            <strong>${type}</strong> has been blocked by Focus Guard.<br>
            Get back to work. You can disable the extension if needed.
          </p>
          <a href="${window.location.origin}" style="
            display: inline-block; padding: 12px 32px;
            background: #e94560; color: white; text-decoration: none;
            border-radius: 8px; font-weight: 600;
          ">← Back to homepage</a>
        </div>
      </body>
    `;
  }

  function applyBlocking() {
    hideMatchingElements();
    observeDom();
  }

  function hideMatchingElements() {
    if (!enabled || !config.selectors) return;

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          // For link-based selectors, hide the closest meaningful parent
          const target = el.closest(
            'ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-video-renderer, ' +
            'ytd-grid-video-renderer, ytd-rich-shelf-renderer, ytd-reel-shelf-renderer, ' +
            'ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, ' +
            'div[role="article"], div[data-pagelet]'
          ) || el;
          target.setAttribute("data-focus-guard-hidden", "true");
          target.style.setProperty("display", "none", "important");
        });
      } catch {
        // :has() not supported in older browsers, CSS fallback handles it
      }
    }

    // Hide Facebook suggested/sponsored content
    if (blockFbSuggestions && config.suggestionSelectors) {
      hideFbSuggestions();
    }
  }

  function hideFbSuggestions() {
    if (hostname !== "www.facebook.com" && hostname !== "m.facebook.com") return;

    // Target all feed-level containers
    const feedUnits = document.querySelectorAll('div[data-pagelet*="FeedUnit"], div[role="article"], div[data-pagelet*="GroupInline"]');
    feedUnits.forEach((unit) => {
      if (unit.hasAttribute("data-focus-guard-hidden")) return;

      const text = unit.textContent || "";

      // Suggested content — EN + VI
      const isSuggested = /Suggested for you|Suggested groups|Suggested|Gợi ý cho bạn|Gợi ý nhóm|Gợi ý trang|Gợi ý|Được đề xuất/i.test(text);

      // Sponsored — EN + VI
      const isSponsored = /Sponsored|Được tài trợ/i.test(text);

      // Page/follow posts (not friends) — detect "Theo dõi" badge or "Follow" link near page name
      const isPagePost = /· Theo dõi|· Follow/i.test(text);

      // Group join suggestions
      const hasJoinBtn = unit.querySelector('a[href*="/groups/"], div[role="button"]');
      const isGroupSuggestion = /Tham gia nhóm|Join group|Join Group/i.test(text) && hasJoinBtn;

      // Links indicating non-friend content
      const hasPageLink = unit.querySelector('a[href*="/pages/"], a[href*="?ref=nf_target"]');

      if (isSuggested || isSponsored || isPagePost || isGroupSuggestion || hasPageLink) {
        unit.setAttribute("data-focus-guard-hidden", "true");
        unit.setAttribute("data-fb-suggestion", "true");
        unit.style.setProperty("display", "none", "important");
      }
    });

    // Also hide standalone suggestion sections (group suggestions carousel, page suggestions)
    const suggestionSections = document.querySelectorAll(
      'div[data-pagelet*="GroupsYouShouldJoin"], ' +
      'div[data-pagelet*="PagesYouMayLike"], ' +
      'div[data-pagelet*="SuggestedGroups"]'
    );
    suggestionSections.forEach((section) => {
      section.setAttribute("data-focus-guard-hidden", "true");
      section.style.setProperty("display", "none", "important");
    });
  }

  let observer = null;

  function observeDom() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (enabled) {
        hideMatchingElements();
        checkUrlBlock();
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function removeBlocking() {
    // Show all hidden elements
    const hidden = document.querySelectorAll("[data-focus-guard-hidden]");
    hidden.forEach((el) => {
      el.removeAttribute("data-focus-guard-hidden");
      el.style.removeProperty("display");
    });
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // Handle YouTube SPA navigation
  if (hostname === "www.youtube.com") {
    document.addEventListener("yt-navigate-finish", () => {
      if (enabled) checkUrlBlock();
    });
  }

  // --- AI Content Filtering ---
  let aiEnabled = false;
  const analyzedElements = new WeakSet();
  const AI_DEBOUNCE_MS = 1500;
  let aiScanTimer = null;

  chrome.storage.local.get(["aiEnabled"], (result) => {
    aiEnabled = result.aiEnabled === true;
    if (aiEnabled) scheduleAiScan();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.aiEnabled) {
      aiEnabled = changes.aiEnabled.newValue === true;
      if (aiEnabled) scheduleAiScan();
    }
  });

  function scheduleAiScan() {
    if (aiScanTimer) return;
    aiScanTimer = setTimeout(() => {
      aiScanTimer = null;
      scanContentWithAI();
    }, AI_DEBOUNCE_MS);
  }

  // Re-scan on DOM changes (debounced)
  const aiObserver = new MutationObserver(() => {
    if (aiEnabled) scheduleAiScan();
  });

  // Start AI observer once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      aiObserver.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    aiObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function getContentSelectors() {
    switch (hostname) {
      case "www.youtube.com":
        return {
          items: "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer",
          title: "#video-title, #title",
          text: "#description-text, #metadata-line, yt-formatted-string",
        };
      case "www.facebook.com":
      case "m.facebook.com":
        return {
          items: 'div[role="article"], div[data-pagelet*="FeedUnit"]',
          title: 'a[role="link"] strong, h2, h3',
          text: 'div[data-ad-comet-preview="message"], div[dir="auto"]',
        };
      default:
        return {
          items: "article, div[role='article']",
          title: "h1, h2, h3, a",
          text: "p, span",
        };
    }
  }

  async function scanContentWithAI() {
    if (!aiEnabled) return;

    const selectors = getContentSelectors();
    const items = document.querySelectorAll(selectors.items);

    for (const item of items) {
      if (analyzedElements.has(item)) continue;
      if (item.hasAttribute("data-focus-guard-hidden")) continue;
      if (item.hasAttribute("data-ai-analyzed")) continue;

      analyzedElements.add(item);
      item.setAttribute("data-ai-analyzed", "true");

      const titleEl = item.querySelector(selectors.title);
      const textEl = item.querySelector(selectors.text);
      const title = (titleEl?.textContent || "").trim().slice(0, 200);
      const text = (textEl?.textContent || "").trim().slice(0, 500);

      if (!title && !text) continue;

      try {
        const result = await chrome.runtime.sendMessage({
          type: "analyzeContent",
          title,
          text,
        });

        if (result?.block) {
          item.setAttribute("data-focus-guard-hidden", "true");
          item.setAttribute("data-ai-reason", result.reason || "");
          item.style.setProperty("display", "none", "important");
          chrome.runtime.sendMessage({ type: "aiBlocked" });
        }
      } catch {
        // Extension context invalidated or error — skip
      }
    }
  }
})();
