
// ---- Helpers to run code in all tabs ----
async function getAllTabs() {
  return chrome.tabs.query({}); // all windows, all tabs
}

async function runInTab(tabId, func, args = []) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func,
      args
    });
  } catch (e) {
    // Ignore pages where script injection is blocked (e.g., Chrome Web Store, some internal pages)
    console.debug(`Skipping tab ${tabId}:`, e?.message || e);
  }
}

// ---- Content functions (run inside page) ----

// Pause all media elements and (best effort) suspend Web Audio
function pauseAllMediaInPage() {
  // Pause <video> and <audio>
  const media = Array.from(document.querySelectorAll('video, audio'));
  media.forEach(el => {
    try {
      el.pause();
      // Optionally remember paused state via dataset flag
      el.dataset._pausedByExtension = '1';
    } catch (_) {}
  });

  // Try to suspend Web Audio contexts (best effort)
  try {
    // If pages track contexts globally, they sometimes expose them.
    const candidates = [];
    for (const k in window) {
      const v = window[k];
      if (v && typeof v === 'object') {
        if (v instanceof (window.AudioContext || window.webkitAudioContext || Function)) {
          candidates.push(v);
        }
      }
    }
    candidates.forEach(ctx => {
      if (typeof ctx.suspend === 'function') {
        ctx.suspend().catch(() => {});
      }
    });
  } catch (_) {
    // Not guaranteed; safe to ignore
  }
}

// Play media that we paused earlier; resume Web Audio if possible
function resumeAllMediaInPage() {
  const media = Array.from(document.querySelectorAll('video, audio'));
  media.forEach(async el => {
    try {
      // Only auto-play what we paused to avoid forcing play on ads, etc.
      if (el.dataset._pausedByExtension === '1') {
        // Attempt play; may be blocked by autoplay policies if not user-initiated
        await el.play().catch(() => {});
        delete el.dataset._pausedByExtension;
      }
    } catch (_) {}
  });

  try {
    const candidates = [];
    for (const k in window) {
      const v = window[k];
      if (v && typeof v === 'object') {
        if (v instanceof (window.AudioContext || window.webkitAudioContext || Function)) {
          candidates.push(v);
        }
      }
    }
    candidates.forEach(ctx => {
      if (typeof ctx.resume === 'function') {
        ctx.resume().catch(() => {});
      }
    });
  } catch (_) {}
}

// ---- Core actions ----

async function pauseAndMuteAll() {
  const tabs = await getAllTabs();

  // 1) Pause media inside each tab
  await Promise.all(
    tabs.map(tab => runInTab(tab.id, pauseAllMediaInPage))
  );

  // 2) Mute any audible or potentially-audible tabs
  await Promise.all(
    tabs.map(tab => chrome.tabs.update(tab.id, { muted: true }).catch(() => {}))
  );

  // Optional: badge feedback
  await chrome.action.setBadgeBackgroundColor({ color: '#d00' });
  await chrome.action.setBadgeText({ text: '⏸️' });
}

async function resumeAndUnmuteAll() {
  const tabs = await getAllTabs();

  // 1) Resume media in each tab (best effort)
  await Promise.all(
    tabs.map(tab => runInTab(tab.id, resumeAllMediaInPage))
  );

  // 2) Unmute all tabs
  await Promise.all(
    tabs.map(tab => chrome.tabs.update(tab.id, { muted: false }).catch(() => {}))
  );

  // Clear badge
  await chrome.action.setBadgeText({ text: '' });
}

// Toolbar icon => pause & mute
chrome.action.onClicked.addListener(pauseAndMuteAll);

// Context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "pause-mute-all",
    title: "Pause & mute all media",
    contexts: ["action"]
  });
  chrome.contextMenus.create({
    id: "resume-unmute-all",
    title: "Resume & unmute all media",
    contexts: ["action"]
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "pause-mute-all") pauseAndMuteAll();
  if (info.menuItemId === "resume-unmute-all") resumeAndUnmuteAll();
});

// Keyboard shortcuts
chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "pause-mute-all") pauseAndMuteAll();
  if (cmd === "resume-unmute-all") resumeAndUnmuteAll();
});
``
