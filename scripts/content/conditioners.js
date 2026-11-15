const CONDITIONER_LOCK_PREFIX = "polymakr-conditioner-";
const CONDITIONER_DATA_LOCK = "polymakr-conditioners-storage";
const CONDITIONER_MAX_QUOTE_AGE = 5000;
const CONDITIONER_BOOK_CACHE_MS = 1800;
const CONDITIONER_MARKET_CACHE_MS = 8000;
const conditionerMarketCache = new Map();
const conditionerPositionCache = new Map();
let conditionerMonitorRunning = false;
let conditionerLastErrorAt = 0;

function addConditionerActionRow(action = {}) {
  addConditionerStageRow(conditionerForm.querySelector(".conditioner-steps"), action, false);
}

function addConditionerSafetyRow(action = {}) {
  addConditionerStageRow(conditionerForm.querySelector(".conditioner-safety-steps"), action, true);
}

function addConditionerStageRow(container, action, isSafety) {
  const row = document.createElement("div");
  row.className = `conditioner-step${isSafety ? " conditioner-safety-step" : ""}`;
  const heading = document.createElement("div");
  heading.className = "conditioner-step-heading";
  const title = document.createElement("span");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "Remover";
  remove.addEventListener("click", () => {
    row.remove();
    refreshConditionerStageTitles(container, isSafety);
  });
  heading.append(title, remove);

  const fields = document.createElement("div");
  fields.className = "conditioner-step-fields";
  const outcome = addStageSelect(fields, "Resultado", "outcome", [
    ["Up", "Up"],
    ["Down", "Down"]
  ], action.outcome || getDefaultStageOutcome(container));
  const side = addStageSelect(fields, "Ação", "side", [
    ["buy", "Comprar"],
    ["sell", "Vender"]
  ], action.side || getDefaultStageSide(container, isSafety));
  const trigger = addStageSelect(fields, "Quando o preço", "trigger", [
    ["lte", "cair até/abaixo de"],
    ["gte", "subir até/acima de"]
  ], action.trigger || (isSafety ? "lte" : side.value === "buy" ? "lte" : "gte"));
  const shares = addStageInput(fields, "Shares", "shares", action.shares, "0.01");
  const price = addStageInput(fields, "Preço limite (¢)", "priceCents", action.priceCents, "0.1");
  price.min = "0.1";
  price.max = "99.9";
  side.addEventListener("change", () => {
    if (!action.trigger) trigger.value = isSafety || side.value === "buy" ? "lte" : "gte";
    refreshConditionerStageTitles(container, isSafety);
  });
  outcome.addEventListener("change", () => refreshConditionerStageTitles(container, isSafety));
  row.append(heading, fields);
  container.append(row);
  refreshConditionerStageTitles(container, isSafety);
}

function addStageSelect(fields, labelText, name, options, value) {
  const label = document.createElement("label");
  label.append(document.createTextNode(labelText));
  const select = document.createElement("select");
  select.name = name;
  select.required = true;
  for (const [optionValue, optionLabel] of options) {
    select.add(new Option(optionLabel, optionValue));
  }
  select.value = value;
  label.append(select);
  fields.append(label);
  return select;
}

function addStageInput(fields, labelText, name, value, step) {
  const label = document.createElement("label");
  label.append(document.createTextNode(labelText));
  const input = document.createElement("input");
  input.name = name;
  input.type = "number";
  input.min = "0.01";
  input.step = step;
  input.required = true;
  input.value = value === undefined ? "" : String(value);
  label.append(input);
  fields.append(label);
  return input;
}

function getDefaultStageOutcome(container) {
  const previous = container.lastElementChild;
  return previous?.querySelector('[name="outcome"]')?.value || "Up";
}

function getDefaultStageSide(container, isSafety) {
  const previousSide = container.lastElementChild?.querySelector('[name="side"]')?.value;
  if (isSafety) return previousSide || "sell";
  return previousSide === "buy" ? "sell" : "buy";
}

function refreshConditionerStageTitles(container, isSafety) {
  [...container.children].forEach((row, index) => {
    const outcome = row.querySelector('[name="outcome"]').value;
    const side = row.querySelector('[name="side"]').value;
    row.querySelector(".conditioner-step-heading span").textContent =
      `${isSafety ? "Segurança" : "Etapa"} ${index + 1} · ${side === "buy" ? "Comprar" : "Vender"} ${outcome}`;
  });
}

function readConditionerStages(selector) {
  return [...conditionerForm.querySelectorAll(`${selector} .conditioner-step`)].map((row, index) => ({
    id: crypto.randomUUID(),
    index,
    outcome: row.querySelector('[name="outcome"]').value,
    side: row.querySelector('[name="side"]').value,
    trigger: row.querySelector('[name="trigger"]').value,
    shares: Number(row.querySelector('[name="shares"]').value),
    priceCents: Number(row.querySelector('[name="priceCents"]').value)
  }));
}

async function saveConditionerFromForm(event) {
  event.preventDefault();
  if (!activeMarketKey || !quotes.length) {
    showToast("Mercado não identificado", "Abra o painel de negociação do mercado desejado antes de criar um condicionador.", "warning");
    return;
  }
  if (!conditionerForm.reportValidity()) return;
  const data = new FormData(conditionerForm);
  const actions = readConditionerStages(".conditioner-steps");
  const safetyActions = readConditionerStages(".conditioner-safety-steps");
  if (!actions.length || !validConditionerStages(actions) || !validConditionerStages(safetyActions)) {
    showToast("Confira as etapas", "Cada etapa precisa de um resultado, uma ação, uma quantidade e um preço válidos.", "error");
    return;
  }
  const safety = {
    minRemainingMinutes: Number(data.get("minRemainingMinutes")),
    minLiquidity: Number(data.get("minLiquidity")),
    maxSpreadCents: Number(data.get("maxSpreadCents")),
    maxInvestment: Number(data.get("maxInvestment")),
    maxOperations: Number(data.get("maxOperations"))
  };
  if (!Number.isInteger(safety.maxOperations) || safety.maxOperations < 1
    || Object.values(safety).some((value) => !Number.isFinite(value) || value < 0)) {
    showToast("Confira as proteções", "Informe limites numéricos válidos.", "error");
    return;
  }
  const allStages = [...actions, ...safetyActions];
  if (data.get("mode") === "auto_limit" && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress || "")) {
    showToast("Configure a carteira pública", "Informe o endereço público na aba Configurações para acompanhar ordens automatizadas.", "error");
    selectView("settings");
    walletInput.focus();
    return;
  }
  if (data.get("mode") === "auto_limit" && allStages.some((stage) => stage.side === "sell")
    && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress || "")) {
    showToast("Configure a carteira pública", "Informe o endereço público na aba Configurações para verificar posições antes de vender.", "error");
    selectView("settings");
    walletInput.focus();
    return;
  }
  const primaryQuote = quotes.find((quote) => quoteMarketKey(quote) === activeMarketKey);
  const conditioner = {
    schemaVersion: 3,
    id: crypto.randomUUID(),
    name: String(data.get("name")).trim(),
    description: String(data.get("description") || "").trim(),
    marketKey: activeMarketKey,
    marketTitle: primaryQuote?.marketTitle || primaryQuote?.market || "",
    marketSlug: primaryQuote?.marketSlug || "",
    marketRoute: primaryQuote?.marketRoute || "",
    actions,
    safetyActions,
    mode: data.get("mode"),
    safety,
    status: "active",
    runtime: {
      actionIndex: 0,
      activeActionOrderId: "",
      operations: 0,
      invested: 0,
      safetyStages: {},
      history: [],
      state: "Aguardando condições."
    },
    createdAt: Date.now()
  };
  try {
    await navigator.locks.request(CONDITIONER_DATA_LOCK, async () => {
      const stored = await chrome.storage.local.get(CONDITIONERS_KEY);
      const saved = normalizeConditioners(Array.isArray(stored[CONDITIONERS_KEY]) ? stored[CONDITIONERS_KEY] : []);
      const next = [...saved, conditioner];
      await chrome.storage.local.set({ [CONDITIONERS_KEY]: next });
      conditioners = next;
    });
    conditionerForm.reset();
    conditionerForm.querySelector(".conditioner-steps").replaceChildren();
    conditionerForm.querySelector(".conditioner-safety-steps").replaceChildren();
    addConditionerActionRow();
    renderConditioners();
    showToast("Condicionador criado", `${conditioner.name} está ativo para este mercado.`, "success");
  } catch (error) {
    showToast("Não foi possível salvar", error.message || String(error), "error");
  }
}

function validConditionerStages(stages) {
  return stages.every((stage) => ["Up", "Down"].includes(stage.outcome)
    && ["buy", "sell"].includes(stage.side)
    && ["lte", "gte"].includes(stage.trigger)
    && Number.isFinite(stage.shares) && stage.shares >= 0.01
    && Number.isFinite(stage.priceCents) && stage.priceCents > 0 && stage.priceCents < 100);
}

function normalizeConditioners(items) {
  return items.map(normalizeConditioner);
}

async function migrateStoredConditioners() {
  await navigator.locks.request(CONDITIONER_DATA_LOCK, async () => {
    const stored = await chrome.storage.local.get(CONDITIONERS_KEY);
    const saved = Array.isArray(stored[CONDITIONERS_KEY]) ? stored[CONDITIONERS_KEY] : [];
    const normalized = normalizeConditioners(saved);
    if (JSON.stringify(saved) !== JSON.stringify(normalized)) {
      await chrome.storage.local.set({ [CONDITIONERS_KEY]: normalized });
    }
    conditioners = normalized;
  });
}

function normalizeConditioner(conditioner) {
  if (!conditioner || typeof conditioner !== "object" || !Array.isArray(conditioner.actions)) return conditioner;
  if (conditioner.schemaVersion === 3 && Array.isArray(conditioner.safetyActions)
    && conditioner.actions.every((stage) => stage.outcome)) return conditioner;
  const outcome = conditioner.outcome || conditioner.actions[0]?.outcome || "Up";
  const actions = conditioner.actions.map((stage, index) => ({
    ...stage,
    id: stage.id || `${conditioner.id || "conditioner"}-legacy-action-${index}`,
    index,
    outcome: stage.outcome || outcome,
    shares: Number(stage.shares ?? conditioner.amount),
    priceCents: Number(stage.priceCents ?? conditioner.orderLimitCents)
  }));
  const legacySafety = conditioner.safety || {};
  let safetyActions = Array.isArray(conditioner.safetyActions) ? conditioner.safetyActions : [];
  if (!safetyActions.length && legacySafety.enabled && Number(legacySafety.priceCents) > 0) {
    safetyActions = [{
      id: `${conditioner.id || "conditioner"}-legacy-safety-0`,
      index: 0,
      outcome,
      side: "sell",
      trigger: legacySafety.trigger || "lte",
      shares: Number(legacySafety.shares) || 0.01,
      priceCents: Number(legacySafety.priceCents),
      sellAll: Boolean(legacySafety.sellAll)
    }];
  }
  safetyActions = safetyActions.map((stage, index) => ({
    ...stage,
    id: stage.id || `${conditioner.id || "conditioner"}-legacy-safety-${index}`,
    index,
    outcome: stage.outcome || outcome,
    shares: Number(stage.shares),
    priceCents: Number(stage.priceCents)
  }));
  const oldRuntime = conditioner.runtime || {};
  const safetyStages = { ...(oldRuntime.safetyStages || {}) };
  if (oldRuntime.pendingKind === "safety" && oldRuntime.activeOrderId && safetyActions[0]) {
    safetyStages[safetyActions[0].id] = {
      status: oldRuntime.state === "processing" ? "processing" : "pending",
      activeOrderId: oldRuntime.activeOrderId
    };
  }
  const runtime = {
    ...oldRuntime,
    actionIndex: Number.isInteger(Number(oldRuntime.actionIndex)) && Number(oldRuntime.actionIndex) >= 0
      ? Number(oldRuntime.actionIndex) : 0,
    activeActionOrderId: oldRuntime.pendingKind === "safety"
      ? "" : oldRuntime.activeActionOrderId || oldRuntime.activeOrderId || "",
    operations: Number(oldRuntime.operations) || 0,
    invested: Number(oldRuntime.invested) || 0,
    safetyStages,
    history: Array.isArray(oldRuntime.history) ? oldRuntime.history : [],
    state: oldRuntime.state || "Aguardando condições."
  };
  delete runtime.activeOrderId;
  delete runtime.pendingKind;
  return {
    ...conditioner,
    schemaVersion: 3,
    actions,
    safetyActions,
    safety: {
      ...legacySafety,
      minRemainingMinutes: Number(legacySafety.minRemainingMinutes) || 0,
      minLiquidity: Number(legacySafety.minLiquidity) || 0,
      maxSpreadCents: Number(legacySafety.maxSpreadCents) || 0,
      maxInvestment: Number(legacySafety.maxInvestment) || 0,
      maxOperations: Number(legacySafety.maxOperations) || 10
    },
    runtime
  };
}

function renderConditioners() {
  if (!conditionerListElement) return;
  conditioners = normalizeConditioners(conditioners);
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
    market.textContent = conditioner.marketTitle || conditioner.marketKey;
    const actionCount = (conditioner.actions || []).length;
    const safetyCount = (conditioner.safetyActions || []).length;
    const description = document.createElement("p");
    description.textContent = conditioner.description
      || `${actionCount} etapa(s) principais · ${safetyCount} de segurança · ${conditioner.mode === "auto_limit" ? "ordem real limite" : "simulação"}`;
    const runtime = conditioner.runtime || {};
    const state = document.createElement("p");
    state.textContent = `${runtime.operations || 0}/${conditioner.safety?.maxOperations || 10} operações · ${runtime.state || "Aguardando condições."}`;
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
    const saved = normalizeConditioners(Array.isArray(stored[CONDITIONERS_KEY]) ? stored[CONDITIONERS_KEY] : []);
    if (!saved.some((item) => item?.id === id)) throw new Error("O condicionador não foi encontrado.");
    const next = saved.map((item) => item.id === id ? updater(item) : item);
    await chrome.storage.local.set({ [CONDITIONERS_KEY]: next });
    conditioners = next;
  });
  renderConditioners();
}

async function monitorConditioners() {
  if (conditionerMonitorRunning || !activeMarketKey || !quotes.length) return;
  conditionerMonitorRunning = true;
  try {
    conditioners = normalizeConditioners(conditioners);
    const active = conditioners.filter((item) =>
      item?.status === "active" && item.marketKey === activeMarketKey && item.schemaVersion === 3
    );
    for (const conditioner of active) {
      await navigator.locks.request(`${CONDITIONER_LOCK_PREFIX}${conditioner.id}`, async () => {
        try {
          await evaluateConditioner(conditioner);
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

async function loadConditionerMarketData(conditioner, outcome) {
  const cacheKey = `${conditioner.marketKey}|${outcome.toLowerCase()}`;
  const now = Date.now();
  let cached = conditionerMarketCache.get(cacheKey);
  if (!cached || now - cached.fetchedAt > CONDITIONER_MARKET_CACHE_MS) {
    const marketData = await resolveMarketTradingData({ ...conditioner, outcome });
    cached = { marketData, fetchedAt: now, books: new Map() };
    conditionerMarketCache.set(cacheKey, cached);
  }
  const quote = quotes.find((item) => quoteMarketKey(item) === conditioner.marketKey
    && item.outcome.toLowerCase() === outcome.toLowerCase());
  if (!quote || quote.unavailable) throw new Error(`A cotação de ${outcome} não está disponível.`);
  let book = cached.books.get(cached.marketData.assetId);
  if (!book || now - book.fetchedAt > CONDITIONER_BOOK_CACHE_MS) {
    book = await fetchSimulationBook(cached.marketData.assetId);
    cached.books.set(cached.marketData.assetId, book);
  }
  const liquidity = [...book.asks, ...book.bids]
    .reduce((total, level) => total + level.price * level.size, 0);
  return {
    marketData: cached.marketData,
    quote,
    quoteRef: quote,
    book,
    quoteFetchedAt: quote.fetchedAt || now,
    remainingMinutes: cached.marketData.endDate === null
      ? null : (cached.marketData.endDate - now) / 60000,
    liquidity,
    spreadCents: book.asks[0] && book.bids[0]
      ? Math.max(0, (book.asks[0].price - book.bids[0].price) * 100) : null
  };
}

async function evaluateConditioner(conditioner) {
  const stored = await chrome.storage.local.get(CONDITIONERS_KEY);
  const current = normalizeConditioners(Array.isArray(stored[CONDITIONERS_KEY]) ? stored[CONDITIONERS_KEY] : [])
    .find((item) => item?.id === conditioner.id);
  if (!current || current.status !== "active" || current.marketKey !== activeMarketKey) return;
  const runtime = normalizeConditionerRuntime(current.runtime);
  const safetyResult = await runConditionerSafetyStages(current, runtime);
  if (safetyResult !== "clear") return;

  if (runtime.activeActionOrderId) {
    const status = await getConditionerOrderStatus(runtime.activeActionOrderId, current.mode);
    if (status === "pending") return;
    if (status === "filled") {
      const nextIndex = runtime.actionIndex + 1;
      const complete = nextIndex >= current.actions.length;
      await updateConditioner(current.id, (item) => ({
        ...item,
        status: complete && !(item.safetyActions || []).length ? "ended" : item.status,
        runtime: {
          ...normalizeConditionerRuntime(item.runtime),
          actionIndex: nextIndex,
          activeActionOrderId: "",
          state: complete
            ? (item.safetyActions || []).length
              ? "Etapas principais concluídas; segurança permanece ativa."
              : "Etapas principais concluídas."
            : "Etapa preenchida; aguardando a próxima.",
          history: appendConditionerHistory(normalizeConditionerRuntime(item.runtime).history, "Etapa principal preenchida.")
        }
      }));
      return;
    }
    await pauseConditionerAfterUncertainOrder(current.id, status);
    return;
  }
  if (runtime.state === "processing") {
    await pauseConditionerAfterUncertainOrder(current.id, "incerta");
    return;
  }
  if (runtime.operations >= current.safety.maxOperations) {
    if (!(current.safetyActions || []).length) await changeConditionerStatus(current.id, "ended");
    else await recordConditionerState(current.id, "Limite de operações principais atingido; etapas de segurança continuam ativas.");
    return;
  }
  const stage = current.actions[runtime.actionIndex];
  if (!stage) {
    if (!(current.safetyActions || []).length) await changeConditionerStatus(current.id, "ended");
    else await recordConditionerState(current.id, "Etapas principais concluídas; monitorando as etapas de segurança.");
    return;
  }
  const data = await loadConditionerMarketData(current, stage.outcome);
  if (data.marketData.isActive === false) {
    await recordConditionerState(current.id, "Mercado suspenso ou indisponível; nenhuma operação foi enviada.");
    return;
  }
  const failure = conditionerSafetyFailure(current, stage, data, runtime, false);
  if (failure) {
    await recordConditionerState(current.id, failure);
    return;
  }
  if (Date.now() - data.quoteFetchedAt > CONDITIONER_MAX_QUOTE_AGE
    || Date.now() - data.book.fetchedAt > CONDITIONER_MAX_QUOTE_AGE) {
    await recordConditionerState(current.id, "Dados do mercado desatualizados; aguardando atualização.");
    return;
  }
  const triggered = conditionerStageTriggered(stage, data.quote.price);
  if (!triggered) {
    await recordConditionerState(current.id, `Aguardando etapa ${runtime.actionIndex + 1}: ${stage.outcome} ${stage.trigger === "lte" ? "≤" : "≥"} ${stage.priceCents}¢.`);
    return;
  }
  await executeConditionerStage(current, stage, data, runtime, false);
}

function normalizeConditionerRuntime(runtime = {}) {
  return {
    ...runtime,
    actionIndex: Number.isInteger(Number(runtime.actionIndex)) && Number(runtime.actionIndex) >= 0
      ? Number(runtime.actionIndex) : 0,
    activeActionOrderId: runtime.activeActionOrderId || runtime.activeOrderId || "",
    operations: Number(runtime.operations) || 0,
    invested: Number(runtime.invested) || 0,
    safetyStages: runtime.safetyStages && typeof runtime.safetyStages === "object" ? runtime.safetyStages : {},
    history: Array.isArray(runtime.history) ? runtime.history : [],
    state: runtime.state || "Aguardando condições."
  };
}

async function runConditionerSafetyStages(conditioner, runtime) {
  for (const stage of conditioner.safetyActions || []) {
    const state = runtime.safetyStages[stage.id] || { status: "ready" };
    if (["pending", "processing"].includes(state.status)) {
      const status = await getConditionerOrderStatus(state.activeOrderId, conditioner.mode);
      if (status === "pending") return "pending";
      const nextStatus = status === "filled" ? "completed" : status === "uncertain" ? "uncertain" : "failed";
      await updateSafetyStageState(conditioner.id, stage.id, {
        ...state,
        status: nextStatus,
        activeOrderId: "",
        message: status === "filled"
          ? "Etapa de segurança preenchida."
          : `Etapa de segurança ${status}; não será repetida automaticamente.`
      });
      return "updated";
    }
    if (state.status !== "ready") continue;
    const data = await loadConditionerMarketData(conditioner, stage.outcome);
    if (data.marketData.isActive === false
      || Date.now() - data.quoteFetchedAt > CONDITIONER_MAX_QUOTE_AGE
      || Date.now() - data.book.fetchedAt > CONDITIONER_MAX_QUOTE_AGE) continue;
    const triggered = conditionerStageTriggered(stage, data.quote.price);
    if (!triggered) continue;
    const failure = conditionerSafetyFailure(conditioner, stage, data, runtime, true);
    if (failure) {
      if (state.lastMessage !== failure) {
        await updateSafetyStageState(conditioner.id, stage.id, { ...state, lastMessage: failure });
      }
      continue;
    }
    await executeConditionerStage(conditioner, stage, data, runtime, true);
    return "fired";
  }
  return "clear";
}

function conditionerStageTriggered(stage, price) {
  return stage.trigger === "lte" ? price <= stage.priceCents : price >= stage.priceCents;
}

async function updateSafetyStageState(conditionerId, stageId, state) {
  await updateConditioner(conditionerId, (item) => {
    const runtime = normalizeConditionerRuntime(item.runtime);
    const prior = runtime.safetyStages[stageId] || {};
    if (prior.status === state.status && prior.message === state.message && prior.lastMessage === state.lastMessage) return item;
    const message = state.message || state.lastMessage || "";
    return {
      ...item,
      runtime: {
        ...runtime,
        safetyStages: { ...runtime.safetyStages, [stageId]: state },
        history: message && prior.message !== message
          ? appendConditionerHistory(runtime.history, message)
          : runtime.history,
        state: message || runtime.state
      }
    };
  });
}

function conditionerSafetyFailure(conditioner, stage, data, runtime, isSafety) {
  const safety = conditioner.safety || {};
  if (data.marketData.isActive === false) return "Mercado suspenso ou indisponível.";
  if (stage.side === "buy" && safety.minRemainingMinutes > 0
    && (!Number.isFinite(data.remainingMinutes) || data.remainingMinutes < safety.minRemainingMinutes)) {
    return "Compra bloqueada pelo limite de tempo restante.";
  }
  if (stage.side === "buy" && safety.minLiquidity > 0 && data.liquidity < safety.minLiquidity) {
    return "Compra bloqueada: liquidez inferior ao mínimo configurado.";
  }
  if (safety.maxSpreadCents > 0 && (stage.side === "buy" || !isSafety)
    && (!Number.isFinite(data.spreadCents) || data.spreadCents > safety.maxSpreadCents)) {
    return "Operação bloqueada: spread superior ao limite configurado.";
  }
  const cost = stage.shares * stage.priceCents / 100;
  if (stage.side === "buy" && safety.maxInvestment > 0
    && runtime.invested + cost > safety.maxInvestment + 1e-8) {
    return "Compra bloqueada: investimento máximo do condicionador seria excedido.";
  }
  if (!isSafety && runtime.operations >= safety.maxOperations) return "Limite máximo de operações atingido.";
  return "";
}

async function executeConditionerStage(conditioner, stage, data, runtime, isSafety) {
  if (Date.now() - data.quoteFetchedAt > CONDITIONER_MAX_QUOTE_AGE
    || Date.now() - data.book.fetchedAt > CONDITIONER_MAX_QUOTE_AGE) {
    await recordConditionerState(conditioner.id, "Dados do mercado desatualizados; operação bloqueada.");
    return;
  }
  let position = null;
  let shares = stage.shares;
  if (stage.side === "sell") {
    position = await getConditionerPosition(conditioner, data.marketData);
    if (stage.sellAll && position) shares = position.shares;
    if (!position || position.shares < shares) {
      await recordConditionerState(conditioner.id, "Venda bloqueada: posição disponível insuficiente ou não verificada.");
      return;
    }
  }
  if (await hasConditionerPendingOrder(conditioner, stage, data.marketData.assetId)) {
    await recordConditionerState(conditioner.id, "Operação bloqueada: já existe uma ordem pendente neste resultado.");
    return;
  }
  const rule = {
    id: crypto.randomUUID(),
    marketKey: conditioner.marketKey,
    marketTitle: conditioner.marketTitle,
    marketSlug: conditioner.marketSlug,
    marketRoute: conditioner.marketRoute,
    outcome: stage.outcome,
    side: stage.side,
    mode: conditioner.mode,
    orderLimitCents: stage.priceCents,
    shares,
    walletAddress: conditioner.mode === "auto_limit" ? walletAddress.toLowerCase() : ""
  };
  const nextRuntime = {
    ...runtime,
    operations: runtime.operations + 1,
    invested: runtime.invested + (stage.side === "buy" ? stage.shares * stage.priceCents / 100 : 0),
    updatedAt: Date.now()
  };
  if (isSafety) {
    nextRuntime.safetyStages = {
      ...runtime.safetyStages,
      [stage.id]: { status: "processing", activeOrderId: rule.id }
    };
  } else {
    nextRuntime.state = "processing";
    nextRuntime.activeActionOrderId = rule.id;
  }
  await updateConditioner(conditioner.id, (item) => ({ ...item, runtime: nextRuntime }));
  let message = "";
  let status = "failed";
  let tracking = null;
  let orderSent = false;
  try {
    if (conditioner.mode === "paper") {
      const order = await createSimulationOrder(rule);
      status = ["open", "partially_filled"].includes(order.status) ? "pending" : order.status === "filled" ? "filled" : "failed";
      rule.id = order.id;
      message = `Ordem simulada ${stage.side === "buy" ? "de compra" : "de venda"} ${stage.outcome}: ${order.filledShares} de ${order.requestedShares} shares preenchidas.`;
    } else if (conditioner.mode === "auto_limit") {
      tracking = await executeLimitOrder(rule, data.quoteRef);
      orderSent = true;
      status = "pending";
      message = "Ordem limite enviada; aguardando preenchimento.";
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
      throw new Error("O modo de execução salvo é inválido.");
    }
  } catch (error) {
    status = orderSent ? "pending" : "failed";
    message = orderSent
      ? `Trade enviado; falha ao salvar o acompanhamento: ${error.message || error}. Verifique a carteira.`
      : `Operação não concluída: ${error.message || error}. Confira o Polymarket antes de tentar novamente.`;
    if (orderSent && tracking) {
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
  await updateConditioner(conditioner.id, (item) => {
    const latest = normalizeConditionerRuntime(item.runtime);
    const stillPending = status === "pending";
    let updated = { ...latest };
    if (isSafety) {
      updated.safetyStages = {
        ...latest.safetyStages,
        [stage.id]: {
          status: stillPending ? "pending" : status === "filled" ? "completed" : "failed",
          activeOrderId: stillPending ? rule.id : "",
          message
        }
      };
    } else {
      updated = {
        ...updated,
        state: stillPending ? "Ordem pendente; aguardando preenchimento." : message,
        activeActionOrderId: stillPending ? rule.id : "",
        lastStatus: status,
        actionIndex: status === "filled" ? latest.actionIndex + 1 : latest.actionIndex
      };
      if (status === "failed") item.status = "paused";
    }
    updated.history = appendConditionerHistory(latest.history, message, status);
    updated.updatedAt = Date.now();
    const mainComplete = updated.actionIndex >= item.actions.length;
    if (!isSafety && mainComplete && !(item.safetyActions || []).length && status === "filled") {
      item.status = "ended";
      updated.state = "Etapas principais concluídas.";
    }
    return { ...item, runtime: updated };
  });
  if (status === "failed") showToast("Operação do condicionador falhou", message, "error");
  else showToast("Condicionador acionado", message, status === "pending" ? "warning" : "success");
}

async function getConditionerPosition(conditioner, marketData) {
  if (conditioner.mode === "paper") {
    const state = await readSimulationState();
    const position = state.account.positions[marketData.assetId];
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
  const matching = response.result.find((item) => String(item.asset || item.asset_id || item.token_id) === String(marketData.assetId));
  const shares = Number(matching?.size);
  const averagePrice = Number(matching?.avgPrice ?? matching?.averagePrice);
  const position = Number.isFinite(shares) && shares > 0
    ? { shares, averagePrice: Number.isFinite(averagePrice) ? averagePrice : 0, source: "public" }
    : null;
  conditionerPositionCache.set(cacheKey, { position, fetchedAt: Date.now() });
  return position;
}

async function hasConditionerPendingOrder(conditioner, stage, assetId) {
  const stored = await chrome.storage.local.get([ARCHIVE_KEY, SIMULATION_ORDERS_KEY]);
  const archive = Array.isArray(stored[ARCHIVE_KEY]) ? stored[ARCHIVE_KEY] : [];
  const archivedPending = archive.some((entry) => {
    const rule = entry.rule || entry;
    return ["awaiting_fill", "partially_filled", "open"].includes(entry.status)
      && rule.marketKey === conditioner.marketKey
      && rule.outcome === stage.outcome;
  });
  const simulationPending = (Array.isArray(stored[SIMULATION_ORDERS_KEY]) ? stored[SIMULATION_ORDERS_KEY] : [])
    .some((order) => order.assetId === assetId
      && ["open", "partially_filled"].includes(order.status));
  return archivedPending || simulationPending;
}

async function getConditionerOrderStatus(orderId, mode) {
  if (!orderId) return "uncertain";
  if (mode === "paper") {
    const stored = await chrome.storage.local.get(SIMULATION_ORDERS_KEY);
    const orders = Array.isArray(stored[SIMULATION_ORDERS_KEY]) ? stored[SIMULATION_ORDERS_KEY] : [];
    const order = orders.find((item) => item.id === orderId);
    if (!order) return "uncertain";
    if (["open", "partially_filled"].includes(order.status)) return "pending";
    return order.status === "filled" ? "filled" : "failed";
  }
  const stored = await chrome.storage.local.get(ARCHIVE_KEY);
  const archive = Array.isArray(stored[ARCHIVE_KEY]) ? stored[ARCHIVE_KEY] : [];
  const entry = archive.find((item) => item.id === orderId);
  if (!entry) return "uncertain";
  if (["awaiting_fill", "partially_filled", "open"].includes(entry.status)) return "pending";
  return entry.status === "filled" ? "filled" : "failed";
}

async function pauseConditionerAfterUncertainOrder(id, status) {
  await updateConditioner(id, (item) => ({
    ...item,
    status: "paused",
    runtime: {
      ...normalizeConditionerRuntime(item.runtime),
      activeActionOrderId: "",
      state: `Ordem anterior ${status}; estratégia pausada para conferência.`
    }
  }));
  showToast("Condicionador pausado", "Uma ordem falhou ou ficou incerta. Confira a posição antes de retomar.", "warning");
}

async function recordConditionerState(id, message) {
  await updateConditioner(id, (item) => {
    const runtime = normalizeConditionerRuntime(item.runtime);
    if (runtime.state === message) return item;
    return {
      ...item,
      runtime: {
        ...runtime,
        state: message,
        history: appendConditionerHistory(runtime.history, message)
      }
    };
  });
}

function appendConditionerHistory(history, message, status = "info") {
  const last = history[history.length - 1];
  if (last?.message === message) return history;
  return [...history, { at: Date.now(), status, message }].slice(-30);
}
