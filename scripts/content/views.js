function renderQuotes() {
  const selectedQuoteKey = quotes.some((quote) => quote.key === quoteSelect.value)
    ? quoteSelect.value
    : quotes.find((quote) => quote.outcome === "Up")?.key || quotes[0]?.key || "";
  quoteSelect.replaceChildren();
  quoteOptions.replaceChildren();

  const editingRule = editingRuleId && rules.find((rule) => rule.id === editingRuleId);
  if (quotes.length === 0 && !editingRule) {
    quoteSelect.add(new Option("Aguardando preços…", ""));
    quoteOptions.innerHTML = '<p class="empty">Nenhum resultado com preço foi detectado nesta página.</p>';
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
  if (editingRule && !quotes.some((quote) => quote.key === editingRule.quoteKey)) {
    const marketKey = editingRule.quoteKey.slice(0, editingRule.quoteKey.lastIndexOf("|"));
    if (!groupedQuotes.has(marketKey)) {
      groupedQuotes.set(marketKey, { market: editingRule.market, outcomes: new Map() });
    }
    groupedQuotes.get(marketKey).outcomes.set(editingRule.outcome, {
      key: editingRule.quoteKey,
      market: editingRule.market,
      outcome: editingRule.outcome,
      unavailable: true
    });
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
      choice.textContent = quote
        ? `${outcome} ${quote.price.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}¢`
        : outcome;
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

  if (quotes.some((quote) => quote.key === selectedQuoteKey)) {
    quoteSelect.value = selectedQuoteKey;
  } else if (editingRule) {
    quoteSelect.add(new Option(`${editingRule.market} · ${editingRule.outcome} (fora da página atual)`, editingRule.quoteKey));
    quoteSelect.value = editingRule.quoteKey;
  }
}

function renderRules() {
  const queuedRules = rules.filter((rule) => rule.queuePolicy !== "independent");
  const immediateRules = rules.filter((rule) => rule.queuePolicy === "independent");
  renderRuleList(queueRulesElement, queuedRules, "ordered");
  renderRuleList(immediateRulesElement, immediateRules, "independent");
  renderFavorites();
  shadow.querySelector(".rules-count").textContent = String(rules.length);
  shadow.querySelector('[data-lane="ordered"] .lane-count').textContent = String(queuedRules.length);
  shadow.querySelector('[data-lane="independent"] .lane-count').textContent = String(immediateRules.length);
  shadow.querySelector('[data-lane="favorites"] .lane-count').textContent = String(favorites.length);
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
    const state = rule.executionStatus || "monitoring";
    const stateLabels = {
      monitoring: "Monitorando",
      queued: "Na fila",
      processing: "Executando",
      completed: "Concluída",
      clicked: "Trade enviado",
      failed: "Falhou"
    };
    const header = document.createElement("div");
    header.className = "rule-header";
    const heading = document.createElement("div");
    heading.className = "rule-heading";
    const title = document.createElement("div");
    title.className = "rule-title";
    title.textContent = `${rule.side === "buy" ? "Comprar" : "Vender"} ${rule.outcome}`;
    const subtitle = document.createElement("div");
    subtitle.className = "rule-subtitle";
    subtitle.textContent = rule.market;
    heading.append(title, subtitle);
    const topActions = document.createElement("div");
    topActions.className = "rule-top-actions";
    const sideIcon = document.createElement("span");
    sideIcon.className = `action-icon ${rule.side}`;
    sideIcon.textContent = rule.side === "buy" ? "↑" : "↓";
    sideIcon.title = rule.side === "buy" ? "Comprar" : "Vender";
    sideIcon.setAttribute("aria-label", sideIcon.title);
    const modeIcon = document.createElement("span");
    modeIcon.className = `action-icon ${rule.mode || "notify"}`;
    modeIcon.textContent = rule.mode === "auto_limit" ? "⚡" : rule.mode === "confirm" ? "?" : "◉";
    modeIcon.title = rule.mode === "auto_limit" ? "Automatizar ordem limite"
      : rule.mode === "confirm" ? "Avisar e pedir confirmação" : "Somente notificar";
    modeIcon.setAttribute("aria-label", modeIcon.title);
    topActions.append(sideIcon, modeIcon, createRuleMore(rule, { triggerPrice, orderPrice, size, state, stateLabels }));
    header.append(heading, topActions);
    const chip = document.createElement("span");
    chip.className = `state-chip ${state}`;
    chip.textContent = stateLabels[state] || "Monitorando";
    const hint = document.createElement("span");
    hint.className = "rule-drag-hint";
    hint.textContent = "Arraste para mover";
    row.append(header, chip, hint);
    container.append(row);
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
  info.textContent = rule.market;
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
  execution.textContent = rule.executionMessage || modeLabel(rule.mode, rule.executionStatus);
  const policy = document.createElement("div");
  policy.textContent = rule.queuePolicy === "independent"
    ? "Executar ao atingir o gatilho, sem aguardar a fila."
    : "Aguardar a vez na fila para executar.";
  info.append(execution, policy);
  const actions = document.createElement("div");
  actions.className = "more-actions";
  const canMove = rule.executionStatus !== "queued" && rule.executionStatus !== "processing";
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
    edit.addEventListener("click", () => {
      more.open = false;
      editRule(rule);
    });
    actions.append(edit);
  }
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "delete";
  remove.textContent = "Remover regra";
  remove.addEventListener("click", async () => {
    more.open = false;
    const previous = rules;
    rules = rules.filter((item) => item.id !== rule.id);
    try {
      await persistRules();
      renderRules();
      showToast("Regra removida", "A regra foi removida da fila e do histórico.", "success");
    } catch (error) {
      rules = previous;
      showToast("Não foi possível remover", error.message || String(error), "error");
      renderRules();
    }
  });
  actions.append(remove);
  popup.append(info, metrics, actions);
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
    const subtitle = document.createElement("div");
    subtitle.className = "template-subtitle";
    subtitle.textContent = `${favorite.side === "buy" ? "Comprar" : "Vender"} ${favorite.outcome}`;
    heading.append(title, subtitle);
    const topActions = document.createElement("div");
    topActions.className = "rule-top-actions";
    const favoriteIcon = document.createElement("span");
    favoriteIcon.className = "action-icon";
    favoriteIcon.textContent = "★";
    favoriteIcon.title = "Modelo favorito";
    topActions.append(favoriteIcon, createFavoriteMore(favorite));
    header.append(heading, topActions);
    const hint = document.createElement("span");
    hint.className = "rule-drag-hint";
    hint.textContent = "Arraste para criar uma regra";
    card.append(header, hint);
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
  info.textContent = `${favorite.market} · ${favorite.side === "buy" ? "Comprar" : "Vender"} ${favorite.outcome}`;
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
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "delete";
  remove.textContent = "Excluir favorito";
  remove.addEventListener("click", () => removeFavorite(favorite));
  actions.append(createQueued, createImmediate, use, rename, remove);
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
  if (rule.executionStatus === "processing") {
    showToast("Regra em execução", "Não é possível mover uma regra enquanto a execução está em andamento.", "warning");
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
  const rule = {
    market: favorite.market,
    quoteKey: favorite.quoteKey,
    outcome: favorite.outcome,
    side: favorite.side,
    trigger: favorite.trigger || "reaches",
    triggerCents: Number(favorite.triggerCents ?? favorite.limitCents),
    orderLimitCents: Number(favorite.orderLimitCents ?? favorite.limitCents),
    shares: favorite.shares === undefined ? Number(favorite.amount) : Number(favorite.shares),
    expiration: favorite.expiration || "never",
    mode: favorite.mode || "notify",
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

function editRule(rule) {
  if (rule.executionStatus === "queued" || rule.executionStatus === "processing") {
    showToast("Regra em execução", "Não é possível editar uma regra que está na fila ou em execução.", "warning");
    return;
  }
  resetRuleForm();
  editingRuleId = rule.id;
  form.elements.side.value = rule.side;
  form.elements.trigger.value = rule.trigger || "reaches";
  form.elements.triggerCents.value = String(rule.triggerCents ?? rule.limitCents);
  form.elements.orderLimitCents.value = String(rule.orderLimitCents ?? rule.limitCents);
  form.elements.shares.value = rule.shares === undefined ? "" : String(rule.shares);
  form.elements.expiration.value = rule.expiration || "never";
  form.elements.mode.value = rule.mode || "notify";
  form.elements.queuePolicy.value = rule.queuePolicy === "independent" ? "independent" : "ordered";
  renderQuotes();
  updateRuleFormMode();
  showToast("Editando regra", rule.executionStatus
    ? "A regra já foi executada; editar não a reativa."
    : "Edite os campos e salve para atualizar a regra.", "success");
  selectView("create");
}

function useRuleTemplate(rule) {
  resetRuleForm();
  if (quotes.some((quote) => quote.key === rule.quoteKey)) {
    quoteSelect.value = rule.quoteKey;
  } else if (quotes.length) {
    quoteSelect.value = quotes[0].key;
  }
  form.elements.side.value = rule.side;
  form.elements.trigger.value = rule.trigger || "reaches";
  form.elements.triggerCents.value = String(rule.triggerCents ?? rule.limitCents);
  form.elements.orderLimitCents.value = String(rule.orderLimitCents ?? rule.limitCents);
  form.elements.shares.value = rule.shares === undefined ? "" : String(rule.shares);
  form.elements.expiration.value = rule.expiration || "never";
  form.elements.mode.value = rule.mode || "notify";
  form.elements.queuePolicy.value = rule.queuePolicy === "independent" ? "independent" : "ordered";
  renderQuotes();
  showToast("Modelo carregado", quotes.some((quote) => quote.key === rule.quoteKey)
    ? "Modelo carregado. Salve para criar uma nova regra."
    : "Selecione o mercado atual antes de salvar.", "success");
  panel.classList.add("open");
  backdrop.classList.add("open");
  selectView("create");
}

function modeLabel(mode, executionStatus) {
  if (executionStatus === "queued") return "Na fila — será executada uma única vez";
  if (executionStatus === "processing") return "Execução em andamento; não será repetida";
  if (executionStatus === "completed") return "Concluída — não será executada novamente";
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
