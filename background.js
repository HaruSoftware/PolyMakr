const ARCHIVE_KEY = "polymakr.archive";
const EXECUTION_STATE_PREFIX = "polymakr.execution.";
const ORDER_TRACKING_ALARM = "polymakr-order-tracking";
let orderPollRunning = false;

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

chrome.runtime.onStartup.addListener(scheduleOrderTracking);
chrome.runtime.onInstalled.addListener(scheduleOrderTracking);
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[ARCHIVE_KEY]) {
    scheduleOrderTracking();
  }
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ORDER_TRACKING_ALARM) {
    pollArchivedOrders().catch((error) => {
      console.error("Não foi possível acompanhar os fills do Polymarket:", error);
    });
  }
});

async function scheduleOrderTracking() {
  try {
    const stored = await chrome.storage.local.get(ARCHIVE_KEY);
    const hasPending = (Array.isArray(stored[ARCHIVE_KEY]) ? stored[ARCHIVE_KEY] : [])
      .some((entry) => ["awaiting_fill", "partially_filled"].includes(entry.status));
    if (hasPending) {
      const existingAlarm = await chrome.alarms.get(ORDER_TRACKING_ALARM);
      if (!existingAlarm) {
        await chrome.alarms.create(ORDER_TRACKING_ALARM, { delayInMinutes: 0.1, periodInMinutes: 1 });
      }
    } else {
      await chrome.alarms.clear(ORDER_TRACKING_ALARM);
    }
  } catch (error) {
    console.error("Não foi possível agendar o acompanhamento dos fills:", error);
  }
}

async function pollArchivedOrders() {
  if (orderPollRunning) return;
  orderPollRunning = true;
  try {
    await pollArchivedOrdersLocked();
  } finally {
    orderPollRunning = false;
  }
}

async function pollArchivedOrdersLocked() {
  const stored = await chrome.storage.local.get(null);
  const archive = Array.isArray(stored[ARCHIVE_KEY]) ? stored[ARCHIVE_KEY] : [];
  const pending = archive.filter((entry) =>
    ["awaiting_fill", "partially_filled"].includes(entry.status)
    && entry.rule?.walletAddress
    && entry.conditionId
    && entry.assetId
  );
  if (pending.length === 0) {
    await chrome.alarms.clear(ORDER_TRACKING_ALARM);
    return;
  }

  const groups = new Map();
  for (const entry of pending) {
    const key = `${entry.rule.walletAddress.toLowerCase()}|${entry.conditionId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  const updates = new Map();
  for (const entries of groups.values()) {
    try {
      const trades = await fetchPublicTrades(entries[0].rule.walletAddress, entries[0].conditionId);
      for (const entry of entries) {
        updates.set(entry.id, reconcileOrderFills(entry, trades, entries));
      }
    } catch (error) {
      for (const entry of entries) {
        updates.set(entry.id, {
          ...entry,
          trackingError: error.message || String(error),
          updatedAt: Date.now()
        });
      }
    }
  }

  await navigator.locks.request("polymakr-rules-storage", async () => {
    const current = await chrome.storage.local.get(null);
    const currentArchive = Array.isArray(current[ARCHIVE_KEY]) ? current[ARCHIVE_KEY] : [];
    const nextArchive = currentArchive.map((entry) => {
      const update = updates.get(entry.id);
      return update && ["awaiting_fill", "partially_filled"].includes(entry.status)
        ? { ...entry, ...update, archivedAt: entry.archivedAt }
        : entry;
    });
    const changes = { [ARCHIVE_KEY]: nextArchive };
    for (const [id, entry] of updates) {
      const stateKey = `${EXECUTION_STATE_PREFIX}${encodeURIComponent(entry.rule.marketKey)}`;
      const states = changes[stateKey] || current[stateKey] || {};
      if (!["awaiting_fill", "partially_filled"].includes(states[id]?.status)) continue;
      states[id] = {
        ...states[id],
        status: entry.status,
        message: entry.message,
        matchedShares: entry.matchedShares || 0,
        updatedAt: entry.updatedAt
      };
      changes[stateKey] = states;
    }
    await chrome.storage.local.set(changes);
  });
  await scheduleOrderTracking();
}

async function fetchPublicTrades(walletAddress, conditionId) {
  const url = new URL("https://data-api.polymarket.com/v2/trades");
  url.searchParams.set("user", walletAddress.toLowerCase());
  url.searchParams.set("condition", conditionId);
  url.searchParams.set("limit", "100");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Consulta de trades públicos falhou (${response.status}).`);
  }
  const result = await response.json();
  if (!Array.isArray(result.data)) {
    throw new Error("Resposta de trades públicos em formato inesperado.");
  }
  return result.data;
}

function reconcileOrderFills(entry, trades, peers) {
  const matchedTradeKeys = new Set(entry.matchedTradeKeys || []);
  const baselineTradeKeys = new Set(entry.baselineTradeKeys || []);
  let matchedShares = Number(entry.matchedShares) || 0;
  let ambiguous = false;
  for (const trade of trades) {
    if (!matchesArchivedOrder(entry, trade)) continue;
    const key = publicTradeKey(trade);
    if (baselineTradeKeys.has(key) || matchedTradeKeys.has(key)) continue;
    const competingOrders = peers.filter((peer) =>
      matchesArchivedOrder(peer, trade)
      && !new Set(peer.baselineTradeKeys || []).has(key)
      && !(peer.matchedTradeKeys || []).includes(key)
    );
    if (competingOrders.length !== 1) {
      ambiguous = true;
      continue;
    }
    matchedTradeKeys.add(key);
    matchedShares += Number(trade.size) || 0;
  }

  const size = Number(entry.rule.shares ?? entry.rule.amount);
  const fullyFilled = matchedShares + 1e-8 >= size;
  const status = fullyFilled ? "filled" : matchedShares > 0 ? "partially_filled" : "awaiting_fill";
  return {
    ...entry,
    status,
    matchedShares: Math.min(matchedShares, size),
    matchedTradeKeys: [...matchedTradeKeys],
    trackingError: ambiguous
      ? "Há mais de uma ordem compatível; não foi possível atribuir este trade com segurança."
      : "",
    message: fullyFilled
      ? "Quantidade integral preenchida; trades compatíveis encontrados na carteira."
      : matchedShares > 0
        ? "Preenchimento parcial detectado; a ordem ainda não atingiu a quantidade configurada."
        : "Aguardando trades compatíveis; a API pública não informa se uma ordem sem fill continua aberta.",
    updatedAt: Date.now()
  };
}

function matchesArchivedOrder(entry, trade) {
  const side = entry.rule.side === "buy" ? "BUY" : "SELL";
  const timestamp = Number(trade.timestamp) * (Number(trade.timestamp) < 1e12 ? 1000 : 1);
  const submittedAt = Number(entry.submittedAt) || 0;
  const tradePrice = Number(trade.price);
  const limitPrice = Number(entry.rule.orderLimitCents) / 100;
  const priceWithinLimit = side === "BUY"
    ? tradePrice <= limitPrice + 1e-6
    : tradePrice >= limitPrice - 1e-6;
  return String(trade.token_id) === String(entry.assetId)
    && String(trade.condition_id).toLowerCase() === String(entry.conditionId).toLowerCase()
    && String(trade.proxy_wallet || trade.wallet || "").toLowerCase() === entry.rule.walletAddress.toLowerCase()
    && String(trade.side).toUpperCase() === side
    && Number.isFinite(timestamp)
    && timestamp >= submittedAt - 1000
    && Number.isFinite(tradePrice)
    && priceWithinLimit;
}

function publicTradeKey(trade) {
  return [
    trade.transaction_hash,
    trade.timestamp,
    trade.token_id,
    trade.side,
    trade.size,
    trade.price
  ].join("|");
}
