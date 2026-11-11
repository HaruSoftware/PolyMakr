function renderQuotes() {
  const editingRule = editingRuleId && rules.find((rule) => rule.id === editingRuleId);
  const selectedQuoteKey = editingRule
    ? quotes.find((quote) => quote.outcome === editingRule.outcome)?.key || ""
    : quotes.some((quote) => quote.key === quoteSelect.value)
      ? quoteSelect.value
      : "";
  quoteSelect.replaceChildren();
  quoteOptions.replaceChildren();

  if (quotes.length === 0 && !editingRule) {
    quoteSelect.add(new Option("Aguardando mercado…", ""));
    quoteOptions.innerHTML = '<p class="empty">Abra o painel de negociação de um mercado para selecionar Up/Down.</p>';
    return;
  }

  const groupedQuotes = new Map();
  for (const quote of quotes) {
    const marketKey = quote.key.slice(0, quote.key.lastIndexOf("|"));
    if (!groupedQuotes.has(marketKey)) {
      groupedQuotes.set(marketKey, { market: quote.market, outcomes: new Map() });
    }
    groupedQuotes.get(marketKey).outcomes.set(quote.outcome, quote);
  }
  for (const { market, outcomes: outcomesByName } of groupedQuotes.values()) {
    const marketGroup = document.createElement("div");
    marketGroup.className = "market-group";
    const title = document.createElement("span");
    title.className = "market-title";
    title.textContent = market;
    const outcomes = document.createElement("div");
    outcomes.className = "outcome-options";

    for (const outcome of ["Up", "Down"]) {
      const quote = outcomesByName.get(outcome);
      const choice = document.createElement("button");
      choice.type = "button";
      choice.className = `outcome-choice ${outcome.toLowerCase()}`;
      choice.textContent = outcome;
      choice.setAttribute("aria-pressed", String(Boolean(quote && quote.key === selectedQuoteKey)));
      choice.disabled = !quote || Boolean(quote.unavailable);
      if (quote && !quote.unavailable) {
        quoteSelect.add(new Option(`${market} · ${choice.textContent}`, quote.key));
        choice.addEventListener("click", () => {
          quoteSelect.value = quote.key;
          renderQuotes();
        });
      }
      outcomes.append(choice);
    }

    marketGroup.append(title, outcomes);
    quoteOptions.append(marketGroup);
  }

  quoteSelect.value = selectedQuoteKey;
}

function renderRules() {
  const marketRules = rules.filter((rule) => rule.marketKey === activeMarketKey);
  const queuedRules = marketRules.filter((rule) => rule.queuePolicy !== "independent");
  const immediateRules = marketRules.filter((rule) => rule.queuePolicy === "independent");
  renderRuleList(queueRulesElement, queuedRules, "ordered");
  renderRuleList(immediateRulesElement, immediateRules, "independent");
  renderFavorites();
  shadow.querySelector(".rules-count").textContent = String(marketRules.length);
  shadow.querySelector('[data-lane="ordered"] .lane-count').textContent = String(queuedRules.length);
  shadow.querySelector('[data-lane="independent"] .lane-count').textContent = String(immediateRules.length);
  shadow.querySelector('[data-lane="favorites"] .lane-count').textContent = String(favorites.length);
}

function renderArchive() {
  archiveElement.replaceChildren();
  const sortedArchive = [...archivedRules].sort((left, right) =>
    Number(right.updatedAt || right.archivedAt || right.createdAt)
      - Number(left.updatedAt || left.archivedAt || left.createdAt)
  );
  shadow.querySelector(".archive-count").textContent = String(sortedArchive.length);
  if (sortedArchive.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "As regras removidas ou disparadas aparecerão aqui.";
    archiveElement.append(empty);
    return;
  }

  const statusLabels = {
    awaiting_fill: "Aguardando preenchimento",
    partially_filled: "Preenchida parcialmente",
    filled: "Preenchida",
    completed: "Concluída",
    failed: "Falhou",
    cancelled: "Cancelada",
    submitted_untracked: "Enviada — sem acompanhamento"
  };
  for (const entry of sortedArchive) {
    const rule = entry.rule || entry;
    const card = document.createElement("article");
    card.className = "archive-card";
    const status = document.createElement("p");
    status.className = "archive-status";
    status.textContent = `${statusLabels[entry.status] || "Registrada"} · ${new Date(entry.updatedAt || entry.archivedAt || entry.createdAt).toLocaleString("pt-BR")}`;
    const action = document.createElement("p");
    action.textContent = `${rule.side === "buy" ? "Compra" : "Venda"} ${rule.outcome} · ${rule.shares ?? rule.amount} shares · gatilho ${rule.triggerCents ?? rule.limitCents}¢ · limite ${rule.orderLimitCents ?? rule.limitCents}¢`;
    const market = document.createElement("p");
    market.textContent = `Mercado: ${rule.marketTitle || rule.marketKey || "não identificado"}`;
    const message = document.createElement("p");
    message.textContent = entry.message || "";
    card.append(status, action, market, message);
    if (Number(entry.matchedShares) > 0) {
      const fills = document.createElement("p");
      fills.textContent = `Fill observado: ${entry.matchedShares} de ${rule.shares ?? rule.amount} shares`;
      card.append(fills);
    }
    if (entry.trackingError) {
      const error = document.createElement("p");
      error.className = "archive-error";
      error.textContent = `Acompanhamento: ${entry.trackingError}`;
      card.append(error);
    }
    if (rule.mode === "auto_limit"
      && ["awaiting_fill", "partially_filled", "filled", "submitted_untracked"].includes(entry.status)) {
      const caveat = document.createElement("p");
      caveat.textContent = "Confirmação baseada em trades públicos compatíveis; a API pública não informa o ID da ordem.";
      card.append(caveat);
    }
    archiveElement.append(card);
  }
}

function renderRuleList(container, list, queuePolicy) {
  container.replaceChildren();
  if (list.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = queuePolicy === "independent"
      ? "Arraste uma regra para cá para executá-la ao atingir o gatilho."
      : "Crie uma regra ou arraste-a para esta fila.";
    container.append(empty);
    return;
  }

  for (const rule of list) {
    const row = document.createElement("div");
    row.className = "rule";
    row.draggable = true;
    row.dataset.cardType = "rule";
    row.dataset.cardId = rule.id;
    const triggerPrice = Number(rule.triggerCents ?? rule.limitCents);
    const orderPrice = Number(rule.orderLimitCents ?? rule.limitCents);
    const size = rule.shares === undefined
      ? (rule.side === "buy" ? `US$ ${rule.amount}` : `${rule.amount} shares`)
      : `${rule.shares} shares`;
    const execution = executionStates[rule.id] || {};
    const state = execution.status || "monitoring";
    const stateLabels = {
      monitoring: "Monitorando",
      queued: "Na fila",
      processing: "Executando",
      awaiting_fill: "Aguardando preenchimento",
      partially_filled: "Preenchida parcialmente",
      filled: "Preenchida",
      completed: "Concluída",
      clicked: "Trade enviado",
      failed: "Falhou"
    };
    const header = document.createElement("div");
    header.className = "rule-header";
    const heading = document.createElement("div");
    heading.className = "rule-heading";
    const tradeBadge = document.createElement("span");
    const outcome = rule.outcome === "Down" ? "down" : "up";
    const side = rule.side === "sell" ? "sell" : "buy";
    tradeBadge.className = `trade-badge ${side} ${outcome}`;
    tradeBadge.title = `${side === "buy" ? "Buy" : "Sell"} ${outcome === "up" ? "Up" : "Down"}`;
    tradeBadge.setAttribute("aria-label", tradeBadge.title);
    const sideLabel = document.createElement("span");
    sideLabel.className = `trade-side ${side}`;
    sideLabel.textContent = side === "buy" ? "BUY" : "SELL";
    const outcomeLabel = document.createElement("span");
    outcomeLabel.className = `trade-outcome ${outcome}`;
    outcomeLabel.textContent = outcome === "up" ? "UP" : "DOWN";
    tradeBadge.append(sideLabel, outcomeLabel);
    heading.append(tradeBadge);
    const market = document.createElement("span");
    market.className = "rule-market";
    market.textContent = quotes[0]?.market || "Aguardando mercado";
    market.title = market.textContent;
    heading.append(market);
    const topActions = document.createElement("div");
    topActions.className = "rule-top-actions";
    const modeIcon = document.createElement("span");
    modeIcon.className = `action-icon ${rule.mode || "notify"}`;
    modeIcon.textContent = rule.mode === "auto_limit" ? "⚡" : rule.mode === "confirm" ? "?" : "◉";
    modeIcon.title = rule.mode === "auto_limit" ? "Automatizar ordem limite"
      : rule.mode === "confirm" ? "Avisar e pedir confirmação" : "Somente notificar";
    modeIcon.setAttribute("aria-label", modeIcon.title);
    topActions.append(modeIcon, createRuleMore(rule, {
      triggerPrice, orderPrice, size, state, stateLabels,
      message: execution.message
    }));
    header.append(heading, topActions);
    row.append(header);
    const meta = document.createElement("div");
    meta.className = "card-meta";
    const trigger = document.createElement("div");
    trigger.className = "card-trigger";
    trigger.append(document.createTextNode("Gatilho"));
    const triggerValue = document.createElement("strong");
    triggerValue.textContent = `${triggerPrice.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}¢`;
    trigger.append(triggerValue);
    const remove = createCardRemoveButton("Arquivar regra", () => removeRule(rule), "Arquivar");
    meta.append(trigger, remove);
    row.append(meta);
    container.append(row);
  }
}

function createCardRemoveButton(label, onClick, buttonText = "Remover") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "card-remove";
  button.textContent = buttonText;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    await onClick();
  });
  return button;
}

async function removeRule(rule) {
  try {
    let pending = false;
    try {
      pending = await hasPendingRuleExecution(rule.id);
    } catch (error) {
      showToast("Não foi possível verificar a regra", error.message || String(error), "error");
      return;
    }
    if (pending) {
      showToast("Regra em execução", "A regra não pode ser arquivada enquanto aguarda execução.", "warning");
      return;
    }
    const execution = executionStates[rule.id] || {};
    const untrackedOrder = rule.mode === "auto_limit"
      && ["clicked", "completed"].includes(execution.status)
      && !execution.conditionId;
    const trackingStatus = ["awaiting_fill", "partially_filled", "filled"].includes(execution.status)
      ? execution.status
      : "";
    const status = trackingStatus || (untrackedOrder ? "submitted_untracked"
      : execution.status === "failed" ? "failed"
        : execution.status === "completed" ? "completed" : "cancelled");
    const message = untrackedOrder
      ? "Trade enviado antes da ativação do acompanhamento de fills; verifique o Polymarket."
      : execution.message || "Regra removida antes do disparo.";
    await moveRuleToArchive(rule, status, message, {
      triggeredPrice: execution.triggeredPrice,
      submittedAt: execution.submittedAt,
      conditionId: execution.conditionId,
      assetId: execution.assetId,
      baselineTradeKeys: execution.baselineTradeKeys,
      matchedTradeKeys: execution.matchedTradeKeys || [],
      matchedShares: execution.matchedShares || 0
    });
    showToast("Regra movida para o Registro", "O histórico foi preservado.", "success");
  } catch (error) {
    showToast("Não foi possível arquivar a regra", error.message || String(error), "error");
  }
}

function createRuleMore(rule, details) {
  const more = document.createElement("details");
  more.className = "more";
  const summary = document.createElement("summary");
  summary.textContent = "⋮";
  summary.setAttribute("aria-label", "Mostrar informações e ações da regra");
  const popup = document.createElement("div");
  popup.className = "more-popup";
  const info = document.createElement("div");
  info.className = "more-info";
  info.textContent = `${rule.side === "buy" ? "Comprar" : "Vender"} ${rule.outcome}`;
  const metrics = document.createElement("div");
  metrics.className = "more-metrics";
  for (const [label, value] of [
    ["Gatilho", `${details.triggerPrice}¢`],
    ["Preço limite", `${details.orderPrice}¢`],
    ["Quantidade", details.size]
  ]) {
    const metric = document.createElement("div");
    metric.className = "rule-metric";
    const metricLabel = document.createElement("span");
    metricLabel.textContent = label;
    const metricValue = document.createElement("strong");
    metricValue.textContent = value;
    metric.append(metricLabel, metricValue);
    metrics.append(metric);
  }
  const execution = document.createElement("div");
  execution.textContent = `Status: ${details.stateLabels[details.state] || "Monitorando"}. ${details.message || modeLabel(rule.mode, details.state)}`;
  const policy = document.createElement("div");
  policy.textContent = rule.queuePolicy === "independent"
    ? "Executar ao atingir o gatilho, sem aguardar a fila."
    : "Aguardar a vez na fila para executar.";
  info.append(execution, policy);
  const actions = document.createElement("div");
  actions.className = "more-actions";
  const canMove = !["queued", "processing", "awaiting_fill", "partially_filled", "filled"].includes(details.state);
  if (canMove) {
    const move = document.createElement("button");
    move.type = "button";
    move.textContent = rule.queuePolicy === "independent" ? "Mover para Em Fila" : "Mover para Executar Imediato";
    move.addEventListener("click", async () => {
      more.open = false;
      await moveRuleToLane(rule, rule.queuePolicy === "independent" ? "ordered" : "independent");
    });
    actions.append(move);
  }
  if (canMove) {
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Editar regra";
    edit.addEventListener("click", async () => {
      more.open = false;
      await editRule(rule);
    });
    actions.append(edit);
  }
  popup.append(info, metrics);
  if (actions.childElementCount) popup.append(actions);
  more.append(summary, popup);
  return more;
}

function renderFavorites() {
  favoritesElement.replaceChildren();
  if (favorites.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Salve um modelo usando Favoritar na criação de uma regra.";
    favoritesElement.append(empty);
    return;
  }

  for (const favorite of favorites) {
    const card = document.createElement("article");
    card.className = "template";
    card.draggable = true;
    card.dataset.cardType = "favorite";
    card.dataset.cardId = favorite.id;
    const header = document.createElement("div");
    header.className = "template-header";
    const heading = document.createElement("div");
    heading.className = "template-heading";
    const title = document.createElement("div");
    title.className = "template-title";
    title.textContent = favorite.name;
    heading.append(title);
    const outcome = favorite.outcome === "Down" ? "down" : "up";
    const side = favorite.side === "sell" ? "sell" : "buy";
    const tradeBadge = document.createElement("span");
    tradeBadge.className = `trade-badge ${side} ${outcome}`;
    tradeBadge.title = `${side === "buy" ? "Buy" : "Sell"} ${outcome === "up" ? "Up" : "Down"}`;
    tradeBadge.setAttribute("aria-label", tradeBadge.title);
    const sideLabel = document.createElement("span");
    sideLabel.className = `trade-side ${side}`;
    sideLabel.textContent = side === "buy" ? "BUY" : "SELL";
    const outcomeLabel = document.createElement("span");
    outcomeLabel.className = `trade-outcome ${outcome}`;
    outcomeLabel.textContent = outcome === "up" ? "UP" : "DOWN";
    tradeBadge.append(sideLabel, outcomeLabel);
    heading.prepend(tradeBadge);
    const topActions = document.createElement("div");
    topActions.className = "rule-top-actions";
    const favoriteIcon = document.createElement("span");
    favoriteIcon.className = "action-icon";
    favoriteIcon.textContent = "★";
    favoriteIcon.title = "Modelo favorito";
    topActions.append(favoriteIcon, createFavoriteMore(favorite));
    header.append(heading, topActions);
    card.append(header);
    const meta = document.createElement("div");
    meta.className = "card-meta";
    const trigger = document.createElement("div");
    trigger.className = "card-trigger compact";
    trigger.append(document.createTextNode("Gatilho"));
    const triggerValue = document.createElement("strong");
    triggerValue.textContent = `${Number(favorite.triggerCents ?? favorite.limitCents).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}¢`;
    trigger.append(triggerValue);
    const remove = createCardRemoveButton("Excluir favorito", () => removeFavorite(favorite));
    meta.append(trigger, remove);
    card.append(meta);
    favoritesElement.append(card);
  }
}

function createFavoriteMore(favorite) {
  const more = document.createElement("details");
  more.className = "more";
  const summary = document.createElement("summary");
  summary.textContent = "⋮";
  summary.setAttribute("aria-label", "Mostrar informações e ações do favorito");
  const popup = document.createElement("div");
  popup.className = "more-popup";
  const info = document.createElement("div");
  info.className = "more-info";
  info.textContent = `${favorite.side === "buy" ? "Comprar" : "Vender"} ${favorite.outcome}`;
  const metrics = document.createElement("div");
  metrics.className = "more-metrics";
  for (const [label, value] of [
    ["Gatilho", `${Number(favorite.triggerCents ?? favorite.limitCents)}¢`],
    ["Preço limite", `${Number(favorite.orderLimitCents ?? favorite.limitCents)}¢`],
    ["Quantidade", `${favorite.shares ?? favorite.amount} shares`]
  ]) {
    const metric = document.createElement("div");
    metric.className = "rule-metric";
    const metricLabel = document.createElement("span");
    metricLabel.textContent = label;
    const metricValue = document.createElement("strong");
    metricValue.textContent = value;
    metric.append(metricLabel, metricValue);
    metrics.append(metric);
  }
  const actions = document.createElement("div");
  actions.className = "more-actions";
  const createQueued = document.createElement("button");
  createQueued.type = "button";
  createQueued.className = "use-template";
  createQueued.textContent = "Criar regra em Em Fila";
  createQueued.addEventListener("click", async () => {
    more.open = false;
    await activateFavorite(favorite, "ordered");
  });
  const createImmediate = document.createElement("button");
  createImmediate.type = "button";
  createImmediate.className = "use-template";
  createImmediate.textContent = "Criar regra em Executar Imediato";
  createImmediate.addEventListener("click", async () => {
    more.open = false;
    await activateFavorite(favorite, "independent");
  });
  const use = document.createElement("button");
  use.type = "button";
  use.textContent = "Carregar no formulário";
  use.addEventListener("click", () => useRuleTemplate(favorite));
  const rename = document.createElement("button");
  rename.type = "button";
  rename.textContent = "Renomear favorito";
  rename.addEventListener("click", () => openFavoriteDialog(null, favorite));
  actions.append(createQueued, createImmediate, use, rename);
  popup.append(info, metrics, actions);
  more.append(summary, popup);
  return more;
}

function setupRuleBoard() {
  const board = shadow.querySelector(".board");
  board.addEventListener("dragstart", (event) => {
    const card = event.target instanceof Element ? event.target.closest("[data-card-type]") : null;
    if (!card || !event.dataTransfer) return;
    event.dataTransfer.setData("text/plain", JSON.stringify({ type: card.dataset.cardType, id: card.dataset.cardId }));
    event.dataTransfer.effectAllowed = card.dataset.cardType === "favorite" ? "copy" : "move";
    card.setAttribute("aria-grabbed", "true");
  });
  board.addEventListener("dragend", (event) => {
    const card = event.target instanceof Element ? event.target.closest("[data-card-type]") : null;
    card?.removeAttribute("aria-grabbed");
    board.querySelectorAll(".drag-over").forEach((lane) => lane.classList.remove("drag-over"));
    clearRuleDropIndicators(board);
  });
  board.addEventListener("dragover", (event) => {
    const lane = event.target instanceof Element ? event.target.closest(".board-lane") : null;
    if (!lane) return;
    event.preventDefault();
    lane.classList.add("drag-over");
    clearRuleDropIndicators(board);
    const targetRule = event.target instanceof Element
      ? event.target.closest('.rule[data-card-type="rule"]')
      : null;
    if (lane.dataset.lane === "ordered" && targetRule) {
      const after = event.clientY > targetRule.getBoundingClientRect().top + targetRule.offsetHeight / 2;
      targetRule.classList.add(after ? "drop-after" : "drop-before");
    }
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = lane.dataset.lane === "favorites" ? "none"
        : event.dataTransfer.effectAllowed === "copy" ? "copy" : "move";
    }
  });
  board.addEventListener("dragleave", (event) => {
    const lane = event.target instanceof Element ? event.target.closest(".board-lane") : null;
    if (lane && !lane.contains(event.relatedTarget)) lane.classList.remove("drag-over");
  });
  board.addEventListener("drop", async (event) => {
    const lane = event.target instanceof Element ? event.target.closest(".board-lane") : null;
    if (!lane || !["ordered", "independent"].includes(lane.dataset.lane) || !event.dataTransfer) return;
    event.preventDefault();
    lane.classList.remove("drag-over");
    clearRuleDropIndicators(board);
    const targetCard = event.target instanceof Element
      ? event.target.closest('.rule[data-card-type="rule"]')
      : null;
    const targetRule = lane.dataset.lane === "ordered" && targetCard
      ? rules.find((item) => item.id === targetCard.dataset.cardId)
      : null;
    const insertAfter = Boolean(targetCard
      && event.clientY > targetCard.getBoundingClientRect().top + targetCard.offsetHeight / 2);
    let payload;
    try {
      payload = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch {
      return;
    }
    if (payload.type === "rule") {
      const rule = rules.find((item) => item.id === payload.id);
      if (rule) await moveRuleToLane(rule, lane.dataset.lane, targetRule?.id, insertAfter);
    } else if (payload.type === "favorite") {
      const favorite = favorites.find((item) => item.id === payload.id);
      if (favorite) await activateFavorite(favorite, lane.dataset.lane, targetRule?.id, insertAfter);
    }
  });
}

function clearRuleDropIndicators(board) {
  board.querySelectorAll(".drop-before, .drop-after").forEach((card) => {
    card.classList.remove("drop-before", "drop-after");
  });
}

function placeOrderedRule(nextRules, ruleId, targetRuleId, insertAfter) {
  const orderedRules = nextRules.filter((rule) => rule.queuePolicy !== "independent");
  const sourceIndex = orderedRules.findIndex((rule) => rule.id === ruleId);
  if (sourceIndex < 0 || targetRuleId === ruleId) return nextRules;
  const [rule] = orderedRules.splice(sourceIndex, 1);
  const targetIndex = targetRuleId
    ? orderedRules.findIndex((item) => item.id === targetRuleId)
    : -1;
  const insertionIndex = targetIndex < 0
    ? orderedRules.length
    : targetIndex + (insertAfter ? 1 : 0);
  orderedRules.splice(insertionIndex, 0, rule);
  let orderedIndex = 0;
  return nextRules.map((item) => item.queuePolicy === "independent" ? item : orderedRules[orderedIndex++]);
}

async function moveRuleToLane(rule, queuePolicy, targetRuleId, insertAfter = false) {
  if (["awaiting_fill", "partially_filled", "filled"].includes(executionStates[rule.id]?.status)) {
    showToast("Ordem em acompanhamento", "Não é possível mover uma regra depois que a ordem foi enviada.", "warning");
    return;
  }
  let pending;
  try {
    pending = await hasPendingRuleExecution(rule.id);
  } catch (error) {
    showToast("Não foi possível verificar a regra", error.message || String(error), "error");
    return;
  }
  if (pending) {
    showToast("Regra em execução", "Não é possível mover uma regra enquanto ela está na fila ou em execução em qualquer mercado.", "warning");
    return;
  }
  const previous = rules;
  let nextRules = rules.map((item) => item.id === rule.id && item.queuePolicy !== queuePolicy
    ? { ...item, queuePolicy }
    : item);
  if (queuePolicy === "ordered") {
    nextRules = placeOrderedRule(nextRules, rule.id, targetRuleId, insertAfter);
  }
  if (nextRules.every((item, index) => item === rules[index])) return;
  rules = nextRules;
  try {
    await persistRules();
    renderRules();
    const reordered = rule.queuePolicy === queuePolicy;
    showToast(reordered ? "Posição da regra atualizada" : "Regra movida", queuePolicy === "independent"
      ? "Ela será executada ao atingir o gatilho, sem aguardar a fila."
      : "Ela aguardará sua vez na fila, na posição escolhida.", "success");
  } catch (error) {
    rules = previous;
    renderRules();
    showToast("Não foi possível mover a regra", error.message || String(error), "error");
  }
}

async function activateFavorite(favorite, queuePolicy, targetRuleId, insertAfter = false) {
  if (!activeMarketKey) {
    showToast("Mercado não identificado", "Abra o painel de negociação do mercado em que deseja criar a regra.", "warning");
    return;
  }
  if (favorite.mode === "auto_limit" && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress || "")) {
    showToast("Configure a carteira pública", "Informe seu endereço público na aba Registro antes de ativar esta regra automatizada.", "warning");
    selectView("archive");
    walletInput.focus();
    return;
  }
  const quote = quotes.find((item) => item.outcome === favorite.outcome);
  const rule = {
    marketKey: activeMarketKey,
    marketTitle: quote?.marketTitle || quote?.market || "",
    marketSlug: quote?.marketSlug || "",
    marketRoute: quote?.marketRoute || "",
    outcome: favorite.outcome,
    side: favorite.side,
    trigger: favorite.trigger || "reaches",
    triggerCents: Number(favorite.triggerCents ?? favorite.limitCents),
    orderLimitCents: Number(favorite.orderLimitCents ?? favorite.limitCents),
    shares: favorite.shares === undefined ? Number(favorite.amount) : Number(favorite.shares),
    expiration: favorite.expiration || "never",
    mode: favorite.mode || "notify",
    walletAddress: favorite.mode === "auto_limit" ? walletAddress.toLowerCase() : "",
    queuePolicy,
    id: crypto.randomUUID(),
    enabled: true,
    createdAt: Date.now()
  };
  const previous = rules;
  rules = [...rules, rule];
  if (queuePolicy === "ordered") {
    rules = placeOrderedRule(rules, rule.id, targetRuleId, insertAfter);
  }
  try {
    await persistRules();
    renderRules();
    showToast("Regra criada do favorito", queuePolicy === "independent"
      ? "O modelo continua salvo em Favoritos e a regra foi adicionada a Executar Imediato."
      : "O modelo continua salvo em Favoritos e a regra foi adicionada à fila.", "success");
  } catch (error) {
    rules = previous;
    renderRules();
    showToast("Não foi possível criar a regra", error.message || String(error), "error");
  }
}

async function removeFavorite(favorite) {
  const previous = favorites;
  favorites = favorites.filter((item) => item.id !== favorite.id);
  try {
    await persistFavorites();
    renderRules();
    showToast("Favorito excluído", "As regras da fila não foram alteradas.", "success");
  } catch (error) {
    favorites = previous;
    showToast("Não foi possível excluir", error.message || String(error), "error");
    renderRules();
  }
}

async function editRule(rule) {
  let pending;
  try {
    pending = await hasPendingRuleExecution(rule.id);
  } catch (error) {
    showToast("Não foi possível verificar a regra", error.message || String(error), "error");
    return;
  }
  if (pending) {
    showToast("Regra em execução", "Não é possível editar uma regra que está na fila ou em execução em qualquer mercado.", "warning");
    return;
  }
  resetRuleForm();
  editingRuleId = rule.id;
  form.elements.side.value = rule.side;
  form.elements.trigger.value = rule.trigger || "reaches";
  form.elements.triggerCents.value = String(rule.triggerCents ?? rule.limitCents);
  form.elements.orderLimitCents.value = String(rule.orderLimitCents ?? rule.limitCents);
  quoteSelect.value = quotes.find((quote) => quote.outcome === rule.outcome)?.key || "";
  form.elements.shares.value = rule.shares === undefined ? "" : String(rule.shares);
  form.elements.expiration.value = rule.expiration || "never";
  form.elements.mode.value = rule.mode || "notify";
  form.elements.queuePolicy.value = rule.queuePolicy === "independent" ? "independent" : "ordered";
  renderQuotes();
  updateRuleFormMode();
  showToast("Editando regra", executionStates[rule.id]?.status
    ? "A regra já foi executada; editar não a reativa."
    : "Edite os campos e salve para atualizar a regra.", "success");
  selectView("create");
}

function useRuleTemplate(rule) {
  resetRuleForm();
  quoteSelect.value = quotes.find((quote) => quote.outcome === rule.outcome)?.key
    || quotes.find((quote) => quote.outcome === "Up")?.key
    || quotes[0]?.key
    || "";
  form.elements.side.value = rule.side;
  form.elements.trigger.value = rule.trigger || "reaches";
  form.elements.triggerCents.value = String(rule.triggerCents ?? rule.limitCents);
  form.elements.orderLimitCents.value = String(rule.orderLimitCents ?? rule.limitCents);
  form.elements.shares.value = rule.shares === undefined ? "" : String(rule.shares);
  form.elements.expiration.value = rule.expiration || "never";
  form.elements.mode.value = rule.mode || "notify";
  form.elements.queuePolicy.value = rule.queuePolicy === "independent" ? "independent" : "ordered";
  renderQuotes();
  showToast("Modelo carregado", quotes.some((quote) => quote.outcome === rule.outcome)
    ? "Modelo carregado para o mercado ativo. Salve para criar uma regra."
    : "Abra o painel de negociação de um mercado antes de salvar.", "success");
  panel.classList.add("open");
  backdrop.classList.add("open");
  selectView("create");
}

function modeLabel(mode, executionStatus) {
  if (executionStatus === "queued") return "Na fila — será executada uma vez neste mercado";
  if (executionStatus === "processing") return "Execução em andamento; não será repetida";
  if (executionStatus === "completed") return "Concluída neste mercado — não será repetida aqui";
  if (executionStatus === "clicked") return "Clique em Trade enviado; confira o status";
  if (executionStatus === "failed") return "Falhou; confira antes de criar outra regra";
  if (mode === "auto_limit") return "Automatizar ordem limite (uma tentativa)";
  if (mode === "confirm") return "Avisar (confirmação manual não conectada)";
  return "Somente notificar";
}

function updateOnMutation() {
  if (mutationScanScheduled) {
    return;
  }
  mutationScanScheduled = true;
  window.setTimeout(() => {
    mutationScanScheduled = false;
    scan();
  }, 250);
}
