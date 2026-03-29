document.addEventListener("DOMContentLoaded", () => {
  const mainToggle = document.getElementById("mainToggle");
  const statusEl = document.getElementById("status");
  const blockCountEl = document.getElementById("blockCount");
  const siteCheckboxes = document.querySelectorAll("[data-site]");

  // --- Tabs ---
  const tabs = document.querySelectorAll(".tab");
  const tabContents = document.querySelectorAll(".tab-content");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
    });
  });

  // --- Blocker Tab ---
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

      const today = new Date().toDateString();
      if (result.blockCountDate === today) {
        blockCountEl.textContent = result.blockCount || 0;
      } else {
        blockCountEl.textContent = "0";
        chrome.storage.local.set({ blockCount: 0, blockCountDate: today });
      }
    }
  );

  mainToggle.addEventListener("change", () => {
    const enabled = mainToggle.checked;
    chrome.storage.local.set({ focusGuardEnabled: enabled });
    updateStatusUI(enabled);
    siteCheckboxes.forEach((cb) => {
      cb.disabled = !enabled;
    });
  });

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

  // --- FB Suggestions Toggle ---
  const fbSuggestToggle = document.getElementById("fbSuggestToggle");

  chrome.storage.local.get(["blockFbSuggestions"], (result) => {
    fbSuggestToggle.checked = result.blockFbSuggestions !== false;
  });

  fbSuggestToggle.addEventListener("change", () => {
    chrome.storage.local.set({ blockFbSuggestions: fbSuggestToggle.checked });
  });

  // --- AI Detect Tab ---

  // Sub-tabs
  const subTabs = document.querySelectorAll(".sub-tab");
  const subTabContents = document.querySelectorAll(".sub-tab-content");
  subTabs.forEach((st) => {
    st.addEventListener("click", () => {
      subTabs.forEach((t) => t.classList.remove("active"));
      subTabContents.forEach((c) => c.classList.remove("active"));
      st.classList.add("active");
      document.getElementById("subtab-" + st.dataset.subtab).classList.add("active");
    });
  });

  const aiToggle = document.getElementById("aiToggle");
  const aiStatusEl = document.getElementById("aiStatus");
  const apiKeyInput = document.getElementById("apiKey");
  const aiModelSelect = document.getElementById("aiModel");
  const catCheckboxes = document.querySelectorAll("[data-cat]");
  const saveBtn = document.getElementById("saveAiSettings");
  const aiSaveStatus = document.getElementById("aiSaveStatus");
  const toggleKeyBtn = document.getElementById("toggleKeyVisibility");
  const aiBlockCountEl = document.getElementById("aiBlockCount");

  // Toggle API key visibility
  toggleKeyBtn.addEventListener("click", () => {
    apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
  });

  // Load AI settings
  chrome.storage.local.get(
    ["aiEnabled", "geminiApiKey", "geminiModel", "aiCategories", "aiBlockCount", "aiBlockCountDate"],
    (result) => {
      aiToggle.checked = result.aiEnabled === true;
      if (result.geminiApiKey) apiKeyInput.value = result.geminiApiKey;
      if (result.geminiModel) aiModelSelect.value = result.geminiModel;

      const cats = result.aiCategories || {
        nsfw: true, clickbait: true, gossip: true, doom: false, gambling: false,
      };
      catCheckboxes.forEach((cb) => {
        cb.checked = cats[cb.dataset.cat] === true;
      });

      updateAiStatusUI(result.aiEnabled === true, result.geminiApiKey);

      const today = new Date().toDateString();
      if (result.aiBlockCountDate === today) {
        aiBlockCountEl.textContent = result.aiBlockCount || 0;
      } else {
        aiBlockCountEl.textContent = "0";
        chrome.storage.local.set({ aiBlockCount: 0, aiBlockCountDate: today });
      }
    }
  );

  aiToggle.addEventListener("change", () => {
    const enabled = aiToggle.checked;
    chrome.storage.local.get(["geminiApiKey"], (result) => {
      if (enabled && !result.geminiApiKey) {
        aiToggle.checked = false;
        aiSaveStatus.textContent = "Enter API key first";
        aiSaveStatus.className = "ai-save-status error";
        return;
      }
      chrome.storage.local.set({ aiEnabled: enabled });
      updateAiStatusUI(enabled, result.geminiApiKey);
    });
  });

  saveBtn.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    const model = aiModelSelect.value;
    const categories = {};
    catCheckboxes.forEach((cb) => {
      categories[cb.dataset.cat] = cb.checked;
    });

    if (!apiKey) {
      aiSaveStatus.textContent = "API key is required";
      aiSaveStatus.className = "ai-save-status error";
      return;
    }

    chrome.storage.local.set({
      geminiApiKey: apiKey,
      geminiModel: model,
      aiCategories: categories,
    }, () => {
      aiSaveStatus.textContent = "Saved ✓";
      aiSaveStatus.className = "ai-save-status success";
      updateAiStatusUI(aiToggle.checked, apiKey);
      setTimeout(() => { aiSaveStatus.textContent = ""; }, 2000);
    });
  });

  function updateAiStatusUI(enabled, apiKey) {
    if (!apiKey) {
      aiStatusEl.textContent = "Not configured";
      aiStatusEl.className = "ai-status off";
    } else if (enabled) {
      aiStatusEl.textContent = "AI filtering active ✓";
      aiStatusEl.className = "ai-status on";
    } else {
      aiStatusEl.textContent = "Configured but disabled";
      aiStatusEl.className = "ai-status off";
    }
  }

  // --- Categories Sub-tab ---
  const catDetectToggle = document.getElementById("catDetectToggle");
  const detectedCatsEl = document.getElementById("detectedCategories");
  const catLoadingEl = document.getElementById("catLoading");
  const scanNowBtn = document.getElementById("scanNowBtn");
  const clearCatsBtn = document.getElementById("clearCatsBtn");

  // Load category detection state
  chrome.storage.local.get(["catDetectEnabled", "detectedCategories", "blockedCategories"], (result) => {
    catDetectToggle.checked = result.catDetectEnabled === true;
    renderCategories(result.detectedCategories || {}, result.blockedCategories || {});
  });

  catDetectToggle.addEventListener("change", () => {
    chrome.storage.local.set({ catDetectEnabled: catDetectToggle.checked });
  });

  // Scan current page
  scanNowBtn.addEventListener("click", () => {
    scanNowBtn.textContent = "Scanning...";
    scanNowBtn.disabled = true;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { type: "scanCategories" }, (response) => {
        scanNowBtn.textContent = "Scan Current Page";
        scanNowBtn.disabled = false;
        if (response?.status === "ok") {
          // Reload categories from storage
          setTimeout(() => {
            chrome.storage.local.get(["detectedCategories", "blockedCategories"], (r) => {
              renderCategories(r.detectedCategories || {}, r.blockedCategories || {});
            });
          }, 3000); // wait for AI to process
        }
      });
    });
  });

  // Clear categories
  clearCatsBtn.addEventListener("click", () => {
    chrome.storage.local.set({ detectedCategories: {}, blockedCategories: {} }, () => {
      renderCategories({}, {});
    });
  });

  // Listen for storage changes (categories updated from content script)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.detectedCategories) {
      chrome.storage.local.get(["blockedCategories"], (r) => {
        renderCategories(changes.detectedCategories.newValue || {}, r.blockedCategories || {});
      });
    }
  });

  function renderCategories(detected, blocked) {
    // detected = { "Entertainment": 5, "Gaming": 3, "Education": 2, ... }
    const entries = Object.entries(detected).sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
      catLoadingEl.style.display = "block";
      // Remove any existing category rows
      detectedCatsEl.querySelectorAll(".cat-row").forEach((r) => r.remove());
      return;
    }

    catLoadingEl.style.display = "none";
    // Remove old rows
    detectedCatsEl.querySelectorAll(".cat-row").forEach((r) => r.remove());

    entries.forEach(([category, count]) => {
      const row = document.createElement("div");
      row.className = "cat-row";

      const isBlocked = blocked[category] === true;

      row.innerHTML = `
        <div class="cat-info">
          <span class="cat-name">${category}</span>
          <span class="cat-count">${count} videos</span>
        </div>
        <label class="switch small-switch">
          <input type="checkbox" data-category="${category}" ${isBlocked ? "" : "checked"}>
          <span class="slider"></span>
        </label>
      `;

      const checkbox = row.querySelector("input");
      checkbox.addEventListener("change", () => {
        chrome.storage.local.get(["blockedCategories"], (r) => {
          const bc = r.blockedCategories || {};
          if (checkbox.checked) {
            delete bc[category];
          } else {
            bc[category] = true;
          }
          chrome.storage.local.set({ blockedCategories: bc });
        });
      });

      detectedCatsEl.appendChild(row);
    });
  }
});
