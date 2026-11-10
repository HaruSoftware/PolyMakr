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
  renderRuleList(rulesElement, rules);
  renderFavorites();
  shadow.querySelector(".rules-count").textContent = String(rules.length);
  shadow.querySelector(".favorites-count").textContent = String(favorites.length);
}

function renderRuleList(container, list) {
  container.replaceChildren();
  if (list.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Sua fila está vazia. Crie uma regra para acompanhar um preço.";
    container.append(empty);
    return;
  }

  for (const rule of list) {
    const row = document.createElement("div");
    row.className = "rule";
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
    const title = document.createElement("div");
    title.className = "rule-title";
    title.textContent = `${rule.side === "buy" ? "Comprar" : "Vender"} ${rule.outcome}`;
    const subtitle = document.createElement("div");
    subtitle.className = "rule-subtitle";
    subtitle.textContent = rule.market;
    heading.append(title, subtitle);
    const chip = document.createElement("span");
    chip.className = `state-chip ${state}`;
    chip.textContent = stateLabels[state] || "Monitorando";
    header.append(heading, chip);

    const metrics = document.createElement("div");
    metrics.className = "rule-metrics";
    for (const [label, value] of [
      ["Gatilho", `${triggerPrice}¢`],
      ["Limite", `${orderPrice}¢`],
      ["Quantidade", size]
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
    const mode = document.createElement("div");
    mode.className = "rule-mode";
    mode.textContent = rule.executionMessage || modeLabel(rule.mode, rule.executionStatus);
    const queuePolicy = document.createElement("div");
    queuePolicy.className = "rule-mode";
    queuePolicy.textContent = rule.queuePolicy === "independent"
      ? "Execução independente: pode passar à frente da fila"
      : "Execução em ordem: aguarda as regras anteriores";
    const actions = document.createElement("div");
    actions.className = "rule-actions";
    if (rule.executionStatus !== "queued" && rule.executionStatus !== "processing") {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Editar";
      edit.addEventListener("click", () => editRule(rule));
      actions.append(edit);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete";
    remove.textContent = "Remover da fila";
    remove.addEventListener("click", async () => {
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
    row.append(header, metrics, mode, queuePolicy, actions);
    container.append(row);
  }
}

function renderFavorites() {
  favoritesElement.replaceChildren();
  if (favorites.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Nenhum modelo salvo. Use o botão Favoritar na criação para guardar um modelo.";
    favoritesElement.append(empty);
    return;
  }

  for (const favorite of favorites) {
    const card = document.createElement("article");
    card.className = "template";
    const header = document.createElement("div");
    header.className = "template-header";
    const heading = document.createElement("div");
    const title = document.createElement("div");
    title.className = "template-title";
    title.textContent = favorite.name;
    const subtitle = document.createElement("div");
    subtitle.className = "template-subtitle";
    subtitle.textContent = `${favorite.market} · ${favorite.side === "buy" ? "Comprar" : "Vender"} ${favorite.outcome}`;
    heading.append(title, subtitle);
    header.append(heading);
    const details = document.createElement("div");
    details.className = "rule-metrics";
    for (const [label, value] of [
      ["Gatilho", `${Number(favorite.triggerCents ?? favorite.limitCents)}¢`],
      ["Limite", `${Number(favorite.orderLimitCents ?? favorite.limitCents)}¢`],
      ["Quantidade", `${favorite.shares ?? favorite.amount} shares`]
    ]) {
      const metric = document.createElement("div");
      metric.className = "rule-metric";
      const metricLabel = document.createElement("span");
      metricLabel.textContent = label;
      const metricValue = document.createElement("strong");
      metricValue.textContent = value;
      metric.append(metricLabel, metricValue);
      details.append(metric);
    }
    const actions = document.createElement("div");
    actions.className = "template-actions";
    const use = document.createElement("button");
    use.type = "button";
    use.className = "use-template";
    use.textContent = "Usar modelo";
    use.addEventListener("click", () => useRuleTemplate(favorite));
    const rename = document.createElement("button");
    rename.type = "button";
    rename.textContent = "Renomear";
    rename.addEventListener("click", () => openFavoriteDialog(null, favorite));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete";
    remove.textContent = "Excluir favorito";
    remove.addEventListener("click", () => removeFavorite(favorite));
    actions.append(use, rename, remove);
    card.append(header, details, actions);
    favoritesElement.append(card);
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
