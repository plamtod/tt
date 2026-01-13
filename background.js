
// ---- Persisted state key ----
const STATE_KEY = "globalMediaState"; // "paused" | "playing" | undefined

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
    // Some pages block injections (internal pages, store, etc.)
    console.debug(`Skipping tab ${tabId}:`, e?.message || e);
  }
}

// ---- Content functions (run inside the page) ----

// Pause all media elements and (best effort) suspend Web Audio
function pauseAllMediaInPage() {
  const media = Array.from(document.querySelectorAll('video, audio'));
  media.forEach(el => {
    try {
      el.pause();
      el.dataset._pausedByExtension = '1';
    } catch (_) {}
  });

  // Try suspend Web Audio contexts
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const contexts = [];
    // Best-effort scan of global properties (not guaranteed)
    for (const k in window) {
      const v = window[k];
      if (AudioCtx && v instanceof AudioCtx) {
        contexts.push(v);
      }
    }
    contexts.forEach(ctx => {
      if (typeof ctx.suspend === 'function') {
        ctx.suspend().catch(() => {});
      }
    });
  } catch (_) {}
}

function resumeAllMediaInPage() {
  const media = Array.from(document.querySelectorAll('video, audio'));
  media.forEach(async el => {
    try {
      if (el.dataset._pausedByExtension === '1') {
        await el.play().catch(() => {});
        delete el.dataset._pausedByExtension;
      }
    } catch (_) {}
  });

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const contexts = [];
    for (const k in window) {
      const v = window[k];
      if (AudioCtx && v instanceof AudioCtx) {
        contexts.push(v);
      }
    }
    contexts.forEach(ctx => {
      if (typeof ctx.resume === 'function') {
        ctx.resume().catch(() => {});
      }
    });
  } catch (_) {}
}

// ---- Badge helpers ----
async function setBadgePaused() {
  await chrome.action.setBadgeBackgroundColor({ color: '#d00' }); // red
  await chrome.action.setBadgeText({ text: '⏸️' }); // or "II"
  await chrome.storage.local.set({ [STATE_KEY]: "paused" });
}

async function setBadgePlaying() {
  await chrome.action.setBadgeBackgroundColor({ color: '#0b7' }); // green
  await chrome.action.setBadgeText({ text: '▶️' }); // or ">"
  await chrome.storage.local.set({ [STATE_KEY]: "playing" });
}

async function clearBadge() {
  await chrome.action.setBadgeText({ text: '' });
  await chrome.storage.local.remove(STATE_KEY);
}

// Restore badge on service worker start
chrome.runtime.onStartup?.addListener(async () => {
  const { [STATE_KEY]: state } = await chrome.storage.local.get(STATE_KEY);
  if (state === "paused") await setBadgePaused();
  else if (state === "playing") await setBadgePlaying();
  else await clearBadge();
});

// Also run on install/update to initialize badge
chrome.runtime.onInstalled.addListener(async () => {
  const { [STATE_KEY]: state } = await chrome.storage.local.get(STATE_KEY);
  if (state === "paused") await setBadgePaused();
  else if (state === "playing") await setBadgePlaying();
  else await clearBadge();

  // Context menus
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

// ---- Core actions ----
async function pauseAndMuteAll() {
  const tabs = await getAllTabs();

  // 1) Pause media inside each tab
  await Promise.all(tabs.map(tab => runInTab(tab.id, pauseAllMediaInPage)));

  // 2) Mute tabs
  await Promise.all(
    tabs.map(tab => chrome.tabs.update(tab.id, { muted: true }).catch(() => {}))
  );

  await setBadgePaused();
}

async function resumeAndUnmuteAll() {
  const tabs = await getAllTabs();

  // 1) Resume media
  await Promise.all(tabs.map(tab => runInTab(tab.id, resumeAllMediaInPage)));

  // 2) Unmute tabs
  await Promise.all(
    tabs.map(tab => chrome.tabs.update(tab.id, { muted: false }).catch(() => {}))
  );

  await setBadgePlaying();
}

// Toolbar icon => default to "Pause & Mute"
chrome.action.onClicked.addListener(pauseAndMuteAll);

// Context menu actions
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "pause-mute-all") pauseAndMuteAll();
  if (info.menuItemId === "resume-unmute-all") resumeAndUnmuteAll();
});

// Keyboard shortcuts
chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "pause-mute-all") pauseAndMuteAll();
  if (cmd === "resume-unmute-all") resumeAndUnmuteAll();
});
