chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "POLYMAKR_NOTIFICATION") {
    return;
  }

  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: message.title || "PolyMakr",
    message: message.message || "Uma regra foi acionada."
  }, (notificationId) => {
    const error = chrome.runtime.lastError;
    if (error) {
      console.error("Não foi possível exibir a notificação PolyMakr:", error.message);
      sendResponse({ error: error.message });
      return;
    }
    sendResponse({ notificationId });
  });
  return true;
});
