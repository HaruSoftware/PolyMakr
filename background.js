chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "POLYMAKR_NOTIFICATION") {
    return;
  }

  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: message.title || "PolyMakr",
    message: message.message || "Uma regra foi acionada."
  });
});
