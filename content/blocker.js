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
      urlBlock: /\/(reel|reels)\//,
    },
    "m.facebook.com": {
      selectors: [
        'a[href*="/reel/"]',
        'a[href*="/reels/"]',
      ],
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

  // Load state from storage
  chrome.storage.local.get(["focusGuardEnabled"], (result) => {
    enabled = result.focusGuardEnabled !== false; // default: enabled
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
          ">← Về trang chính</a>
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

    // Don't hide body for non-TikTok sites
    const selectors = hostname === "www.tiktok.com" ? config.selectors : config.selectors;

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
})();
