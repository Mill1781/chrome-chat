// Allows users to open the side panel by clicking on the action toolbar icon
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// Clear chat history when the browser starts (user requested to clear when all tabs/session closed)
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.remove('chatHistory');
});
