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

  // --- AI Detect Tab ---
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
});
