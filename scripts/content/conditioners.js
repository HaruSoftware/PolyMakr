const CONDITIONER_TYPE_LABELS = {
  price_at: "Preço atinge (¢)",
  price_below: "Preço abaixo de (¢)",
  price_above: "Preço acima de (¢)",
  change_pct: "Variação do preço (%)",
  profit_pct: "Lucro sobre preço médio (%)",
  loss_pct: "Prejuízo sobre preço médio (%)",
  time_remaining: "Tempo restante (min)",
  liquidity: "Liquidez do livro (US$)",
  spread: "Spread máximo (¢)"
};
const CONDITIONER_LOCK_PREFIX = "polymakr-conditioner-";
const CONDITIONER_DATA_LOCK = "polymakr-conditioners-storage";
const CONDITIONER_MAX_QUOTE_AGE = 5000;
const CONDITIONER_BOOK_CACHE_MS = 1800;
const CONDITIONER_MARKET_CACHE_MS = 8000;
const conditionerMarketCache = new Map();
const conditionerPositionCache = new Map();
let conditionerMonitorRunning = false;
let conditionerLastErrorAt = 0;

function addConditionerConditionRow(condition = {}) {
  const row = document.createElement("div");
  row.className = "conditioner-condition";
  const typeLabel = document.createElement("label");
  typeLabel.textContent = "Condição";
  const type = document.createElement("select");
  type.name = "conditionType";
  type.required = true;
  for (const [value, label] of Object.entries(CONDITIONER_TYPE_LABELS)) {
    type.add(new Option(label, value));
  }
  type.value = condition.type || "price_below";
  typeLabel.append(type);

  const sideLabel = document.createElement("label");
  sideLabel.textContent = "Operação";
  const side = document.createElement("select");
  side.name = "conditionSide";
  side.innerHTML = '<option value="buy">Compra</option><option value="sell">Venda</option>';
  side.value = condition.side || conditionerForm.elements.side.value || "buy";
  sideLabel.append(side);

  const operatorLabel = document.createElement("label");
  operatorLabel.textContent = "Comparação";
  const operator = document.createElement("select");
  operator.name = "conditionOperator";
  operator.innerHTML = '<option value="lte">≤</option><option value="gte">≥</option>';
  operator.value = condition.operator || "lte";
  operatorLabel.append(operator);

  const valueLabel = document.createElement("label");
  valueLabel.textContent = "Valor";
  const value = document.createElement("input");
  value.name = "conditionValue";
  value.type = "number";
  value.min = "0.01";
  value.step = "any";
  value.required = true;
  value.value = condition.value === undefined ? "" : String(condition.value);
  valueLabel.append(value);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "×";
  remove.setAttribute("aria-label", "Remover condição");
  remove.addEventListener("click", () => {
    if (conditionerForm.querySelectorAll(".conditioner-condition").length > 1) row.remove();
  });
  type.addEventListener("change", () => {
    const centsTypes = ["price_at", "price_below", "price_above", "spread"];
    valueLabel.firstChild.textContent = CONDITIONER_TYPE_LABELS[type.value];
    value.min = type.value === "change_pct" ? "-100" : "0.01";
    value.step = centsTypes.includes(type.value) ? "0.1" : "any";
    operatorLabel.hidden = !["change_pct", "time_remaining", "liquidity"].includes(type.value);
  });
  row.append(typeLabel, sideLabel, operatorLabel, valueLabel, remove);
  conditionerForm.querySelector(".conditioner-conditions").append(row);
  type.dispatchEvent(new Event("change"));
}

async function conditionerExecutionPending(orderId, mode) {
  if (!orderId) return false;
  if (mode === "paper") {
    const stored = await chrome.storage.local.get(SIMULATION_ORDERS_KEY);
    return (Array.isArray(stored[SIMULATION_ORDERS_KEY]) ? stored[SIMULATION_ORDERS_KEY] : [])
      .some((order) => order.id === orderId && ["open", "partially_filled"].includes(order.status));
  }
  const stored = await chrome.storage.local.get(ARCHIVE_KEY);
  const archive = Array.isArray(stored[ARCHIVE_KEY]) ? stored[ARCHIVE_KEY] : [];
  return archive.some((entry) => entry.id === orderId
    && ["awaiting_fill", "partially_filled"].includes(entry.status));
}

async function saveConditionerFromForm(event) {
  event.preventDefault();
  if (!activeMarketKey || !quotes.length) {
    showToast("Mercado não identificado", "Abra o painel de negociação do mercado desejado antes de criar um condicionador.", "warning");
    return;
  }
  if (!conditionerForm.reportValidity()) return;
  const data = new FormData(conditionerForm);
  const rows = [...conditionerForm.querySelectorAll(".conditioner-condition")];
  const conditions = rows.map((row) => ({
    id: crypto.randomUUID(),
    type: row.querySelector('[name="conditionType"]').value,
    side: row.querySelector('[name="conditionSide"]').value,
    operator: row.querySelector('[name="conditionOperator"]').value,
    value: Number(row.querySelector('[name="conditionValue"]').value)
  }));
  const side = data.get("side");
  const sellAll = data.get("sellAll") === "true";
  const safety = {
    minRemainingMinutes: Number(data.get("minRemainingMinutes")),
    minLiquidity: Number(data.get("minLiquidity")),
    maxSpreadCents: Number(data.get("maxSpreadCents")),
    maxInvestment: Number(data.get("maxInvestment")),
    maxOperations: Number(data.get("maxOperations")),
    stopLossPct: Number(data.get("stopLossPct"))
  };
  const orderLimitCents = Number(data.get("orderLimitCents"));
  const amount = Number(data.get("amount")) || 0;
  if (!conditions.length || conditions.some((condition) => !Number.isFinite(condition.value)
    || (condition.type === "change_pct" ? condition.value === 0 || Math.abs(condition.value) > 100 : condition.value <= 0))
    || !["buy", "sell", "both"].includes(side)
    || !Number.isFinite(orderLimitCents) || orderLimitCents <= 0 || orderLimitCents >= 100
    || ((side !== "sell" || !sellAll) && (!Number.isFinite(amount) || amount <= 0))
    || !Number.isInteger(safety.maxOperations) || safety.maxOperations < 1
    || Object.values(safety).some((value) => !Number.isFinite(value) || value < 0)) {
    showToast("Confira as configurações", "Informe condições e limites numéricos válidos.", "error");
    return;
  }
  if ((side === "buy" && conditions.some((condition) => condition.side !== "buy"))
    || (side === "sell" && conditions.some((condition) => condition.side !== "sell"))) {
    showToast("Operação incompatível", "A operação de cada condição deve corresponder à operação configurada no condicionador.", "error");
    return;
  }
  if (conditions.some((condition) => condition.side === "buy"
    && ["profit_pct", "loss_pct"].includes(condition.type))) {
    showToast("Condição de venda necessária", "Lucro e prejuízo são avaliados sobre uma posição existente e devem usar a operação de venda.", "error");
    return;
  }
  if (side === "both" && data.get("combine") === "and"
    && new Set(conditions.map((condition) => condition.side)).size > 1) {
    showToast("Condições AND incompatíveis", "Com AND, todas as condições precisam pertencer à mesma operação; use OR para combinar compra e venda.", "error");
    return;
  }
  if (safety.stopLossPct > 0 && side === "buy") {
    showToast("Stop de venda incompatível", "A proteção de queda exige operação de venda ou compra e venda.", "error");
    return;
  }
  if (data.get("mode") === "auto_limit" && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress || "")) {
    showToast("Configure a carteira pública", "Informe o endereço público na aba Configurações para acompanhar ordens automatizadas.", "error");
    selectView("settings");
    walletInput.focus();
    return;
  }
  const needsPublicPosition = data.get("mode") !== "paper"
    && (side !== "buy" || safety.stopLossPct > 0
      || conditions.some((condition) => condition.side === "sell"
        && ["profit_pct", "loss_pct"].includes(condition.type)));
  if (needsPublicPosition && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress || "")) {
    showToast("Configure a carteira pública", "Informe o endereço público na aba Configurações para verificar a posição e o preço médio antes das condições de venda.", "error");
    selectView("settings");
    walletInput.focus();
    return;
  }
  const quote = quotes.find((item) => item.outcome === data.get("outcome"));
  if (!quote || quote.unavailable) {
    showToast("Resultado indisponível", "Não foi possível associar um resultado atual ao condicionador.", "error");
    return;
  }
  const conditioner = {
    id: crypto.randomUUID(),
    name: String(data.get("name")).trim(),
    description: String(data.get("description") || "").trim(),
    marketKey: activeMarketKey,
    marketTitle: quote.marketTitle || quote.market || "",
    marketSlug: quote.marketSlug || "",
    marketRoute: quote.marketRoute || "",
    outcome: quote.outcome,
    referencePrice: quote.price,
    side,
    combine: data.get("combine") === "or" ? "or" : "and",
    conditions,
    orderLimitCents,
    amount,
    sellAll,
    mode: data.get("mode"),
    safety,
    status: "active",
    runtime: { operations: 0, invested: 0, latched: [], history: [], state: "Aguardando condições." },
    createdAt: Date.now()
  };
  try {
    await navigator.locks.request(CONDITIONER_DATA_LOCK, async () => {
      const stored = await chrome.storage.local.get(CONDITIONERS_KEY);
      const saved = Array.isArray(stored[CONDITIONERS_KEY]) ? stored[CONDITIONERS_KEY] : [];
      await chrome.storage.local.set({ [CONDITIONERS_KEY]: [...saved, conditioner] });
      conditioners = [...saved, conditioner];
    });
    conditionerForm.reset();
    syncConditionerAmountFields();
    conditionerForm.querySelector(".conditioner-conditions").replaceChildren();
    addConditionerConditionRow();
    renderConditioners();
    showToast("Condicionador criado", `${conditioner.name} está ativo para este mercado.`, "success");
  } catch (error) {
    showToast("Não foi possível salvar", error.message || String(error), "error");
  }
}

function renderConditioners() {
  if (!conditionerListElement) return;
  conditionerListElement.replaceChildren();
  shadow.querySelector(".conditioner-count").textContent = String(conditioners.length);
  if (!conditioners.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Os condicionadores criados aparecerão aqui.";
    conditionerListElement.append(empty);
    return;
  }
  for (const conditioner of [...conditioners].sort((a, b) => b.createdAt - a.createdAt)) {
    const card = document.createElement("article");
    card.className = "conditioner-card";
    const header = document.createElement("header");
    const title = document.createElement("h3");
    title.textContent = conditioner.name;
    const status = document.createElement("span");
    status.className = `conditioner-status ${conditioner.status === "paused" ? "paused" : conditioner.status === "ended" ? "ended" : ""}`;
    status.textContent = conditioner.status === "active" ? "Ativo" : conditioner.status === "paused" ? "Pausado" : "Encerrado";
    header.append(title, status);
    const market = document.createElement("p");
    market.textContent = `${conditioner.outcome} · ${conditioner.marketTitle || conditioner.marketKey}`;
    const description = document.createElement("p");
    description.textContent = conditioner.description || `${conditioner.conditions.length} condição(ões) · ${conditioner.combine.toUpperCase()} · ${conditioner.mode === "auto_limit" ? "ordem real limite" : conditioner.mode === "paper" ? "simulação" : "notificação"}`;
    const runtime = conditioner.runtime || {};
    const state = document.createElement("p");
    state.textContent = `${runtime.operations || 0}/${conditioner.safety.maxOperations} operações · ${runtime.state || "Aguardando condições."}`;
    const actions = document.createElement("div");
    actions.className = "conditioner-actions";
    if (conditioner.status !== "ended") {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.textContent = conditioner.status === "paused" ? "Retomar" : "Pausar";
      toggle.addEventListener("click", () => changeConditionerStatus(conditioner.id, conditioner.status === "paused" ? "active" : "paused"));
      const end = document.createElement("button");
      end.type = "button";
      end.className = "danger";
      end.textContent = "Encerrar";
      end.addEventListener("click", () => changeConditionerStatus(conditioner.id, "ended"));
      actions.append(toggle, end);
    }
    const history = document.createElement("div");
    history.className = "conditioner-history";
    for (const item of (runtime.history || []).slice(-3).reverse()) {
      const entry = document.createElement("p");
      entry.textContent = `${new Date(item.at).toLocaleString("pt-BR")} · ${item.message}`;
      history.append(entry);
    }
    card.append(header, market, description, state, actions, history);
    conditionerListElement.append(card);
  }
}

async function changeConditionerStatus(id, status) {
  try {
    await updateConditioner(id, (conditioner) => ({ ...conditioner, status }));
    showToast("Condicionador atualizado", status === "active" ? "Monitoramento retomado." : status === "paused" ? "Monitoramento pausado." : "O condicionador foi encerrado.", "success");
  } catch (error) {
    showToast("Não foi possível atualizar", error.message || String(error), "error");
  }
}

async function updateConditioner(id, updater) {
  await navigator.locks.request(CONDITIONER_DATA_LOCK, async () => {
    const stored = await chrome.storage.local.get(CONDITIONERS_KEY);
    const saved = Array.isArray(stored[CONDITIONERS_KEY]) ? stored[CONDITIONERS_KEY] : [];
    const found = saved.some((item) => item.id === id);
    if (!found) throw new Error("O condicionador não foi encontrado.");
    const next = saved.map((item) => item.id === id ? updater(item) : item);
    if (next.every((item, index) => item === saved[index])) return;
    await chrome.storage.local.set({ [CONDITIONERS_KEY]: next });
    conditioners = next;
  });
  renderConditioners();
}

async function monitorConditioners(previousSnapshot = new Map()) {
  if (conditionerMonitorRunning || !activeMarketKey || !quotes.length) return;
  conditionerMonitorRunning = true;
  try {
    const active = conditioners.filter((item) =>
      item.status === "active" && item.marketKey === activeMarketKey
    );
    if (!active.length) return;
    for (const conditioner of active) {
      await navigator.locks.request(`${CONDITIONER_LOCK_PREFIX}${conditioner.id}`, async () => {
        try {
          const data = await loadConditionerMarketData(conditioner);
          if (data.marketData.isActive === false) {
            await recordConditionerState(conditioner.id, "Mercado suspenso ou indisponível; nenhuma operação foi enviada.");
            return;
          }
          await evaluateConditioner(conditioner, data, previousSnapshot);
        } catch (error) {
          await recordConditionerState(conditioner.id, `Monitoramento indisponível: ${error.message || error}`);
        }
      });
    }
  } catch (error) {
    if (Date.now() - conditionerLastErrorAt > 30000) {
      conditionerLastErrorAt = Date.now();
      showToast("Falha ao monitorar condicionadores", error.message || String(error), "error");
    }
  } finally {
    conditionerMonitorRunning = false;
  }
}

async function loadConditionerMarketData(conditioner) {
  const now = Date.now();
  const cacheKey = `${conditioner.marketKey}|${conditioner.outcome.toLowerCase()}`;
  let market = conditionerMarketCache.get(cacheKey);
  if (!market || now - market.fetchedAt > CONDITIONER_MARKET_CACHE_MS) {
    const marketData = await resolveMarketTradingData(conditioner);
    market = { marketData, fetchedAt: now, books: new Map() };
    conditionerMarketCache.set(cacheKey, market);
  }
  const selectedQuote = quotes.find((item) => quoteMarketKey(item) === conditioner.marketKey
    && item.outcome === conditioner.outcome);
  if (!selectedQuote || selectedQuote.unavailable) throw new Error("A cotação atual do resultado não está disponível.");
  let book = market.books.get(market.marketData.assetId);
  if (!book || now - book.fetchedAt > CONDITIONER_BOOK_CACHE_MS) {
    book = await fetchSimulationBook(market.marketData.assetId);
    market.books.set(market.marketData.assetId, book);
  }
  return {
    marketData: market.marketData,
    quote: selectedQuote,
    book,
    quoteFetchedAt: now,
    remainingMinutes: market.marketData.endDate === null
      ? null : (market.marketData.endDate - now) / 60000,
    liquidity: [...book.asks, ...book.bids].reduce((total, level) => total + level.price * level.size, 0),
    spreadCents: book.asks[0] && book.bids[0]
      ? Math.max(0, (book.asks[0].price - book.bids[0].price) * 100) : null,
    cache: market,
    quoteRef: selectedQuote
  };
}

async function evaluateConditioner(conditioner, data, previousSnapshot) {
  const stored = await chrome.storage.local.get(CONDITIONERS_KEY);
  const current = (Array.isArray(stored[CONDITIONERS_KEY]) ? stored[CONDITIONERS_KEY] : [])
    .find((item) => item.id === conditioner.id);
  if (!current || current.status !== "active" || current.marketKey !== activeMarketKey) return;
  const runtime = { operations: 0, invested: 0, latched: [], history: [], ...current.runtime };
  if (runtime.state === "processing") return;
  if (runtime.state === "awaiting_fill" || runtime.state === "partially_filled") {
    const pending = await conditionerExecutionPending(runtime.activeOrderId, current.mode);
    if (pending) return;
    await updateConditioner(current.id, (item) => ({
      ...item,
      runtime: { ...runtime, state: "Ordem anterior finalizada; aguardando novas condições.", activeOrderId: "" }
    }));
    return;
  }
  if (runtime.operations >= current.safety.maxOperations) {
    if (current.status !== "ended") await updateConditioner(current.id, (item) => ({ ...item, status: "ended" }));
    return;
  }
  if (Date.now() - data.quoteFetchedAt > CONDITIONER_MAX_QUOTE_AGE) {
    await recordConditionerState(current.id, "Cotação desatualizada; aguardando dados recentes.");
    return;
  }
  const previous = previousSnapshot.get(`${current.marketKey}|${current.outcome.toLowerCase()}`);
  const needsPosition = current.conditions.some((condition) => condition.side === "sell")
    || current.side === "sell" || current.sellAll || current.safety.stopLossPct > 0;
  const position = needsPosition ? await getConditionerPosition(current, data.marketData) : null;
  const results = current.conditions.map((condition) => ({
    condition,
    matched: evaluateCondition(condition, {
      ...data,
      referencePrice: current.referencePrice
    }, previous, position)
  }));
  let stopLossTriggered = false;
  if (current.safety.stopLossPct > 0 && current.side !== "buy" && position?.averagePrice > 0) {
    const pnlPercent = (data.quote.price / 100 / position.averagePrice - 1) * 100;
    if (pnlPercent <= -current.safety.stopLossPct) {
      stopLossTriggered = true;
    }
  }
  const sideGroups = ["buy", "sell"].filter((side) =>
    current.side === "both" || current.side === side
  ).map((side) => {
    const group = results.filter((result) => result.condition.side === side);
    if (!group.length) return null;
    const matched = current.combine === "or"
      ? group.some((result) => result.matched)
      : group.every((result) => result.matched);
    return { side, group, matched, key: `${side}:${group.map(({ condition }) => condition.id).sort().join(",")}` };
  }).filter(Boolean);
  const stopLossKey = "sell:stop-loss";
  const matched = stopLossTriggered
    ? runtime.latched.includes(stopLossKey) ? null : { side: "sell", key: stopLossKey, group: [] }
    : sideGroups.find((group) => group.matched && !runtime.latched.includes(group.key));
  const activeKeys = sideGroups.filter((group) => group.matched).map((group) => group.key);
  if (stopLossTriggered) activeKeys.push(stopLossKey);
  if (!matched) {
    if (runtime.latched.some((key) => !activeKeys.includes(key))) {
      await updateConditioner(current.id, (item) => ({
        ...item,
        runtime: { ...runtime, latched: activeKeys, state: "Aguardando condições." }
      }));
    }
    return;
  }
  const safetyFailure = conditionerSafetyFailure(current, matched.side, data, runtime);
  if (safetyFailure) {
    await recordConditionerState(current.id, safetyFailure, matched.key, true);
    return;
  }
  await runConditionerOperation(current, matched.side, data, runtime, matched.key, position);
}

function evaluateCondition(condition, data, previous, position) {
  const value = Number(condition.value);
  const compare = (actual) => Number.isFinite(actual)
    && (condition.operator === "gte" ? actual >= value : actual <= value);
  const price = data.quote.price;
  const previousPrice = typeof previous === "number" ? previous : previous?.price;
  switch (condition.type) {
    case "price_at": return Math.abs(price - value) <= 0.1
      || Number.isFinite(previousPrice) && ((previousPrice < value && price >= value)
        || (previousPrice > value && price <= value));
    case "price_below": return price <= value;
    case "price_above": return price >= value;
    case "change_pct": {
      const referencePrice = Number(data.referencePrice);
      return Number.isFinite(referencePrice) && referencePrice > 0
        && compare((price - referencePrice) / referencePrice * 100);
    }
    case "profit_pct": return condition.side === "sell" && position?.averagePrice > 0
      && (price / 100 / position.averagePrice - 1) * 100 >= value;
    case "loss_pct": return condition.side === "sell" && position?.averagePrice > 0
      && (price / 100 / position.averagePrice - 1) * 100 <= -value;
    case "time_remaining": return Number.isFinite(data.remainingMinutes) && compare(data.remainingMinutes);
    case "liquidity": return compare(data.liquidity);
    case "spread": return Number.isFinite(data.spreadCents) && data.spreadCents <= value;
    default: return false;
  }
}

function conditionerSafetyFailure(conditioner, side, data, runtime) {
  const safety = conditioner.safety;
  if (data.marketData.isActive === false) return "Mercado suspenso ou indisponível.";
  if (Date.now() - data.quoteFetchedAt > CONDITIONER_MAX_QUOTE_AGE
    || Date.now() - data.book.fetchedAt > CONDITIONER_MAX_QUOTE_AGE) return "Dados do mercado desatualizados.";
  if (side === "buy" && safety.minRemainingMinutes > 0
    && (!Number.isFinite(data.remainingMinutes) || data.remainingMinutes < safety.minRemainingMinutes)) {
    return "Compra bloqueada pelo limite de tempo restante.";
  }
  if (side === "buy" && safety.minLiquidity > 0 && data.liquidity < safety.minLiquidity) {
    return "Compra bloqueada: liquidez inferior ao mínimo configurado.";
  }
  if (safety.maxSpreadCents > 0
    && (!Number.isFinite(data.spreadCents) || data.spreadCents > safety.maxSpreadCents)) {
    return "Operação bloqueada: spread superior ao limite configurado.";
  }
  if (side === "buy" && safety.maxInvestment > 0
    && runtime.invested + conditioner.amount > safety.maxInvestment + 1e-8) {
    return "Compra bloqueada: investimento máximo do condicionador seria excedido.";
  }
  if (runtime.operations >= safety.maxOperations) return "Limite máximo de operações atingido.";
  return "";
}

async function getConditionerPosition(conditioner, marketData) {
  const assetId = marketData.assetId;
  if (conditioner.mode === "paper") {
    const state = await readSimulationState();
    const position = state.account.positions[assetId];
    return position && Number(position.shares) > 0
      ? { shares: Number(position.shares), averagePrice: Number(position.averagePrice), source: "paper" }
      : null;
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress || "")) return null;
  const cacheKey = `${walletAddress.toLowerCase()}|${marketData.conditionId}`;
  const cached = conditionerPositionCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CONDITIONER_BOOK_CACHE_MS) return cached.position;
  const response = await chrome.runtime.sendMessage({
    type: "POLYMAKR_PUBLIC_POSITIONS",
    walletAddress,
    conditionId: marketData.conditionId
  });
  if (!response || response.error) {
    throw new Error(response?.error || "Não foi possível verificar as posições públicas da carteira.");
  }
  if (!Array.isArray(response.result)) throw new Error("A resposta de posições públicas está em formato inesperado.");
  const matching = response.result.find((item) => String(item.asset || item.asset_id || item.token_id) === String(assetId));
  const size = Number(matching?.size);
  const averagePrice = Number(matching?.avgPrice ?? matching?.averagePrice);
  const position = Number.isFinite(size) && size > 0
    ? { shares: size, averagePrice: Number.isFinite(averagePrice) ? averagePrice : 0, source: "public" }
    : null;
  conditionerPositionCache.set(cacheKey, { position, fetchedAt: Date.now() });
  return position;
}

async function runConditionerOperation(conditioner, side, data, runtime, latchKey, position) {
  const shares = side === "buy"
    ? Math.max(0.01, Math.floor((conditioner.amount / (conditioner.orderLimitCents / 100)) * 100) / 100)
    : conditioner.sellAll ? Number(position?.shares) : conditioner.amount;
  if (!Number.isFinite(shares) || shares < 0.01) {
    await recordConditionerState(conditioner.id, "Venda bloqueada: não foi possível confirmar uma posição disponível.", latchKey, true);
    return;
  }
  if (side === "sell" && (!position || shares > position.shares + 1e-8)) {
    await recordConditionerState(conditioner.id, "Venda bloqueada: posição disponível insuficiente ou não verificada.", latchKey, true);
    return;
  }
  const pending = await hasConditionerPendingOrder(conditioner, data.marketData.assetId, side);
  if (pending) {
    await recordConditionerState(conditioner.id, "Operação bloqueada: já existe uma ordem pendente neste resultado.", latchKey, true);
    return;
  }
  const processingRuntime = {
    ...runtime,
    operations: runtime.operations + 1,
    invested: runtime.invested + (side === "buy" ? conditioner.amount : 0),
    latched: [...new Set([...runtime.latched, latchKey])],
    state: "processing",
    updatedAt: Date.now()
  };
  await updateConditioner(conditioner.id, (item) => ({ ...item, runtime: processingRuntime }));
  const rule = {
    id: crypto.randomUUID(),
    marketKey: conditioner.marketKey,
    marketTitle: conditioner.marketTitle,
    marketSlug: conditioner.marketSlug,
    marketRoute: conditioner.marketRoute,
    outcome: conditioner.outcome,
    side,
    mode: conditioner.mode,
    orderLimitCents: conditioner.orderLimitCents,
    shares,
    walletAddress: conditioner.mode === "auto_limit" ? walletAddress.toLowerCase() : ""
  };
  let message;
  let tracking = null;
  let orderWasSent = false;
  let finalState = "completed";
  try {
    if (conditioner.mode === "paper") {
      const order = await createSimulationOrder(rule);
      finalState = ["open", "partially_filled"].includes(order.status) ? "awaiting_fill" : order.status;
      message = `Ordem simulada ${side === "buy" ? "de compra" : "de venda"}: ${order.filledShares} de ${order.requestedShares} shares preenchidas.`;
      if (finalState === "awaiting_fill") {
        processingRuntime.activeOrderId = order.id;
      }
    } else if (conditioner.mode === "auto_limit") {
      tracking = await executeLimitOrder(rule, data.quoteRef);
      orderWasSent = true;
      finalState = "awaiting_fill";
      message = "Ordem limite enviada; aguardando preenchimento.";
      processingRuntime.activeOrderId = rule.id;
      try {
        await moveRuleToArchive(rule, "awaiting_fill", message, {
          triggeredPrice: data.quote.price,
          ...tracking,
          matchedShares: 0,
          matchedTradeKeys: []
        });
      } catch (error) {
        message = `Trade enviado, mas não foi possível salvar o acompanhamento: ${error.message || error}. Verifique a carteira.`;
      }
    } else {
      sendRuleNotification(`${side === "buy" ? "Compra" : "Venda"} condicional ${conditioner.outcome} · ${conditioner.name}`, "Condicionador");
      message = "Condição atendida; notificação enviada.";
    }
  } catch (error) {
    finalState = orderWasSent ? "awaiting_fill" : "failed";
    message = orderWasSent
      ? `Trade enviado; falha ao salvar o acompanhamento: ${error.message || error}. Verifique a carteira.`
      : `Operação não concluída: ${error.message || error}. Confira o Polymarket antes de tentar novamente.`;
    if (orderWasSent && tracking) {
      try {
        await moveRuleToArchive(rule, "awaiting_fill", message, {
          triggeredPrice: data.quote.price,
          ...tracking,
          matchedShares: 0,
          matchedTradeKeys: []
        });
      } catch (archiveError) {
        message += ` Também não foi possível registrar a ordem: ${archiveError.message || archiveError}.`;
      }
    }
  }
  const result = {
    ...processingRuntime,
    state: finalState === "awaiting_fill" ? "Ordem pendente; sem novas execuções até finalizar." : message,
    activeOrderId: finalState === "awaiting_fill" ? processingRuntime.activeOrderId : "",
    lastStatus: finalState,
    latched: [...new Set([...processingRuntime.latched, latchKey])],
    history: [...(runtime.history || []), { at: Date.now(), status: finalState, message }].slice(-30),
    updatedAt: Date.now()
  };
  await updateConditioner(conditioner.id, (item) => ({
    ...item,
    status: result.operations >= item.safety.maxOperations ? "ended" : item.status,
    runtime: result
  }));
  if (finalState === "failed") {
    showToast("Operação do condicionador falhou", message, "error");
  } else {
    showToast("Condicionador acionado", message, finalState === "awaiting_fill" ? "warning" : "success");
  }
}

async function hasConditionerPendingOrder(conditioner, assetId, side) {
  const stored = await chrome.storage.local.get([ARCHIVE_KEY, SIMULATION_ORDERS_KEY]);
  const archive = Array.isArray(stored[ARCHIVE_KEY]) ? stored[ARCHIVE_KEY] : [];
  const pendingStatuses = ["awaiting_fill", "partially_filled", "open"];
  const archivedPending = archive.some((entry) => {
    const rule = entry.rule || entry;
    return pendingStatuses.includes(entry.status)
      && rule.marketKey === conditioner.marketKey
      && rule.outcome === conditioner.outcome
      && rule.side === side;
  });
  const simulationPending = (Array.isArray(stored[SIMULATION_ORDERS_KEY]) ? stored[SIMULATION_ORDERS_KEY] : [])
    .some((order) => order.assetId === assetId && order.side === side && ["open", "partially_filled"].includes(order.status));
  return archivedPending || simulationPending;
}

async function recordConditionerState(id, message, latchKey = "", latch = false) {
  await updateConditioner(id, (item) => {
    const runtime = item.runtime || { operations: 0, invested: 0, latched: [], history: [] };
    const alreadyLatched = !latchKey || !latch || (runtime.latched || []).includes(latchKey);
    if (runtime.state === message && alreadyLatched) return item;
    const changed = runtime.state !== message;
    return {
      ...item,
      runtime: {
        ...runtime,
        latched: latchKey && latch ? [...new Set([...(runtime.latched || []), latchKey])] : runtime.latched || [],
        state: message,
        history: changed
          ? [...(runtime.history || []), {
            at: Date.now(),
            status: message.includes("bloqueada") || message.includes("bloqueado") ? "blocked" : "info",
            message
          }].slice(-30)
          : runtime.history || []
      }
    };
  });
}
