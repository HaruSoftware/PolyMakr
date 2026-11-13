const SIMULATION_ACCOUNT_KEY = "polymakr.simulation.account";
const SIMULATION_ORDERS_KEY = "polymakr.simulation.orders";
const SIMULATION_LEDGER_KEY = "polymakr.simulation.ledger";
const SIMULATION_LOCK_NAME = "polymakr-simulation-storage";
const SIMULATION_INITIAL_CASH = 1000;
const SIMULATION_POLL_INTERVAL = 2000;
const SIMULATION_MAX_BOOK_AGE = 5000;
let simulationAccount = null;
let simulationOrders = [];
let simulationLedger = [];
let simulationStatus = "Aguardando dados do mercado.";
let simulationLastPollAt = 0;
let simulationPollRunning = false;

async function initializeSimulation() {
  await navigator.locks.request(SIMULATION_LOCK_NAME, async () => {
    const stored = await chrome.storage.local.get([
      SIMULATION_ACCOUNT_KEY,
      SIMULATION_ORDERS_KEY,
      SIMULATION_LEDGER_KEY
    ]);
    let account = stored[SIMULATION_ACCOUNT_KEY];
    if (account === undefined) {
      account = {
        initialCash: SIMULATION_INITIAL_CASH,
        cash: SIMULATION_INITIAL_CASH,
        realizedPnl: 0,
        positions: {},
        bookLiquidity: {},
        createdAt: Date.now()
      };
      await chrome.storage.local.set({ [SIMULATION_ACCOUNT_KEY]: account });
    } else if (!isValidSimulationAccount(account)) {
      throw new Error("A carteira virtual salva é inválida; os dados existentes foram preservados.");
    }

    if (stored[SIMULATION_ORDERS_KEY] !== undefined && !Array.isArray(stored[SIMULATION_ORDERS_KEY])) {
      throw new Error("A lista de ordens simuladas está inválida; os dados existentes foram preservados.");
    }
    if (stored[SIMULATION_LEDGER_KEY] !== undefined && !Array.isArray(stored[SIMULATION_LEDGER_KEY])) {
      throw new Error("O histórico da carteira virtual está inválido; os dados existentes foram preservados.");
    }
  });
  await refreshSimulation();
}

function isValidSimulationAccount(account) {
  return account
    && typeof account === "object"
    && Number.isFinite(Number(account.initialCash))
    && Number.isFinite(Number(account.cash))
    && Number.isFinite(Number(account.realizedPnl))
    && account.positions
    && typeof account.positions === "object"
    && !Array.isArray(account.positions)
    && (account.bookLiquidity === undefined
      || (account.bookLiquidity && typeof account.bookLiquidity === "object"
        && !Array.isArray(account.bookLiquidity)));
}

async function readSimulationState() {
  const stored = await chrome.storage.local.get([
    SIMULATION_ACCOUNT_KEY,
    SIMULATION_ORDERS_KEY,
    SIMULATION_LEDGER_KEY
  ]);
  if (!isValidSimulationAccount(stored[SIMULATION_ACCOUNT_KEY])) {
    throw new Error("Não foi possível carregar a carteira virtual salva.");
  }
  if (!Array.isArray(stored[SIMULATION_ORDERS_KEY] || [])) {
    throw new Error("Não foi possível carregar as ordens simuladas.");
  }
  if (!Array.isArray(stored[SIMULATION_LEDGER_KEY] || [])) {
    throw new Error("Não foi possível carregar o histórico da carteira virtual.");
  }
  return {
    account: stored[SIMULATION_ACCOUNT_KEY],
    orders: stored[SIMULATION_ORDERS_KEY] || [],
    ledger: stored[SIMULATION_LEDGER_KEY] || []
  };
}

async function refreshSimulation() {
  const state = await readSimulationState();
  simulationAccount = state.account;
  simulationOrders = state.orders;
  simulationLedger = state.ledger;
  renderSimulation();
}

async function fetchSimulationBook(tokenId) {
  if (!/^\d+$/.test(String(tokenId))) {
    throw new Error("O identificador do resultado para simulação é inválido.");
  }
  const response = await chrome.runtime.sendMessage({
    type: "POLYMAKR_SIMULATION_BOOK",
    tokenId: String(tokenId)
  });
  if (!response || response.error) {
    throw new Error(response?.error || "Não foi possível consultar o livro de ofertas público.");
  }
  const book = response.book;
  if (!book || !Array.isArray(book.asks) || !Array.isArray(book.bids)) {
    throw new Error("O livro de ofertas retornado pela Polymarket está em formato inesperado.");
  }
  return {
    asks: normalizeBookLevels(book.asks, "asks"),
    bids: normalizeBookLevels(book.bids, "bids"),
    hash: String(book.hash || JSON.stringify([book.asks, book.bids])),
    fetchedAt: Date.now()
  };
}

function normalizeBookLevels(levels, side) {
  const normalized = levels.map((level) => ({
    price: Number(level.price),
    size: Number(level.size)
  }));
  if (normalized.some((level) =>
    !Number.isFinite(level.price) || level.price <= 0 || level.price >= 1
    || !Number.isFinite(level.size) || level.size <= 0
  )) {
    throw new Error("O livro de ofertas contém preço ou quantidade inválida.");
  }
  return normalized.sort((left, right) =>
    side === "asks" ? left.price - right.price : right.price - left.price
  ).slice(0, 100);
}

async function createSimulationOrder(rule) {
  const marketData = await resolveMarketTradingData(rule);
  if (marketData.isActive === false) {
    throw new Error("Este mercado não está ativo para receber ordens.");
  }
  const book = await fetchSimulationBook(marketData.assetId);
  if (Date.now() - book.fetchedAt > SIMULATION_MAX_BOOK_AGE) {
    throw new Error("O livro de ofertas ficou desatualizado; a ordem não foi simulada.");
  }

  const result = await navigator.locks.request(SIMULATION_LOCK_NAME, async () => {
    const { account, orders, ledger } = await readSimulationState();
    account.bookLiquidity = account.bookLiquidity || {};
    const shares = Number(rule.shares);
    const limitCents = Number(rule.orderLimitCents);
    if (!["buy", "sell"].includes(rule.side)
      || !Number.isInteger(shares) || shares < 1
      || !Number.isFinite(limitCents) || limitCents <= 0 || limitCents >= 100) {
      throw new Error("Os valores salvos da ordem simulada são inválidos.");
    }

    const pendingOrders = orders.filter((item) => ["open", "partially_filled"].includes(item.status));
    if (rule.side === "buy") {
      const reservedCash = pendingOrders
        .filter((item) => item.side === "buy")
        .reduce((total, item) => total + item.remainingShares * item.limitCents / 100, 0);
      if (shares * limitCents / 100 > account.cash - reservedCash + 1e-8) {
        throw new Error("Saldo virtual disponível insuficiente para reservar esta ordem de compra.");
      }
    }

    const nextOrder = {
      id: crypto.randomUUID(),
      ruleId: rule.id,
      marketKey: rule.marketKey,
      marketTitle: rule.marketTitle || rule.marketKey,
      conditionId: marketData.conditionId,
      assetId: marketData.assetId,
      outcome: rule.outcome,
      side: rule.side,
      limitCents,
      requestedShares: shares,
      remainingShares: shares,
      filledShares: 0,
      averageFillPrice: 0,
      fills: [],
      status: "open",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const nextOrders = [...orders, nextOrder];
    const mutableBook = getWorkingBook(account, marketData.assetId, book);
    const changedOrders = [];
    for (const pendingOrder of pendingOrders
      .filter((item) => item.assetId === marketData.assetId)
      .sort((left, right) => left.createdAt - right.createdAt)) {
      const beforeStatus = pendingOrder.status;
      const beforeFilled = pendingOrder.filledShares;
      applyBookToSimulationOrder(pendingOrder, mutableBook, account, ledger);
      if (beforeStatus !== pendingOrder.status || beforeFilled !== pendingOrder.filledShares) {
        changedOrders.push(pendingOrder);
      }
    }
    applyBookToSimulationOrder(nextOrder, mutableBook, account, ledger);
    account.bookLiquidity[marketData.assetId] = mutableBook;
    await chrome.storage.local.set({
      [SIMULATION_ACCOUNT_KEY]: account,
      [SIMULATION_ORDERS_KEY]: nextOrders,
      [SIMULATION_LEDGER_KEY]: ledger
    });
    simulationAccount = account;
    simulationOrders = nextOrders;
    simulationLedger = ledger;
    renderSimulation();
    return { order: nextOrder, changedOrders };
  });

  for (const changedOrder of result.changedOrders) {
    await updateSimulationArchive(changedOrder);
  }
  await updateSimulationArchive(result.order);
  return result.order;
}

function cloneBook(book) {
  return {
    asks: book.asks.map((level) => ({ ...level })),
    bids: book.bids.map((level) => ({ ...level })),
    hash: book.hash,
    fetchedAt: book.fetchedAt
  };
}

function getWorkingBook(account, assetId, book) {
  const cached = account.bookLiquidity[assetId];
  if (cached?.hash === book.hash) {
    return cloneBook(cached);
  }
  return cloneBook(book);
}

function applyBookToSimulationOrder(order, book, account, ledger) {
  if (order.side === "sell" && (Number(account.positions[order.assetId]?.shares) || 0) <= 1e-8) {
    failSimulationSellOrder(order, "A carteira virtual não possui shares disponíveis para preencher esta venda.");
    return;
  }

  const levels = order.side === "buy" ? book.asks : book.bids;
  for (const level of levels) {
    if (order.remainingShares <= 1e-8) break;
    const withinLimit = order.side === "buy"
      ? level.price * 100 <= order.limitCents + 1e-8
      : level.price * 100 >= order.limitCents - 1e-8;
    if (!withinLimit || level.size <= 1e-8) break;

    const availableShares = order.side === "sell"
      ? Number(account.positions[order.assetId]?.shares) || 0
      : Number.POSITIVE_INFINITY;
    if (availableShares <= 1e-8) {
      failSimulationSellOrder(order, "A carteira virtual não possui shares disponíveis para preencher esta venda.");
      return;
    }

    const shares = Math.min(order.remainingShares, level.size, availableShares);
    const notional = shares * level.price;
    const fill = {
      id: crypto.randomUUID(),
      price: level.price,
      shares,
      notional,
      createdAt: Date.now()
    };
    applySimulationFill(order, fill, account);
    order.fills.push(fill);
    ledger.push({
      id: fill.id,
      orderId: order.id,
      marketKey: order.marketKey,
      marketTitle: order.marketTitle,
      assetId: order.assetId,
      outcome: order.outcome,
      side: order.side,
      price: fill.price,
      shares: fill.shares,
      notional: fill.notional,
      realizedPnl: fill.realizedPnl || 0,
      createdAt: fill.createdAt
    });
    level.size = Math.max(0, level.size - shares);
  }

  if (order.side === "sell"
    && order.remainingShares > 1e-8
    && (Number(account.positions[order.assetId]?.shares) || 0) <= 1e-8) {
    failSimulationSellOrder(order, "A carteira virtual não possui shares disponíveis para preencher o restante da venda.");
    return;
  }

  order.status = order.remainingShares <= 1e-8
    ? "filled"
    : order.filledShares > 1e-8 ? "partially_filled" : "open";
  order.updatedAt = Date.now();
}

function failSimulationSellOrder(order, reason) {
  order.status = "failed";
  order.failureReason = reason;
  order.updatedAt = Date.now();
}

function applySimulationFill(order, fill, account) {
  const position = account.positions[order.assetId];
  if (order.side === "buy") {
    if (fill.notional > account.cash + 1e-8) {
      throw new Error("Saldo virtual insuficiente durante o preenchimento da ordem.");
    }
    const previousShares = Number(position?.shares) || 0;
    const nextShares = previousShares + fill.shares;
    const previousCost = previousShares * (Number(position?.averagePrice) || 0);
    account.positions[order.assetId] = {
      assetId: order.assetId,
      conditionId: order.conditionId,
      marketKey: order.marketKey,
      marketTitle: order.marketTitle,
      outcome: order.outcome,
      shares: nextShares,
      averagePrice: (previousCost + fill.notional) / nextShares,
      markPrice: position?.markPrice ?? null,
      updatedAt: fill.createdAt
    };
    account.cash -= fill.notional;
  } else {
    if (!position || Number(position.shares) + 1e-8 < fill.shares) {
      throw new Error("A carteira virtual não possui shares suficientes para concluir a venda.");
    }
    fill.realizedPnl = (fill.price - Number(position.averagePrice)) * fill.shares;
    account.realizedPnl += fill.realizedPnl;
    account.cash += fill.notional;
    position.shares = Math.max(0, Number(position.shares) - fill.shares);
    position.updatedAt = fill.createdAt;
    if (position.shares <= 1e-8) {
      delete account.positions[order.assetId];
    }
  }

  order.remainingShares = Math.max(0, order.remainingShares - fill.shares);
  const previousFilledNotional = order.averageFillPrice * order.filledShares;
  order.filledShares += fill.shares;
  order.averageFillPrice = (previousFilledNotional + fill.notional) / order.filledShares;
}

async function pollSimulationOrders(marketKey) {
  if (!marketKey || simulationPollRunning || Date.now() - simulationLastPollAt < SIMULATION_POLL_INTERVAL) return;
  simulationPollRunning = true;
  simulationLastPollAt = Date.now();
  try {
    const state = await readSimulationState();
    const tokenIds = new Set([
      ...state.orders
        .filter((order) => order.marketKey === marketKey && ["open", "partially_filled"].includes(order.status))
        .map((order) => order.assetId),
      ...Object.values(state.account.positions)
        .filter((position) => position.marketKey === marketKey)
        .map((position) => position.assetId)
    ]);
    if (tokenIds.size === 0) {
      simulationStatus = "Aguardando dados do mercado.";
      renderSimulation();
      return;
    }

    const results = await Promise.all([...tokenIds].map(async (tokenId) => {
      try {
        return [tokenId, await fetchSimulationBook(tokenId), null];
      } catch (error) {
        return [tokenId, null, error instanceof Error ? error.message : String(error)];
      }
    }));
    const books = new Map(results.filter(([, book]) => book).map(([tokenId, book]) => [tokenId, book]));
    const errors = results.filter(([, , error]) => error).map(([, , error]) => error);

    const changedOrders = await navigator.locks.request(SIMULATION_LOCK_NAME, async () => {
      const { account, orders, ledger } = await readSimulationState();
      account.bookLiquidity = account.bookLiquidity || {};
      const changed = [];
      for (const [assetId, book] of books) {
        const mutableBook = getWorkingBook(account, assetId, book);
        for (const order of orders
          .filter((item) => item.assetId === assetId && item.marketKey === marketKey
            && ["open", "partially_filled"].includes(item.status))
          .sort((left, right) => left.createdAt - right.createdAt)) {
          const beforeStatus = order.status;
          const beforeFilled = order.filledShares;
          applyBookToSimulationOrder(order, mutableBook, account, ledger);
          if (beforeStatus !== order.status || beforeFilled !== order.filledShares) changed.push(order);
        }

        account.bookLiquidity[assetId] = mutableBook;
        const position = account.positions[assetId];
        const bestBid = book.bids[0]?.price;
        if (position) {
          position.markPrice = Number.isFinite(bestBid) ? bestBid : null;
          position.updatedAt = Date.now();
        }
      }

      if (books.size > 0) {
        await chrome.storage.local.set({
          [SIMULATION_ACCOUNT_KEY]: account,
          [SIMULATION_ORDERS_KEY]: orders,
          [SIMULATION_LEDGER_KEY]: ledger
        });
        simulationAccount = account;
        simulationOrders = orders;
        simulationLedger = ledger;
      }
      return changed;
    });

    for (const order of changedOrders) {
      await updateSimulationArchive(order);
    }
    simulationStatus = errors.length
      ? `Falha ao atualizar ${errors.length} livro(s) de ofertas: ${errors[0]}`
      : books.size ? `Livro atualizado às ${new Date().toLocaleTimeString("pt-BR")}.` : simulationStatus;
    renderSimulation();
  } finally {
    simulationPollRunning = false;
  }
}

async function cancelSimulationOrder(orderId) {
  try {
    const order = await navigator.locks.request(SIMULATION_LOCK_NAME, async () => {
      const { account, orders, ledger } = await readSimulationState();
      const target = orders.find((item) => item.id === orderId);
      if (!target || !["open", "partially_filled"].includes(target.status)) {
        throw new Error("A ordem não está mais aberta para cancelamento.");
      }
      target.status = "cancelled";
      target.updatedAt = Date.now();
      await chrome.storage.local.set({
        [SIMULATION_ACCOUNT_KEY]: account,
        [SIMULATION_ORDERS_KEY]: orders,
        [SIMULATION_LEDGER_KEY]: ledger
      });
      simulationAccount = account;
      simulationOrders = orders;
      simulationLedger = ledger;
      return target;
    });
    await updateSimulationArchive(order);
    simulationStatus = "Ordem simulada cancelada.";
    renderSimulation();
  } catch (error) {
    showToast("Não foi possível cancelar a ordem simulada", error.message || String(error), "error");
  }
}

async function updateSimulationArchive(order) {
  const archiveStatus = {
    open: "awaiting_fill",
    partially_filled: "partially_filled",
    filled: "filled",
    cancelled: "cancelled",
    failed: "failed"
  }[order.status];
  if (!archiveStatus) return;
  const statusMessages = {
    awaiting_fill: "Ordem simulada aberta; aguardando liquidez compatível no livro.",
    partially_filled: `Ordem simulada preenchida parcialmente: ${order.filledShares} de ${order.requestedShares} shares.`,
    filled: `Ordem simulada preenchida: ${order.filledShares} shares.`,
    cancelled: `Ordem simulada cancelada após preencher ${order.filledShares} de ${order.requestedShares} shares.`,
    failed: order.failureReason || "Ordem simulada falhou."
  };
  await navigator.locks.request("polymakr-rules-storage", async () => {
    const stored = await chrome.storage.local.get([ARCHIVE_KEY, executionStorageKey(order.marketKey)]);
    const archive = Array.isArray(stored[ARCHIVE_KEY]) ? stored[ARCHIVE_KEY] : [];
    const entry = archive.find((item) => item.id === order.ruleId);
    const changes = {};
    if (entry?.simulationOrderId === order.id) {
      changes[ARCHIVE_KEY] = archive.map((item) => item.id === order.ruleId
        ? {
          ...item,
          status: archiveStatus,
          message: statusMessages[archiveStatus],
          simulationOrderId: order.id,
          matchedShares: order.filledShares,
          averageFillPrice: order.averageFillPrice,
          updatedAt: order.updatedAt
        }
        : item);
    }
    const stateKey = executionStorageKey(order.marketKey);
    const states = stored[stateKey] && typeof stored[stateKey] === "object"
      ? stored[stateKey]
      : {};
    if (states[order.ruleId]) {
      changes[stateKey] = {
        ...states,
        [order.ruleId]: {
          ...states[order.ruleId],
          status: archiveStatus,
          message: statusMessages[archiveStatus],
          simulationOrderId: order.id,
          matchedShares: order.filledShares,
          updatedAt: order.updatedAt
        }
      };
    }
    if (Object.keys(changes).length) await chrome.storage.local.set(changes);
  });
}

function renderSimulation() {
  if (!simulationAccount || !simulationEquityElement) return;
  simulationEquityElement.replaceChildren();
  simulationMetricsElement.replaceChildren();
  simulationPositionsElement.replaceChildren();
  simulationOrdersElement.replaceChildren();
  simulationOrderHistoryElement.replaceChildren();
  simulationFillsElement.replaceChildren();

  const pendingOrders = simulationOrders.filter((order) =>
    ["open", "partially_filled"].includes(order.status)
  );
  const historicalOrders = simulationOrders.filter((order) => isSimulationOrderHistoryStatus(order.status));
  const reservedCash = pendingOrders
    .filter((order) => order.side === "buy")
    .reduce((total, order) => total + order.remainingShares * order.limitCents / 100, 0);
  const availableCash = simulationAccount.cash - reservedCash;
  const positions = Object.values(simulationAccount.positions);
  const allPositionsMarked = positions.every((position) => Number.isFinite(position.markPrice));
  const unrealizedPnl = allPositionsMarked
    ? positions.reduce((total, position) =>
      total + (position.markPrice - position.averagePrice) * position.shares, 0)
    : null;
  const equity = allPositionsMarked
    ? simulationAccount.cash + positions.reduce((total, position) =>
      total + position.shares * position.markPrice, 0)
    : null;
  const totalPnl = equity === null ? null : equity - simulationAccount.initialCash;
  const totalReturn = totalPnl === null || simulationAccount.initialCash === 0
    ? null
    : totalPnl / simulationAccount.initialCash * 100;

  const equityLabel = document.createElement("span");
  equityLabel.className = "simulation-equity-label";
  equityLabel.textContent = "Patrimônio total";
  const equityValue = document.createElement("strong");
  equityValue.className = "simulation-equity-value";
  equityValue.textContent = equity === null ? "Cotação indisponível" : formatSimulationCurrency(equity);
  simulationEquityElement.append(equityLabel, equityValue);
  appendSimulationPill(
    simulationEquityElement,
    totalPnl === null ? "P&L total indisponível" : `${formatSignedCurrency(totalPnl)} (${formatSignedPercent(totalReturn)})`,
    totalPnl
  );
  const initialBalance = document.createElement("span");
  initialBalance.className = "simulation-equity-label";
  initialBalance.textContent = `Saldo inicial ${formatSimulationCurrency(simulationAccount.initialCash)}`;
  simulationEquityElement.append(initialBalance);

  for (const metricData of [
    { label: "Saldo disponível", value: formatSimulationCurrency(availableCash) },
    { label: "P&L realizado", value: formatSimulationCurrency(simulationAccount.realizedPnl), pnl: simulationAccount.realizedPnl },
    {
      label: "P&L não realizado",
      value: unrealizedPnl === null ? "Cotação indisponível" : formatSimulationCurrency(unrealizedPnl),
      pnl: unrealizedPnl
    }
  ]) {
    const metric = document.createElement("article");
    metric.className = "simulation-metric";
    const label = document.createElement("span");
    label.textContent = metricData.label;
    const value = document.createElement("strong");
    value.textContent = metricData.value;
    if (metricData.pnl !== undefined && metricData.pnl !== null) {
      value.classList.add(simulationTone(metricData.pnl));
    }
    metric.append(label, value);
    simulationMetricsElement.append(metric);
  }

  simulationStatusElement.textContent = `${simulationStatus} Os valores são estimativas brutas; sem taxas ou posição na fila.`;
  setSimulationCount(".simulation-positions-count", positions.length);
  setSimulationCount(".simulation-orders-count", pendingOrders.length);
  setSimulationCount(".simulation-order-history-count", historicalOrders.length);
  setSimulationCount(".simulation-fills-count", simulationLedger.length);
  simulationClearHistoryButton.disabled = historicalOrders.length === 0;
  renderSimulationPositions(positions);
  renderSimulationOrders(pendingOrders);
  renderSimulationOrderHistory(historicalOrders);
  renderSimulationFills();
}

function simulationTone(value) {
  return value > 1e-8 ? "simulation-positive"
    : value < -1e-8 ? "simulation-negative"
      : "simulation-neutral";
}

function appendSimulationPill(container, text, value) {
  const pill = document.createElement("span");
  pill.className = `simulation-equity-change ${value === null ? "simulation-neutral-bg simulation-neutral" : value > 1e-8 ? "simulation-positive-bg simulation-positive" : value < -1e-8 ? "simulation-negative-bg simulation-negative" : "simulation-neutral-bg simulation-neutral"}`;
  pill.textContent = text;
  container.append(pill);
}

function setSimulationCount(selector, count) {
  shadow.querySelector(selector).textContent = String(count);
}

function createSimulationTable(headers, emptyMessage) {
  const table = document.createElement("table");
  table.className = "simulation-table";
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const item of headers) {
    const cell = document.createElement("th");
    cell.textContent = item.label;
    if (item.numeric) cell.className = "simulation-numeric";
    headerRow.append(cell);
  }
  head.append(headerRow);
  const body = document.createElement("tbody");
  table.append(head, body);
  const wrapper = document.createElement("div");
  wrapper.className = "simulation-table-wrap";
  wrapper.append(table);
  return { wrapper, body, columnCount: headers.length, headers };
}

function appendSimulationTableEmpty(table, message) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.className = "simulation-empty-cell";
  cell.colSpan = table.columnCount;
  cell.textContent = message;
  row.append(cell);
  table.body.append(row);
}

function appendSimulationCell(row, value, options = {}) {
  const cell = document.createElement("td");
  if (options.className) cell.className = options.className;
  if (options.title) cell.title = options.title;
  if (value instanceof Node) cell.append(value);
  else cell.textContent = String(value);
  row.append(cell);
  return cell;
}

function createSimulationOutcome(outcome) {
  const badge = document.createElement("span");
  badge.className = `simulation-outcome ${outcome === "Down" ? "down" : "up"}`;
  badge.textContent = outcome;
  return badge;
}

function createSimulationStatus(status) {
  const badge = document.createElement("span");
  badge.className = `simulation-state ${status}`;
  badge.textContent = {
    open: "Aberta",
    partially_filled: "Parcial",
    filled: "Preenchida",
    cancelled: "Cancelada",
    failed: "Falhou"
  }[status] || status;
  return badge;
}

function renderSimulationPositions(positions) {
  const table = createSimulationTable([
    { label: "Mercado" },
    { label: "Resultado" },
    { label: "Shares", numeric: true },
    { label: "Preço médio", numeric: true },
    { label: "Bid", numeric: true },
    { label: "Valor", numeric: true },
    { label: "P&L / retorno", numeric: true }
  ], "Nenhuma posição aberta.");
  if (positions.length === 0) appendSimulationTableEmpty(table, "Nenhuma posição aberta.");
  for (const position of positions) {
    const row = document.createElement("tr");
    const markPrice = Number.isFinite(position.markPrice) ? position.markPrice : null;
    const markValue = markPrice === null ? null : position.shares * markPrice;
    const costBasis = position.shares * position.averagePrice;
    const pnl = markValue === null ? null : markValue - costBasis;
    const returnPercent = pnl === null || costBasis === 0 ? null : pnl / costBasis * 100;
    appendSimulationCell(row, position.marketTitle, { title: position.marketTitle });
    appendSimulationCell(row, createSimulationOutcome(position.outcome));
    appendSimulationCell(row, Number(position.shares).toLocaleString("pt-BR", { maximumFractionDigits: 2 }), { className: "simulation-numeric" });
    appendSimulationCell(row, formatSimulationCents(position.averagePrice), { className: "simulation-numeric" });
    appendSimulationCell(row, markPrice === null ? "—" : formatSimulationCents(markPrice), { className: "simulation-numeric" });
    appendSimulationCell(row, markValue === null ? "—" : formatSimulationCurrency(markValue), { className: "simulation-numeric" });
    const pnlCell = appendSimulationCell(row, pnl === null ? "Cotação indisponível" : `${formatSignedCurrency(pnl)} · ${formatSignedPercent(returnPercent)}`, {
      className: `simulation-numeric ${pnl === null ? "simulation-neutral" : simulationTone(pnl)}`
    });
    pnlCell.title = pnl === null ? "Abra o mercado correspondente para atualizar a cotação." : "P&L não realizado, marcado pelo melhor bid.";
    table.body.append(row);
  }
  simulationPositionsElement.replaceChildren(table.wrapper);
}

function renderSimulationOrders(orders) {
  const sortedOrders = [...orders].sort((left, right) => right.createdAt - left.createdAt);
  const table = createSimulationTable([
    { label: "Mercado" },
    { label: "Lado" },
    { label: "Resultado" },
    { label: "Status" },
    { label: "Preenchido", numeric: true },
    { label: "Preço limite", numeric: true },
    { label: "Preço médio", numeric: true },
    { label: "Atualizada" },
    { label: "" }
  ], "Nenhuma ordem simulada.");
  if (sortedOrders.length === 0) appendSimulationTableEmpty(table, "Nenhuma ordem simulada.");
  for (const order of sortedOrders) {
    table.body.append(createSimulationOrderRow(order, "cancel"));
  }
  simulationOrdersElement.replaceChildren(table.wrapper);
}

function renderSimulationOrderHistory(orders) {
  const sortedOrders = [...orders].sort((left, right) => right.updatedAt - left.updatedAt);
  const table = createSimulationTable([
    { label: "Mercado" },
    { label: "Lado" },
    { label: "Resultado" },
    { label: "Status" },
    { label: "Preenchido", numeric: true },
    { label: "Preço limite", numeric: true },
    { label: "Preço médio", numeric: true },
    { label: "Atualizada" },
    { label: "" }
  ], "Nenhuma ordem no histórico.");
  if (sortedOrders.length === 0) appendSimulationTableEmpty(table, "Nenhuma ordem no histórico.");
  for (const order of sortedOrders) {
    table.body.append(createSimulationOrderRow(order, "delete"));
  }
  simulationOrderHistoryElement.replaceChildren(table.wrapper);
}

function createSimulationOrderRow(order, action) {
  const row = document.createElement("tr");
  appendSimulationCell(row, order.marketTitle, { title: order.marketTitle });
  appendSimulationCell(row, order.side === "buy" ? "Comprar" : "Vender", {
    className: `simulation-side ${order.side}`
  });
  appendSimulationCell(row, createSimulationOutcome(order.outcome));
  appendSimulationCell(row, createSimulationStatus(order.status));
  appendSimulationCell(row, `${Number(order.filledShares).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} / ${Number(order.requestedShares).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`, {
    className: "simulation-numeric"
  });
  appendSimulationCell(row, formatSimulationCents(order.limitCents / 100), { className: "simulation-numeric" });
  appendSimulationCell(row, order.filledShares ? formatSimulationCents(order.averageFillPrice) : "—", { className: "simulation-numeric" });
  appendSimulationCell(row, new Date(order.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  const actions = document.createElement("span");
  actions.className = "simulation-actions";
  if (action === "cancel") {
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "simulation-cancel";
    cancel.textContent = "Cancelar";
    cancel.addEventListener("click", () => cancelSimulationOrder(order.id));
    actions.append(cancel);
  } else {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "simulation-delete-history";
    remove.textContent = "Apagar";
    remove.setAttribute("aria-label", `Apagar registro da ordem de ${order.side === "buy" ? "compra" : "venda"} ${order.outcome}`);
    remove.addEventListener("click", () => deleteSimulationOrderRecord(order.id));
    actions.append(remove);
  }
  appendSimulationCell(row, actions);
  return row;
}

function isSimulationOrderHistoryStatus(status) {
  return ["filled", "cancelled", "failed"].includes(status);
}

async function deleteSimulationOrderRecord(orderId) {
  if (!window.confirm("Apagar o registro desta ordem? Os preenchimentos e os dados da carteira serão mantidos.")) return;
  try {
    await navigator.locks.request(SIMULATION_LOCK_NAME, async () => {
      const { account, orders, ledger } = await readSimulationState();
      const target = orders.find((item) => item.id === orderId);
      if (!target || !isSimulationOrderHistoryStatus(target.status)) {
        throw new Error("Somente ordens encerradas podem ser apagadas do histórico.");
      }
      const nextOrders = orders.filter((item) => item.id !== orderId);
      await chrome.storage.local.set({
        [SIMULATION_ACCOUNT_KEY]: account,
        [SIMULATION_ORDERS_KEY]: nextOrders,
        [SIMULATION_LEDGER_KEY]: ledger
      });
      simulationAccount = account;
      simulationOrders = nextOrders;
      simulationLedger = ledger;
    });
    simulationStatus = "Registro da ordem apagado; carteira e preenchimentos foram mantidos.";
    renderSimulation();
  } catch (error) {
    showToast("Não foi possível apagar o registro da ordem", error.message || String(error), "error");
  }
}

async function clearSimulationOrderHistory() {
  const historicalCount = simulationOrders.filter((order) => isSimulationOrderHistoryStatus(order.status)).length;
  if (historicalCount === 0
    || !window.confirm(`Apagar os registros de ${historicalCount} ordens encerradas? Os preenchimentos e os dados da carteira serão mantidos.`)) return;
  try {
    await navigator.locks.request(SIMULATION_LOCK_NAME, async () => {
      const { account, orders, ledger } = await readSimulationState();
      const nextOrders = orders.filter((order) => !isSimulationOrderHistoryStatus(order.status));
      await chrome.storage.local.set({
        [SIMULATION_ACCOUNT_KEY]: account,
        [SIMULATION_ORDERS_KEY]: nextOrders,
        [SIMULATION_LEDGER_KEY]: ledger
      });
      simulationAccount = account;
      simulationOrders = nextOrders;
      simulationLedger = ledger;
    });
    simulationStatus = "Histórico de ordens apagado; carteira e preenchimentos foram mantidos.";
    renderSimulation();
  } catch (error) {
    showToast("Não foi possível limpar o histórico de ordens", error.message || String(error), "error");
  }
}

function renderSimulationFills() {
  const recentFills = [...simulationLedger].sort((left, right) => right.createdAt - left.createdAt).slice(0, 25);
  const table = createSimulationTable([
    { label: "Horário" },
    { label: "Mercado" },
    { label: "Lado" },
    { label: "Resultado" },
    { label: "Shares", numeric: true },
    { label: "Preço", numeric: true },
    { label: "Total", numeric: true },
    { label: "P&L realizado", numeric: true }
  ], "Nenhum preenchimento ainda.");
  if (recentFills.length === 0) appendSimulationTableEmpty(table, "Nenhum preenchimento ainda.");
  for (const fill of recentFills) {
    const row = document.createElement("tr");
    appendSimulationCell(row, new Date(fill.createdAt).toLocaleString("pt-BR"));
    appendSimulationCell(row, fill.marketTitle, { title: fill.marketTitle });
    appendSimulationCell(row, fill.side === "buy" ? "Comprar" : "Vender", {
      className: `simulation-side ${fill.side}`
    });
    appendSimulationCell(row, createSimulationOutcome(fill.outcome));
    appendSimulationCell(row, Number(fill.shares).toLocaleString("pt-BR", { maximumFractionDigits: 2 }), { className: "simulation-numeric" });
    appendSimulationCell(row, formatSimulationCents(fill.price), { className: "simulation-numeric" });
    appendSimulationCell(row, formatSimulationCurrency(fill.notional), { className: "simulation-numeric" });
    appendSimulationCell(row, formatSignedCurrency(Number(fill.realizedPnl) || 0), {
      className: `simulation-numeric ${simulationTone(Number(fill.realizedPnl) || 0)}`
    });
    table.body.append(row);
  }
  simulationFillsElement.replaceChildren(table.wrapper);
}

function formatSimulationCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatSignedCurrency(value) {
  const amount = formatSimulationCurrency(Math.abs(value));
  return value > 1e-8 ? `+${amount}` : value < -1e-8 ? `-${amount}` : amount;
}

function formatSignedPercent(value) {
  const amount = Math.abs(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${value > 1e-8 ? "+" : value < -1e-8 ? "-" : ""}${amount}%`;
}

function formatSimulationCents(value) {
  return `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}¢`;
}
