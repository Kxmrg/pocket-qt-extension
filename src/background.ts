function enableActionSidePanel(): void {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
}

chrome.runtime.onInstalled.addListener(enableActionSidePanel);
enableActionSidePanel();
