const status = document.querySelector("#status");

document.querySelector("#open-panel").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url?.includes("polymarket.com")) {
    status.textContent = "Abra uma página do Polymarket primeiro.";
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "POLYMAKR_TOGGLE_PANEL" });
    window.close();
  } catch {
    status.textContent = "Recarregue a página do Polymarket e tente novamente.";
  }
});
