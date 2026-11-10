function togglePanel() {
  panel.classList.toggle("open");
  backdrop.classList.toggle("open", panel.classList.contains("open"));
  if (panel.classList.contains("open")) {
    scan();
  }
}

function createRuleDraft(data, defaultMode = "notify") {
  const oldRule = editingRuleId && rules.find((item) => item.id === editingRuleId);
  const selectedQuoteKey = data.get("quote");
  const quote = quotes.find((item) => item.key === selectedQuoteKey)
    || (oldRule ? { outcome: oldRule.outcome } : null);
  const triggerCents = Number(data.get("triggerCents"));
  const orderLimitCents = Number(data.get("orderLimitCents"));
  const shares = Number(data.get("shares"));
  const side = data.get("side");
  if (!activeMarketKey || !quote
    || !Number.isFinite(triggerCents) || triggerCents <= 0 || triggerCents >= 100
    || !Number.isFinite(orderLimitCents) || orderLimitCents <= 0 || orderLimitCents >= 100
    || !Number.isFinite(shares) || shares < 0.01
    || !["buy", "sell"].includes(side)) {
    showToast("Confira os dados da regra", "Abra o painel de negociação do mercado em que deseja usar esta regra e informe gatilho, preço limite e quantidade válidos.", "error");
    return null;
  }

  return {
    marketKey: activeMarketKey,
    outcome: quote.outcome,
    side,
    trigger: data.get("trigger"),
    triggerCents,
    orderLimitCents,
    shares,
    expiration: data.get("expiration") || "never",
    mode: data.get("mode") || defaultMode,
    queuePolicy: data.get("queuePolicy") === "independent" ? "independent" : "ordered"
  };
}

async function saveRule(data, ruleForm, defaultMode) {
  const draft = createRuleDraft(data, defaultMode);
  if (!draft) return;
  const oldRule = editingRuleId && rules.find((item) => item.id === editingRuleId);
  const rule = oldRule
    ? { ...oldRule, ...draft, marketKey: oldRule.marketKey }
    : { ...draft, id: crypto.randomUUID(), enabled: true, createdAt: Date.now() };
  delete rule.favorite;
  if (oldRule) {
    rules = rules.map((item) => item.id === oldRule.id ? rule : item);
  } else {
    rules = [...rules, rule];
  }
  try {
    await persistRules();
  } catch (error) {
    if (oldRule) {
      rules = rules.map((item) => item.id === oldRule.id ? oldRule : item);
    } else {
      rules = rules.filter((item) => item.id !== rule.id);
    }
    showToast("Não foi possível salvar a regra", error.message || String(error), "error");
    return;
  }

  if (ruleForm) {
    ruleForm.reset();
  }
  editingRuleId = null;
  updateRuleFormMode();
  showToast(oldRule ? "Regra atualizada" : "Regra adicionada à fila",
    oldRule ? "As alterações foram salvas." : "Será executada uma vez neste mercado quando o gatilho manual for atingido.",
    "success");
  renderRules();
  renderQuotes();
  if (oldRule) selectView("rules");
}

function persistRules() {
  const snapshot = rules.map((rule) => ({ ...rule }));
  const marketKey = activeMarketKey;
  const write = () => navigator.locks.request("polymakr-rules-storage", async () => {
    if (!marketKey) throw new Error("Não foi possível identificar o mercado desta página.");
    const stored = await chrome.storage.local.get(RULES_KEY);
    const currentRules = Array.isArray(stored[RULES_KEY]) ? stored[RULES_KEY] : [];
    const nextRules = [
      ...currentRules.filter((rule) => rule.marketKey !== marketKey),
      ...snapshot.filter((rule) => rule.marketKey === marketKey)
    ];
    await chrome.storage.local.set({ [RULES_KEY]: nextRules });
    rules = nextRules;
  });
  rulesWrite = rulesWrite.then(write, write);
  return rulesWrite;
}

function persistFavorites() {
  const snapshot = favorites.map((favorite) => ({ ...favorite }));
  const write = () => chrome.storage.local.set({ [FAVORITES_KEY]: snapshot });
  favoritesWrite = favoritesWrite.then(write, write);
  return favoritesWrite;
}

function createFavoriteTemplate(rule, name, sourceRuleId) {
  return {
    id: crypto.randomUUID(),
    name,
    outcome: rule.outcome,
    side: rule.side,
    trigger: rule.trigger || "reaches",
    triggerCents: Number(rule.triggerCents ?? rule.limitCents),
    orderLimitCents: Number(rule.orderLimitCents ?? rule.limitCents),
    shares: rule.shares === undefined ? Number(rule.amount) : Number(rule.shares),
    expiration: rule.expiration || "never",
    mode: rule.mode || "notify",
    queuePolicy: rule.queuePolicy === "independent" ? "independent" : "ordered",
    ...(sourceRuleId ? { sourceRuleId } : {}),
    createdAt: Date.now()
  };
}

function openFavoriteDialog(draft, favorite = null) {
  if (!draft && !favorite) return;
  pendingFavorite = draft;
  renamingFavoriteId = favorite?.id || null;
  favoriteDialog.querySelector("#favorite-dialog-title").textContent = favorite ? "Renomear favorito" : "Salvar nos favoritos";
  favoriteDialog.querySelector(".favorite-dialog-save").textContent = favorite ? "Salvar nome" : "Salvar favorito";
  favoriteDialogInput.value = favorite
    ? favorite.name
    : `${draft.outcome} · ${draft.side === "buy" ? "Comprar" : "Vender"} · ${draft.triggerCents}¢`.slice(0, 60);
  favoriteDialogBackdrop.hidden = false;
  favoriteDialogInput.focus();
  favoriteDialogInput.select();
}

function closeFavoriteDialog() {
  favoriteDialogBackdrop.hidden = true;
  pendingFavorite = null;
  renamingFavoriteId = null;
  favoriteDialog.reset();
}

async function saveFavoriteFromDialog(event) {
  event.preventDefault();
  const name = favoriteDialogInput.value.trim();
  if (!name) {
    favoriteDialogInput.setCustomValidity("Informe um nome para o favorito.");
    favoriteDialogInput.reportValidity();
    return;
  }
  favoriteDialogInput.setCustomValidity("");
  const previous = favorites;
  const isRenaming = Boolean(renamingFavoriteId);
  if (isRenaming) {
    favorites = favorites.map((favorite) => favorite.id === renamingFavoriteId ? { ...favorite, name } : favorite);
  } else if (pendingFavorite) {
    favorites = [...favorites, createFavoriteTemplate(pendingFavorite, name)];
  } else {
    return;
  }
  try {
    await persistFavorites();
    closeFavoriteDialog();
    renderRules();
    showToast(isRenaming ? "Favorito renomeado" : "Favorito salvo",
      isRenaming ? "O nome do modelo foi atualizado." : "O modelo está disponível na aba Favoritos.",
      "success");
  } catch (error) {
    favorites = previous;
    showToast("Não foi possível salvar", error.message || String(error), "error");
    renderRules();
  }
}

function showToast(title, message, type = "success", timeout = 6500) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.textContent = type === "error" ? "!" : type === "warning" ? "⚠" : "✓";
  const content = document.createElement("div");
  const heading = document.createElement("div");
  heading.className = "toast-title";
  heading.textContent = title;
  const body = document.createElement("div");
  body.className = "toast-message";
  body.textContent = message;
  content.append(heading, body);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast-close";
  close.setAttribute("aria-label", "Fechar notificação");
  close.textContent = "×";
  close.addEventListener("click", () => toast.remove());
  toast.append(icon, content, close);
  toastStack.append(toast);
  window.setTimeout(() => toast.remove(), timeout);
}

function selectView(viewName) {
  shadow.querySelectorAll(".tab").forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.view === viewName));
  });
  shadow.querySelectorAll(".view").forEach((view) => {
    const active = view.dataset.panel === viewName;
    view.classList.toggle("active", active);
    view.hidden = !active;
  });
}

function updateRuleFormMode() {
  const editing = Boolean(editingRuleId);
  formHeading.textContent = editing ? "Editar regra" : "Criar regra";
  formSubmitButton.textContent = editing ? "Salvar alterações" : "Salvar regra";
  cancelEditButton.hidden = !editing;
}

function resetRuleForm() {
  editingRuleId = null;
  form.reset();
  form.elements.side.value = quotes[0]?.side || "buy";
  updateRuleFormMode();
  renderQuotes();
}
