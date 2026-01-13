
// Mutes all currently audible tabs across all windows
async function muteAllAudibleTabs() {
  try {
    // Query tabs with audible === true
    const audibleTabs = await chrome.tabs.query({ audible: true });
    const updates = audibleTabs.map(tab =>
      chrome.tabs.update(tab.id, { muted: true })
    );
    await Promise.all(updates);

    // (Optional) show a badge count or a notification
    console.log(`Muted ${audibleTabs.length} tab(s).`);
  } catch (err) {
    console.error('Failed to mute tabs:', err);
  }
}

// Toolbar button click
chrome.action.onClicked.addListener(muteAllAudibleTabs);

// Context menu entry
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "mute-all-audible",
    title: "Mute all audible tabs",
    contexts: ["action"] // shows in the action (toolbar) menu
  });
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "mute-all-audible") {
    muteAllAudibleTabs();
  }
});
