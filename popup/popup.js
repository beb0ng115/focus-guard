document.addEventListener("DOMContentLoaded", () => {
  const mainToggle = document.getElementById("mainToggle");
  const statusEl = document.getElementById("status");
  const blockCountEl = document.getElementById("blockCount");
  const siteCheckboxes = document.querySelectorAll("[data-site]");

  // Load state
  chrome.storage.local.get(
    ["focusGuardEnabled", "blockedSites", "blockCount", "blockCountDate"],
    (result) => {
      const enabled = result.focusGuardEnabled !== false;
      mainToggle.checked = enabled;
      updateStatusUI(enabled);

      const sites = result.blockedSites || {
        youtube: true,
        facebook: true,
        tiktok: true,
        instagram: true,
      };
      siteCheckboxes.forEach((cb) => {
        cb.checked = sites[cb.dataset.site] !== false;
        cb.disabled = !enabled;
      });

      // Daily count — reset if different day
      const today = new Date().toDateString();
      if (result.blockCountDate === today) {
        blockCountEl.textContent = result.blockCount || 0;
      } else {
        blockCountEl.textContent = "0";
        chrome.storage.local.set({ blockCount: 0, blockCountDate: today });
      }
    }
  );

  // Main toggle
  mainToggle.addEventListener("change", () => {
    const enabled = mainToggle.checked;
    chrome.storage.local.set({ focusGuardEnabled: enabled });
    updateStatusUI(enabled);
    siteCheckboxes.forEach((cb) => {
      cb.disabled = !enabled;
    });
  });

  // Site toggles
  siteCheckboxes.forEach((cb) => {
    cb.addEventListener("change", () => {
      const sites = {};
      siteCheckboxes.forEach((c) => {
        sites[c.dataset.site] = c.checked;
      });
      chrome.storage.local.set({ blockedSites: sites });
    });
  });

  function updateStatusUI(enabled) {
    if (enabled) {
      statusEl.textContent = "Protecting you ✓";
      statusEl.classList.remove("off");
    } else {
      statusEl.textContent = "Disabled — be careful!";
      statusEl.classList.add("off");
    }
  }
});
