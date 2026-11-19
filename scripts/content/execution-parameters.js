const EXECUTION_PARAMETERS_KEY = "polymakr.executionParameters";
const EXECUTION_PARAMETER_FAVORITES_KEY = "polymakr.executionParameterFavorites";
const executionParameterTypes = new Map();
let executionParameters = [];
let executionParameterFavorites = [];
let editingExecutionParameterId = null;
let editingExecutionParameterFavoriteId = null;
let selectedExecutionParameterType = "market_time";

function registerExecutionParameterType(type, definition) {
  if (typeof type !== "string" || !type || !definition
    || typeof definition.normalize !== "function"
    || typeof definition.defaultName !== "function"
    || typeof definition.describe !== "function"
    || typeof definition.evaluate !== "function"
    || typeof definition.readFields !== "function"
    || typeof definition.renderFields !== "function"
    || typeof definition.label !== "string"
    || typeof definition.icon !== "string"
    || executionParameterTypes.has(type)) {
    throw new Error(`O tipo de parâmetro "${type}" não pôde ser registrado.`);
  }
  executionParameterTypes.set(type, definition);
}

function executionParameterType(parameter) {
  return executionParameterTypes.get(parameter.type || "market_time");
}

function setupExecutionParameterUI() {
  const form = shadow.querySelector(".execution-parameter-form");
  form.addEventListener("submit", saveExecutionParameterFromForm);
  form.querySelector(".execution-parameter-cancel").addEventListener("click", () => {
    resetExecutionParameterForm();
    selectView("rules");
  });
  renderExecutionParameterTypeOptions();
  renderExecutionParameterTypeFields();
  setupExecutionParameterBoard();
  renderExecutionParameters();
}

function createExecutionParameterTypeIcon(type) {
  const definition = executionParameterTypes.get(type);
  const icon = document.createElement("span");
  icon.className = `action-icon execution-parameter-type-icon ${type}`;
  icon.setAttribute("aria-hidden", "true");
  if (definition?.icon === "clock") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("focusable", "false");
    const face = document.createElementNS(svg.namespaceURI, "circle");
    face.setAttribute("cx", "8");
    face.setAttribute("cy", "8");
    face.setAttribute("r", "5.5");
    const hands = document.createElementNS(svg.namespaceURI, "path");
    hands.setAttribute("d", "M8 4.5V8l2.5 1.5");
    svg.append(face, hands);
    icon.append(svg);
  } else if (definition?.icon === "dollar") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("focusable", "false");
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", "M8 2v12M5.5 11c0 1.1.9 2 2.5 2s2.5-.9 2.5-2-1-1.6-2.5-2-2.5-.9-2.5-2 .9-2 2.5-2 2.5.9 2.5 2");
    svg.append(path);
    icon.append(svg);
  } else {
    icon.textContent = definition?.icon || "?";
  }
  return icon;
}

function createEffectIcon(effect) {
  const icon = document.createElement("span");
  icon.className = "action-icon execution-parameter-effect-icon";
  icon.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("focusable", "false");
  if (effect === "block_buy") {
    // Lock + seta para cima (buy)
    const lock = document.createElementNS(svg.namespaceURI, "rect");
    lock.setAttribute("x", "4"); lock.setAttribute("y", "7");
    lock.setAttribute("width", "8"); lock.setAttribute("height", "7");
    lock.setAttribute("rx", "1.5");
    const shackle = document.createElementNS(svg.namespaceURI, "path");
    shackle.setAttribute("d", "M5.5 7V5a2.5 2.5 0 0 1 5 0v2");
    const arrow = document.createElementNS(svg.namespaceURI, "path");
    arrow.setAttribute("d", "M8 11.5V9.5m0 0-1 1m1-1 1 1");
    svg.append(lock, shackle, arrow);
    icon.title = "Bloquear Compras";
    icon.className += " block-buy";
  } else if (effect === "block_sell") {
    // Lock + seta para baixo (sell)
    const lock = document.createElementNS(svg.namespaceURI, "rect");
    lock.setAttribute("x", "4"); lock.setAttribute("y", "7");
    lock.setAttribute("width", "8"); lock.setAttribute("height", "7");
    lock.setAttribute("rx", "1.5");
    const shackle = document.createElementNS(svg.namespaceURI, "path");
    shackle.setAttribute("d", "M5.5 7V5a2.5 2.5 0 0 1 5 0v2");
    const arrow = document.createElementNS(svg.namespaceURI, "path");
    arrow.setAttribute("d", "M8 9.5v2m0 0-1-1m1 1 1-1");
    svg.append(lock, shackle, arrow);
    icon.title = "Bloquear Vendas";
    icon.className += " block-sell";
  } else {
    // Lock padrão (block_both / block)
    const lock = document.createElementNS(svg.namespaceURI, "rect");
    lock.setAttribute("x", "3.5"); lock.setAttribute("y", "7");
    lock.setAttribute("width", "9"); lock.setAttribute("height", "7");
    lock.setAttribute("rx", "1.5");
    const shackle = document.createElementNS(svg.namespaceURI, "path");
    shackle.setAttribute("d", "M5.5 7V5a2.5 2.5 0 0 1 5 0v2");
    const dot = document.createElementNS(svg.namespaceURI, "circle");
    dot.setAttribute("cx", "8"); dot.setAttribute("cy", "10.5"); dot.setAttribute("r", "1");
    svg.append(lock, shackle, dot);
    icon.title = effect === "block_both" ? "Bloquear Compras e Vendas" : "Bloquear";
    icon.className += " block-both";
  }
  icon.append(svg);
  return icon;
}

function renderExecutionParameterTypeOptions() {
  const container = shadow.querySelector(".execution-parameter-type-options");
  if (!container) return;
  container.replaceChildren();
  for (const [type, definition] of executionParameterTypes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "execution-parameter-type-option";
    button.setAttribute("aria-pressed", String(selectedExecutionParameterType === type));
    button.disabled = Boolean(editingExecutionParameterId || editingExecutionParameterFavoriteId);
    button.addEventListener("click", () => {
      if (editingExecutionParameterId || editingExecutionParameterFavoriteId) return;
      selectedExecutionParameterType = type;
      shadow.querySelector(".execution-parameter-form").elements.namedItem("type").value = type;
      renderExecutionParameterTypeOptions();
      renderExecutionParameterTypeFields();
    });

    const text = document.createElement("span");
    text.className = "execution-parameter-type-copy";
    const title = document.createElement("strong");
    title.textContent = definition.label;
    text.append(title);
    if (definition.helpText) {
      const help = document.createElement("small");
      help.textContent = definition.helpText;
      text.append(help);
    }
    button.append(createExecutionParameterTypeIcon(type), text);
    container.append(button);
  }
}

function renderExecutionParameterTypeFields(parameter = null) {
  const container = shadow.querySelector(".execution-parameter-type-fields");
  const definition = executionParameterTypes.get(selectedExecutionParameterType);
  if (!container || !definition) return;
  container.replaceChildren();
  definition.renderFields(container, parameter);
}

function normalizeExecutionParameter(parameter) {
  if (!parameter || typeof parameter !== "object") return null;
  const type = typeof parameter.type === "string" && parameter.type ? parameter.type : "market_time";
  const definition = executionParameterTypes.get(type);
  const validEffects = ["block", "block_buy", "block_sell", "block_both"];
  // Migração: "allow" era uma opção antiga — descartar silenciosamente
  if (!validEffects.includes(parameter.effect)) return null;
  if (!definition) {
    return {
      ...parameter,
      type,
      id: typeof parameter.id === "string" && parameter.id ? parameter.id : crypto.randomUUID(),
      name: typeof parameter.name === "string" && parameter.name.trim()
        ? parameter.name.trim().slice(0, 60)
        : `Parâmetro indisponível (${type})`,
      effect: parameter.effect,
      createdAt: Number.isFinite(Number(parameter.createdAt)) ? Number(parameter.createdAt) : Date.now()
    };
  }
  const normalized = definition.normalize(parameter);
  if (!normalized) return null;
  return {
    ...normalized,
    type,
    id: typeof parameter.id === "string" && parameter.id ? parameter.id : crypto.randomUUID(),
    name: typeof parameter.name === "string" && parameter.name.trim()
      ? parameter.name.trim().slice(0, 60)
      : definition.defaultName(normalized, parameter.effect),
    effect: parameter.effect,
    createdAt: Number.isFinite(Number(parameter.createdAt)) ? Number(parameter.createdAt) : Date.now()
  };
}

function normalizeExecutionParameters(parameters) {
  return Array.isArray(parameters)
    ? parameters.map(normalizeExecutionParameter).filter(Boolean)
    : [];
}

function executionParameterDescription(parameter) {
  const definition = executionParameterType(parameter);
  return definition
    ? definition.describe(parameter)
    : "Tipo de parâmetro indisponível.";
}

function compactExecutionParameterValue(parameter) {
  const type = parameter.type || "market_time";
  if (type === "market_time") return `${parameter.seconds}s`;
  if (type === "value_difference") {
    const value = new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 4
    }).format(parameter.threshold);
    return `${value}${parameter.unit === "percentage" ? "%" : "$"}`;
  }
  return parameter.name;
}

function currentExecutionParameterValue(parameter, result) {
  const type = parameter.type || "market_time";
  if (type === "market_time" && Number.isFinite(result.remainingSeconds)) {
    return `${result.remainingSeconds}s`;
  }
  if (type === "value_difference" && result.state !== "unknown" && result.detail) {
    return result.detail;
  }
  return "—";
}

function executionParameterStatus(parameter) {
  if (!["block", "block_buy", "block_sell", "block_both"].includes(parameter.effect)) {
    return { state: "released", label: "Liberado", title: "Este parâmetro não bloqueia regras." };
  }
  const definition = executionParameterType(parameter);
  return definition
    ? definition.evaluate(parameter)
    : { state: "unknown", label: "Indisponível", title: "O tipo deste parâmetro não está carregado." };
}

async function refreshExecutionParameterData() {
  const types = new Set(executionParameters
    .filter((parameter) => ["block", "block_buy", "block_sell", "block_both"].includes(parameter.effect))
    .map((parameter) => parameter.type || "market_time"));
  await Promise.all([...types].map((type) =>
    executionParameterTypes.get(type)?.refresh?.()
  ));
}

function resetExecutionParameterData(marketKey) {
  for (const definition of executionParameterTypes.values()) {
    definition.marketChanged?.(marketKey);
  }
}

async function getExecutionParameterDecision(rule) {
  if (rule.honorExecutionParameters !== true) return { blocked: false };
  const blockingParameters = executionParameters.filter((parameter) =>
    ["block", "block_buy", "block_sell", "block_both"].includes(parameter.effect)
  );
  if (!blockingParameters.length) return { blocked: false };

  const unavailable = [];
  for (const parameter of blockingParameters) {
    const type = parameter.type || "market_time";
    const definition = executionParameterTypes.get(type);
    if (!definition) {
      unavailable.push(`O tipo de parâmetro "${type}" não está disponível.`);
      continue;
    }
    // Verificar se este parâmetro se aplica ao lado da regra
    const appliesToRule = doesParameterApplyToRule(parameter, rule);
    if (!appliesToRule) continue;
    if (definition.refresh) await definition.refresh();
    const evaluation = definition.evaluate(parameter, rule);
    if (evaluation.state === "blocking") {
      return { blocked: true, parameter, ...evaluation };
    }
    if (evaluation.state === "unknown") {
      unavailable.push(evaluation.error || evaluation.title || "Os dados do parâmetro estão indisponíveis.");
    }
  }
  return unavailable.length
    ? { blocked: true, error: [...new Set(unavailable)].join(" ") }
    : { blocked: false };
}

function doesParameterApplyToRule(parameter, rule) {
  const effect = parameter.effect;
  if (effect === "block" || effect === "block_both") return true;
  if (effect === "block_buy") return rule?.side === "buy";
  if (effect === "block_sell") return rule?.side === "sell";
  return true;
}

function createExecutionParameterBlockedError(decision) {
  const message = executionParameterDecisionMessage(decision);
  const error = new Error(message);
  error.name = "ExecutionParameterBlockedError";
  return error;
}

function executionParameterDecisionMessage(decision) {
  if (decision.error) {
    return `Bloqueada: não foi possível verificar os parâmetros. ${decision.error}`;
  }
  const detail = Number.isFinite(decision.remainingSeconds)
    ? `${decision.remainingSeconds}s restantes`
    : decision.detail || "";
  return `Bloqueada pelo parâmetro "${decision.parameter.name}"${detail ? ` (${detail})` : ""}.`;
}

function renderExecutionParameters() {
  const activeContainer = shadow.querySelector(".execution-parameters-active");
  const favoritesContainer = shadow.querySelector(".execution-parameters-favorites");
  if (!activeContainer || !favoritesContainer) return;
  activeContainer.replaceChildren();
  favoritesContainer.replaceChildren();

  if (!executionParameters.length) {
    const empty = document.createElement("p");
    empty.className = "empty execution-parameter-empty";
    empty.textContent = "Crie um parâmetro ou arraste um favorito para cá.";
    activeContainer.append(empty);
  } else {
    for (const parameter of executionParameters) {
      activeContainer.append(createExecutionParameterCard(parameter, false));
    }
  }

  if (!executionParameterFavorites.length) {
    const empty = document.createElement("p");
    empty.className = "empty execution-parameter-empty";
    empty.textContent = "Parâmetros salvos como favoritos aparecerão aqui.";
    favoritesContainer.append(empty);
  } else {
    for (const parameter of executionParameterFavorites) {
      favoritesContainer.append(createExecutionParameterCard(parameter, true));
    }
  }

  shadow.querySelector(".execution-parameters-active-count").textContent = String(executionParameters.length);
  shadow.querySelector(".execution-parameters-favorites-count").textContent = String(executionParameterFavorites.length);
  renderExecutionParameterStatuses();
}

function renderExecutionParameterStatuses() {
  const activeContainer = shadow.querySelector(".execution-parameters-active");
  if (!activeContainer) return;
  for (const card of activeContainer.querySelectorAll('[data-execution-parameter-type="active"]')) {
    const parameter = executionParameters.find((item) => item.id === card.dataset.executionParameterId);
    const dot = card.querySelector(".execution-parameter-dot");
    if (!parameter || !dot) continue;
    const result = executionParameterStatus(parameter);
    const value = card.querySelector(".execution-parameter-name");
    if (value) value.textContent = currentExecutionParameterValue(parameter, result);
    dot.className = `execution-parameter-dot ${result.state}`;
    dot.setAttribute("aria-label", result.label);
    dot.title = result.title;
    if (value) value.title = result.title || `${parameter.name} · ${executionParameterDescription(parameter)}`;
  }
  renderExecutionParameterSummary();
}

function renderExecutionParameterSummary() {
  const status = shadow.querySelector(".execution-parameter-status");
  if (!status) return;
  const summaries = [];
  for (const [type, definition] of executionParameterTypes) {
    const parameters = executionParameters.filter((parameter) =>
      (parameter.type || "market_time") === type
    );
    const summary = definition.summarize?.(parameters);
    if (summary) summaries.push(summary);
  }
  const unavailableTypes = [...new Set(executionParameters
    .filter((parameter) => ["block", "block_buy", "block_sell", "block_both"].includes(parameter.effect)
      && !executionParameterTypes.has(parameter.type || "market_time"))
    .map((parameter) => parameter.type || "market_time"))];
  if (unavailableTypes.length) {
    summaries.push({
      text: "Tipo de parâmetro indisponível · regras opt-in bloqueadas",
      title: `Módulo não carregado: ${unavailableTypes.join(", ")}`,
      error: true
    });
  }
  status.textContent = summaries.length
    ? summaries.map((summary) => summary.text).join(" · ")
    : activeMarketKey ? "Sem bloqueios ativos" : "Abra um mercado";
  status.title = summaries.map((summary) => summary.title).filter(Boolean).join("\n");
  status.classList.toggle("error", summaries.some((summary) => summary.error));
}

function createExecutionParameterCard(parameter, isFavorite) {
  const card = document.createElement("article");
  card.className = "execution-parameter-card";
  card.draggable = true;
  card.dataset.executionParameterType = isFavorite ? "favorite" : "active";
  card.dataset.executionParameterId = parameter.id;

  const identity = document.createElement("div");
  identity.className = "execution-parameter-identity";
  const name = document.createElement("strong");
  name.className = "execution-parameter-name";
  const result = !isFavorite ? executionParameterStatus(parameter) : null;
  const value = isFavorite
    ? compactExecutionParameterValue(parameter)
    : currentExecutionParameterValue(parameter, result);
  name.textContent = isFavorite && ["<=", ">="].includes(parameter.comparison)
    ? `${parameter.comparison} ${value}`
    : value;
  name.title = `${parameter.name} · ${executionParameterDescription(parameter)}`;
  identity.append(name);

  const effectIcon = createEffectIcon(parameter.effect || "block");
  effectIcon.className += " execution-parameter-effect-badge";
  effectIcon.setAttribute("aria-label", effectIcon.title);

  const status = document.createElement("span");
  if (!isFavorite) {
    status.className = `execution-parameter-dot ${result.state}`;
    status.setAttribute("aria-label", result.label);
    status.title = result.title;
  }

  const actions = document.createElement("div");
  actions.className = "execution-parameter-actions";
  if (isFavorite) {
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "+";
    add.title = "Adicionar";
    add.setAttribute("aria-label", `Adicionar ${parameter.name} aos parâmetros ativos`);
    add.addEventListener("click", () => activateExecutionParameterFavorite(parameter));
    actions.append(add);
  }
  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "✎";
  edit.title = "Editar";
  edit.setAttribute("aria-label", `Editar ${parameter.name}`);
  edit.addEventListener("click", () => editExecutionParameter(parameter, isFavorite));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "danger";
  remove.textContent = "×";
  remove.title = "Excluir";
  remove.setAttribute("aria-label", `Excluir ${parameter.name}`);
  remove.addEventListener("click", () => removeExecutionParameter(parameter, isFavorite));
  actions.append(edit, remove);

  card.append(identity);
  if (!isFavorite) card.append(effectIcon, status);
  card.append(actions);
  return card;
}

function setupExecutionParameterBoard() {
  const active = shadow.querySelector(".execution-parameters-active");
  const favorites = shadow.querySelector(".execution-parameters-favorites");
  for (const container of [active, favorites]) {
    container.addEventListener("dragstart", (event) => {
      const card = event.target instanceof Element
        ? event.target.closest("[data-execution-parameter-type]")
        : null;
      if (!card || !event.dataTransfer) return;
      const isFavorite = card.dataset.executionParameterType === "favorite";
      event.dataTransfer.setData("text/plain", JSON.stringify({
        type: isFavorite ? "execution-parameter-favorite" : "execution-parameter",
        id: card.dataset.executionParameterId
      }));
      event.dataTransfer.effectAllowed = isFavorite ? "copy" : "move";
      card.setAttribute("aria-grabbed", "true");
    });
    container.addEventListener("dragend", (event) => {
      const card = event.target instanceof Element
        ? event.target.closest("[data-execution-parameter-type]")
        : null;
      card?.removeAttribute("aria-grabbed");
      active.classList.remove("drag-over");
      favorites.classList.remove("drag-over");
    });
    container.addEventListener("dragover", (event) => {
      if (container !== active) return;
      event.preventDefault();
      active.classList.add("drag-over");
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed === "copy" ? "copy" : "move";
      }
    });
    container.addEventListener("dragleave", (event) => {
      if (!container.contains(event.relatedTarget)) container.classList.remove("drag-over");
    });
  }

  active.addEventListener("drop", async (event) => {
    event.preventDefault();
    active.classList.remove("drag-over");
    if (!event.dataTransfer) return;
    let payload;
    try {
      payload = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch {
      return;
    }
    const targetCard = event.target instanceof Element
      ? event.target.closest('[data-execution-parameter-type="active"]')
      : null;
    const targetIndex = targetCard
      ? executionParameters.findIndex((parameter) => parameter.id === targetCard.dataset.executionParameterId)
      : executionParameters.length;
    const afterTarget = targetCard
      && event.clientX > targetCard.getBoundingClientRect().left + targetCard.offsetWidth / 2;
    if (payload.type === "execution-parameter-favorite") {
      const favorite = executionParameterFavorites.find((parameter) => parameter.id === payload.id);
      if (favorite) await activateExecutionParameterFavorite(favorite, targetIndex + Number(Boolean(afterTarget)));
    } else if (payload.type === "execution-parameter") {
      await moveExecutionParameter(payload.id, targetIndex + Number(Boolean(afterTarget)));
    }
  });
}

function readExecutionParameterForm() {
  const form = shadow.querySelector(".execution-parameter-form");
  const data = new FormData(form);
  const effect = data.get("effect");
  const type = data.get("type") || "market_time";
  const definition = executionParameterTypes.get(type);
  if (!definition || !["block", "block_buy", "block_sell", "block_both"].includes(effect)) {
    showToast("Confira o parâmetro", "Escolha um tipo e uma ação válidos.", "error");
    return null;
  }
  const parameter = normalizeExecutionParameter({
    id: editingExecutionParameterId || editingExecutionParameterFavoriteId || crypto.randomUUID(),
    type,
    name: data.get("name"),
    ...definition.readFields(data),
    effect,
    createdAt: Date.now()
  });
  if (!parameter) {
    showToast("Confira o parâmetro", "Os valores informados não são válidos para este tipo de parâmetro.", "error");
  }
  return parameter;
}

async function saveExecutionParameterFromForm(event) {
  event.preventDefault();
  const parameter = readExecutionParameterForm();
  if (!parameter) return;
  const previousParameters = executionParameters;
  const previousFavorites = executionParameterFavorites;
  const action = event.submitter?.value;

  if (editingExecutionParameterId) {
    executionParameters = executionParameters.map((item) =>
      item.id === editingExecutionParameterId ? { ...parameter, id: item.id, createdAt: item.createdAt } : item
    );
  } else if (editingExecutionParameterFavoriteId) {
    executionParameterFavorites = executionParameterFavorites.map((item) =>
      item.id === editingExecutionParameterFavoriteId ? { ...parameter, id: item.id, createdAt: item.createdAt } : item
    );
  } else if (action === "favorite") {
    executionParameterFavorites = [...executionParameterFavorites, parameter];
  } else {
    executionParameters = [...executionParameters, parameter];
  }

  if (await persistExecutionParameterLists(previousParameters, previousFavorites)) {
    const wasEditing = Boolean(editingExecutionParameterId || editingExecutionParameterFavoriteId);
    resetExecutionParameterForm();
    showToast(wasEditing ? "Parâmetro atualizado" : action === "favorite" ? "Favorito salvo" : "Parâmetro adicionado",
      wasEditing ? "As alterações foram salvas." : action === "favorite"
        ? "O modelo está disponível em Favoritos na aba Regras."
        : "O parâmetro já está sendo aplicado às regras que o respeitam.",
      "success");
  }
}

async function persistExecutionParameterLists(previousParameters, previousFavorites) {
  try {
    await navigator.locks.request("polymakr-execution-parameters-storage", async () => {
      await chrome.storage.local.set({
        [EXECUTION_PARAMETERS_KEY]: executionParameters.map((parameter) => ({ ...parameter })),
        [EXECUTION_PARAMETER_FAVORITES_KEY]: executionParameterFavorites.map((parameter) => ({ ...parameter }))
      });
    });
    renderExecutionParameters();
    return true;
  } catch (error) {
    executionParameters = previousParameters;
    executionParameterFavorites = previousFavorites;
    renderExecutionParameters();
    showToast("Não foi possível salvar os parâmetros", error.message || String(error), "error");
    return false;
  }
}

function resetExecutionParameterForm() {
  const form = shadow.querySelector(".execution-parameter-form");
  editingExecutionParameterId = null;
  editingExecutionParameterFavoriteId = null;
  selectedExecutionParameterType = "market_time";
  form.reset();
  form.elements.namedItem("type").value = selectedExecutionParameterType;
  renderExecutionParameterTypeOptions();
  renderExecutionParameterTypeFields();
  updateExecutionParameterFormMode();
}

function updateExecutionParameterFormMode() {
  const form = shadow.querySelector(".execution-parameter-form");
  const editing = Boolean(editingExecutionParameterId || editingExecutionParameterFavoriteId);
  const favoriteButton = form.querySelector('[value="favorite"]');
  const saveButton = form.querySelector('[value="active"]');
  const title = shadow.querySelector(".execution-parameter-form-heading");
  if (editingExecutionParameterId) {
    title.textContent = "Editar parâmetro ativo";
    saveButton.textContent = "Salvar alterações";
    favoriteButton.hidden = true;
  } else if (editingExecutionParameterFavoriteId) {
    title.textContent = "Editar favorito";
    saveButton.textContent = "Salvar favorito";
    favoriteButton.hidden = true;
  } else {
    title.textContent = "Criar parâmetro";
    saveButton.textContent = "Adicionar aos parâmetros";
    favoriteButton.hidden = false;
  }
  form.querySelector(".execution-parameter-cancel").hidden = !editing;
}

function editExecutionParameter(parameter, isFavorite) {
  const type = parameter.type || "market_time";
  if (!executionParameterTypes.has(type)) {
    showToast("Tipo de parâmetro indisponível", "Este parâmetro será preservado até o módulo que o define estar disponível.", "warning");
    return;
  }
  resetExecutionParameterForm();
  if (isFavorite) editingExecutionParameterFavoriteId = parameter.id;
  else editingExecutionParameterId = parameter.id;
  selectedExecutionParameterType = type;
  const form = shadow.querySelector(".execution-parameter-form");
  const definition = executionParameterTypes.get(type);
  const hasGeneratedName = [parameter.comparison, "<=", ">="]
    .filter((comparison, index, comparisons) => comparisons.indexOf(comparison) === index)
    .some((comparison) =>
      ["block", "block_buy", "block_sell", "block_both"].some((effect) =>
        definition.defaultName({ ...parameter, comparison }, effect) === parameter.name
      )
    );
  form.elements.namedItem("name").value = hasGeneratedName ? "" : parameter.name;
  form.elements.namedItem("type").value = type;
  renderExecutionParameterTypeOptions();
  renderExecutionParameterTypeFields(parameter);
  form.elements.effect.value = parameter.effect || "block_both";
  updateExecutionParameterFormMode();
  selectView("parameters");
  form.elements.name.focus();
}

async function removeExecutionParameter(parameter, isFavorite) {
  const previousParameters = executionParameters;
  const previousFavorites = executionParameterFavorites;
  if (isFavorite) {
    executionParameterFavorites = executionParameterFavorites.filter((item) => item.id !== parameter.id);
  } else {
    executionParameters = executionParameters.filter((item) => item.id !== parameter.id);
  }
  if (await persistExecutionParameterLists(previousParameters, previousFavorites)) {
    showToast(isFavorite ? "Favorito excluído" : "Parâmetro removido",
      isFavorite ? "Os parâmetros ativos não foram alterados." : "As regras já bloqueadas serão reavaliadas.",
      "success");
  }
}

async function activateExecutionParameterFavorite(favorite, insertionIndex = executionParameters.length) {
  const previousParameters = executionParameters;
  const previousFavorites = executionParameterFavorites;
  const activeParameter = {
    ...favorite,
    id: crypto.randomUUID(),
    createdAt: Date.now()
  };
  const next = [...executionParameters];
  next.splice(Math.max(0, Math.min(insertionIndex, next.length)), 0, activeParameter);
  executionParameters = next;
  if (await persistExecutionParameterLists(previousParameters, previousFavorites)) {
    showToast("Parâmetro ativado", `${favorite.name} está sendo aplicado às regras opt-in.`, "success");
  }
}

async function moveExecutionParameter(parameterId, insertionIndex) {
  const sourceIndex = executionParameters.findIndex((parameter) => parameter.id === parameterId);
  if (sourceIndex < 0) return;
  const previousParameters = executionParameters;
  const previousFavorites = executionParameterFavorites;
  const next = [...executionParameters];
  const [parameter] = next.splice(sourceIndex, 1);
  const targetIndex = Math.max(0, Math.min(insertionIndex, next.length));
  next.splice(targetIndex > sourceIndex ? targetIndex - 1 : targetIndex, 0, parameter);
  if (next.every((item, index) => item === executionParameters[index])) return;
  executionParameters = next;
  await persistExecutionParameterLists(previousParameters, previousFavorites);
}
