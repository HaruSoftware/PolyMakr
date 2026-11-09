(() => {
  const HOST_ID = "polymakr-extension-root";
  const RULES_KEY = "polymakr.rules";
  const host = document.createElement("div");
  host.id = HOST_ID;
  document.documentElement.append(host);

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      .backdrop { position: fixed; z-index: 2147483646; inset: 0; display: none;
        background: rgba(15, 22, 18, .5); backdrop-filter: blur(3px); }
      .backdrop.open { display: block; }
      .panel {
        position: fixed; z-index: 2147483647; left: 50%; top: 50%; transform: translate(-50%, -50%);
        display: none; width: min(560px, calc(100vw - 28px)); max-height: min(760px, calc(100vh - 32px));
        overflow: hidden; border: 1px solid #dfe6e0; border-radius: 18px;
        background: #fff; color: #18211b; box-shadow: 0 12px 40px #0003;
        font: 13px/1.45 Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .panel.open { display: block; }
      .top { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between;
        align-items: center; padding: 14px 16px; border-bottom: 1px solid #edf0ed; background: #fff; }
      .top strong { font-size: 15px; }
      .top small { display: block; color: #78827b; font-size: 11px; }
      .close { border: 0; background: transparent; color: #59645d; cursor: pointer; font-size: 20px; }
      .tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 10px 16px; border-bottom: 1px solid #edf0ed; }
      .tab { padding: 8px; border: 0; border-radius: 8px; background: transparent; color: #657168; cursor: pointer; font: inherit; font-size: 12px; font-weight: 650; }
      .tab[aria-selected="true"] { background: #e8f4ec; color: #087c3b; }
      .view { display: none; max-height: min(620px, calc(100vh - 150px)); overflow: auto; padding: 18px; }
      .view.active { display: block; }
      .view h2 { margin: 0 0 14px; font-size: 15px; }
      .empty { color: #758078; font-size: 12px; }
      form { display: grid; gap: 9px; }
      label { display: grid; gap: 4px; color: #59645d; font-size: 11px; }
      input, select {
        width: 100%; min-width: 0; padding: 8px 9px; border: 1px solid #d9e0db;
        border-radius: 8px; background: #fff; color: #17211b; font: inherit; font-size: 12px;
      }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .market-outcomes { display: grid; gap: 9px; max-height: 180px; overflow: auto; }
      .market-group { display: grid; gap: 5px; }
      .market-title { overflow: hidden; color: #59645d; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
      .outcome-options { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .outcome-choice { min-height: 42px; padding: 8px; border: 1px solid #dfe4e0; border-radius: 9px; background: #fff; color: #59645d; cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; }
      .outcome-choice.up, .outcome-choice.down { border-color: #dfe4e0; background: #fff; color: #59645d; }
      .outcome-choice.up[aria-pressed="true"] { border-color: #07833b; background: #07833b; color: #fff; }
      .outcome-choice.down[aria-pressed="true"] { border-color: #c4312b; background: #c4312b; color: #fff; }
      .outcome-choice:disabled { cursor: default; opacity: .65; }
      .save-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .save-action { display: flex; min-height: 42px; align-items: center; justify-content: center; gap: 7px; padding: 9px; border: 0; border-radius: 8px; color: #fff; cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; }
      .save-action.save { background: #087c3b; }
      .save-action.save:hover { background: #056b31; }
      .save-action.favorite { background: #e58b16; }
      .save-action.favorite:hover { background: #cb7610; }
      .star { font-size: 16px; line-height: 1; }
      .hint { margin: 0; color: #78827b; font-size: 10px; line-height: 1.45; }
      .rules { display: grid; gap: 8px; }
      .rule { display: grid; grid-template-columns: 1fr auto; gap: 6px 10px;
        padding: 9px; border: 1px solid #e6ebe7; border-radius: 9px; }
      .rule-title { font-weight: 700; }
      .rule-detail { color: #657168; font-size: 11px; }
      .rule-mode { color: #087c3b; font-size: 10px; font-weight: 700; }
      .rule-actions { grid-row: span 3; display: flex; flex-direction: column; align-items: flex-end; gap: 7px; }
      .rule-actions button { padding: 2px 0; border: 0; background: transparent; cursor: pointer; font: inherit; font-size: 11px; }
      .favorite, .use-template { color: #8a6413; }
      .edit { color: #087c3b; }
      .delete { color: #a33b2e; }
      .status { min-height: 15px; margin: 0; color: #a33b2e; font-size: 11px; }
      .status.success { color: #087c3b; }
    </style>
    <div class="backdrop"></div>
    <section class="panel" role="dialog" aria-modal="true" aria-label="Painel PolyMakr">
      <header class="top">
        <div><strong>PolyMakr</strong><small>Regras de preço</small></div>
        <button class="close" type="button" aria-label="Fechar painel">×</button>
      </header>
      <nav class="tabs" role="tablist" aria-label="Seções do PolyMakr">
        <button class="tab" type="button" role="tab" data-view="create" aria-selected="true">Criar</button>
        <button class="tab" type="button" role="tab" data-view="rules" aria-selected="false">Regras</button>
        <button class="tab" type="button" role="tab" data-view="favorites" aria-selected="false">Favoritos</button>
      </nav>
      <p class="status" role="status" aria-live="polite"></p>
      <div class="view active" data-panel="create" role="tabpanel">
        <h2 class="form-heading">Criar regra</h2>
        <form>
          <label>Mercado e resultado</label>
          <div class="market-outcomes" role="group" aria-label="Mercado e resultado"></div>
          <select name="quote" aria-hidden="true" tabindex="-1" hidden></select>
          <div class="row">
            <label>Ação<select name="side"><option value="buy">Comprar</option><option value="sell">Vender</option></select></label>
            <label>Condição<select name="trigger"><option value="reaches">Atingir o preço</option><option value="rises">Subir até o preço</option><option value="falls">Cair até o preço</option></select></label>
          </div>
          <div class="row">
            <label>Disparar quando chegar a (¢)<input name="triggerCents" type="number" min="0.1" max="99.9" step="0.1" placeholder="ex.: 50" required></label>
            <label>Preço da ordem limite (¢)<input name="orderLimitCents" type="number" min="0.1" max="99.9" step="0.1" placeholder="ex.: 50" required></label>
          </div>
          <div class="row">
            <label>Quantidade (shares)<input name="shares" type="number" min="0.01" step="0.01" placeholder="ex.: 5" required></label>
            <label>Expiração<select name="expiration"><option value="never">Never</option></select></label>
          </div>
          <label>Quando disparar<select name="mode">
            <option value="notify">Somente notificar</option>
            <option value="confirm">Avisar e pedir confirmação</option>
            <option value="auto_limit">Automatizar ordem limite</option>
          </select></label>
          <div class="save-actions">
            <button class="save-action save" type="submit" name="saveAction" value="save">Salvar regra</button>
            <button class="save-action favorite" type="submit" name="saveAction" value="favorite" aria-label="Salvar e favoritar regra"><span class="star" aria-hidden="true">★</span> Favoritar</button>
          </div>
          <button class="cancel-edit" type="button" hidden>Cancelar edição</button>
        </form>
      </div>
      <div class="view" data-panel="rules" role="tabpanel" hidden>
        <h2>Regras criadas</h2>
        <div class="rules"></div>
      </div>
      <div class="view" data-panel="favorites" role="tabpanel" hidden>
        <h2>Regras favoritas</h2>
        <div class="favorites"></div>
      </div>
    </section>
  `;

  const panel = shadow.querySelector(".panel");
  const backdrop = shadow.querySelector(".backdrop");
  const quoteSelect = shadow.querySelector('[name="quote"]');
  const quoteOptions = shadow.querySelector(".market-outcomes");
  const rulesElement = shadow.querySelector(".rules");
  const favoritesElement = shadow.querySelector(".favorites");
  const form = shadow.querySelector("form");
  const statusElement = shadow.querySelector(".status");
  const formSubmitButton = form.querySelector('[value="save"]');
  const formHeading = shadow.querySelector(".form-heading");
  const cancelEditButton = shadow.querySelector(".cancel-edit");
  const tradingSideGroups = new WeakSet();
  let rules = [];
  let quotes = [];
  let autoModeActive = false;
  let lastNativeTradeSide = null;
  let inlineAutoHost = null;
  let inlineAutoRoot = null;
  let inlineAutoForm = null;
  let autoLayoutPanel = null;
  let autoLayoutHeader = null;
  const autoHiddenElements = new Map();
  const previousPrices = new Map();
  let queueWorkerRunning = false;
  let rulesWrite = Promise.resolve();
  let scanTimer;
  let mutationScanScheduled = false;

  shadow.querySelector(".close").addEventListener("click", togglePanel);
  backdrop.addEventListener("click", togglePanel);
  shadow.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => selectView(tab.dataset.view));
  });
  cancelEditButton.addEventListener("click", () => {
    resetRuleForm();
    selectView("rules");
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel.classList.contains("open")) {
      togglePanel();
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "POLYMAKR_TOGGLE_PANEL") {
      togglePanel();
    }
  });

  chrome.storage.local.get({ [RULES_KEY]: [] }).then(async (stored) => {
    rules = Array.isArray(stored[RULES_KEY]) ? stored[RULES_KEY] : [];
    let interrupted = false;
    for (const rule of rules) {
      if (rule.executionStatus === "processing") {
        rule.executionStatus = "failed";
        rule.executionMessage = "Execução interrompida; confira o Polymarket. A regra não será repetida automaticamente.";
        interrupted = true;
      }
    }
    renderRules();
    if (interrupted) {
      try {
        await persistRules();
      } catch (error) {
        statusElement.textContent = `Não foi possível salvar o estado de execução interrompida: ${error.message || error}`;
      }
    }
    scan();
  }).catch((error) => {
    statusElement.textContent = `Não foi possível carregar as regras: ${error.message || error}`;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveRule(new FormData(form, event.submitter), statusElement, form, "notify");
  });

  function togglePanel() {
    panel.classList.toggle("open");
    backdrop.classList.toggle("open", panel.classList.contains("open"));
    if (panel.classList.contains("open")) {
      scan();
    }
  }

  async function saveRule(data, ruleStatus, ruleForm, defaultMode) {
    const oldRule = editingRuleId && rules.find((item) => item.id === editingRuleId);
    const selectedQuoteKey = data.get("quote");
    const quote = quotes.find((item) => item.key === selectedQuoteKey)
      || (oldRule?.quoteKey === selectedQuoteKey
        ? { key: oldRule.quoteKey, market: oldRule.market, outcome: oldRule.outcome }
        : null);
    const triggerCents = Number(data.get("triggerCents"));
    const orderLimitCents = Number(data.get("orderLimitCents"));
    const shares = Number(data.get("shares"));
    const side = data.get("side");
    const favorite = data.get("saveAction") === "favorite" || Boolean(oldRule?.favorite);

    if (!quote
      || !Number.isFinite(triggerCents) || triggerCents <= 0 || triggerCents >= 100
      || !Number.isFinite(orderLimitCents) || orderLimitCents <= 0 || orderLimitCents >= 100
      || !Number.isFinite(shares) || shares < 0.01) {
      ruleStatus.classList.remove("success");
      ruleStatus.textContent = "Confira mercado, preços em centavos e quantidade de shares.";
      return;
    }

    const rule = oldRule
      ? {
          ...oldRule,
          market: quote.market,
          quoteKey: quote.key,
          outcome: quote.outcome,
          side,
          trigger: data.get("trigger"),
          triggerCents,
          orderLimitCents,
          shares,
          expiration: data.get("expiration") || "never",
          mode: data.get("mode") || defaultMode,
          favorite
        }
      : {
          id: crypto.randomUUID(),
          market: quote.market,
          quoteKey: quote.key,
          outcome: quote.outcome,
          side,
          trigger: data.get("trigger"),
          triggerCents,
          orderLimitCents,
          shares,
          expiration: data.get("expiration") || "never",
          mode: data.get("mode") || defaultMode,
          enabled: true,
          favorite,
          createdAt: Date.now()
        };
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
      ruleStatus.classList.remove("success");
      ruleStatus.textContent = `Não foi possível salvar a regra: ${error.message || error}`;
      return;
    }

    if (ruleForm) {
      ruleForm.reset();
    }
    editingRuleId = null;
    updateRuleFormMode();
    statusElement.classList.add("success");
    ruleStatus.classList.add("success");
    ruleStatus.textContent = oldRule
      ? "Alterações salvas."
      : favorite ? "Regra salva nos favoritos." : "Regra salva neste navegador.";
    renderRules();
    renderQuotes();
    if (oldRule) selectView("rules");
  }

  function persistRules() {
    const snapshot = rules.map((rule) => ({ ...rule }));
    const write = () => chrome.storage.local.set({ [RULES_KEY]: snapshot });
    rulesWrite = rulesWrite.then(write, write);
    return rulesWrite;
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
    statusElement.textContent = "";
    statusElement.classList.remove("success");
    updateRuleFormMode();
    renderQuotes();
  }

  function syncAutoTradeTab() {
    const tradingPanel = findTradingPanelElement();
    const sideGroup = tradingPanel && findTradeSideGroup(tradingPanel);
    const outcomeGroup = tradingPanel && findOutcomeGroup(tradingPanel);

    if (!sideGroup || !outcomeGroup) {
      setAutoMode(false);
      autoModeActive = false;
      inlineAutoHost?.remove();
      inlineAutoButton?.remove();
      inlineAutoButton = null;
      autoLayoutPanel = null;
      autoLayoutHeader = null;
      return;
    }

    if (!inlineAutoButton || inlineAutoButton.parentElement !== sideGroup) {
      inlineAutoButton?.remove();
      inlineAutoButton = createAutoButton(sideGroup);
    }

    if (!tradingSideGroups.has(sideGroup)) {
      tradingSideGroups.add(sideGroup);
      sideGroup.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target.closest("button") : null;
        if (target && target !== inlineAutoButton
          && ["buy", "sell"].includes(normalizedText(target))) {
          lastNativeTradeSide = target;
          setAutoMode(false, sideGroup);
        }
      });
    }

    if (!inlineAutoHost) {
      inlineAutoHost = document.createElement("div");
      inlineAutoHost.id = "polymakr-inline-auto";
      inlineAutoRoot = inlineAutoHost.attachShadow({ mode: "open" });
      inlineAutoRoot.innerHTML = `
        <style>
          :host { display: block; width: 100%; color: inherit; font: inherit; }
          * { box-sizing: border-box; }
          .auto { display: grid; gap: 18px; padding: 16px 0 0; }
          .auto.enter { animation: enter .2s ease-out both; }
          @keyframes enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          .heading { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
          .heading strong { color: inherit; font-size: 16px; font-weight: 650; }
          .heading span, .hint { color: inherit; opacity: .68; font-size: 11px; }
          .prices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .price { min-height: 48px; padding: 10px 12px; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; background: rgba(255,255,255,.04); color: inherit; cursor: pointer; font: inherit; font-weight: 650; transition: background .16s ease, border-color .16s ease, transform .16s ease; }
          .price:hover { transform: translateY(-1px); }
          .price.up { color: #087c3b; }
          .price.down { color: #c4312b; }
          .price.up[aria-pressed="true"] { border-color: #087c3b; background: rgba(8,124,59,.16); }
          .price.down[aria-pressed="true"] { border-color: #c4312b; background: rgba(196,49,43,.16); }
          form { display: grid; gap: 13px; }
          label { display: grid; gap: 6px; color: inherit; opacity: .78; font-size: 12px; font-weight: 500; }
          input, select { width: 100%; min-width: 0; height: 42px; padding: 0 12px; border: 1px solid rgba(255,255,255,.16); border-radius: 8px; background: rgba(255,255,255,.04); color: inherit; font: inherit; font-size: 14px; outline: none; }
          option { background: #171d26; color: #fff; }
          input:focus, select:focus { border-color: #3859e8; box-shadow: 0 0 0 2px #3859e822; }
          .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .save { height: 48px; border: 0; border-radius: 8px; background: #3859e8; color: #fff; cursor: pointer; font: inherit; font-size: 15px; font-weight: 650; transition: background .16s ease, transform .16s ease; }
          .save:hover { background: #2e49c2; transform: translateY(-1px); }
          .status { min-height: 15px; margin: -4px 0 0; color: #ad3434; font-size: 11px; }
          .status.success { color: #237a46; }
          .hint { margin: -6px 0 0; line-height: 1.45; }
          @media (prefers-reduced-motion: reduce) { .auto.enter, .price, .save { animation: none; transition: none; } }
        </style>
        <section class="auto" aria-label="Criar automação PolyMakr">
          <div class="heading"><strong>Automação</strong><span>Ordem limite</span></div>
          <div class="prices" aria-label="Resultados e preços"></div>
          <form>
            <select name="quote" aria-label="Resultado" required hidden></select>
            <div class="row">
              <label>Condição<select name="trigger"><option value="reaches">Atingir o preço</option><option value="rises">Subir até o preço</option><option value="falls">Cair até o preço</option></select></label>
              <label>Quantidade (shares)<input name="shares" type="number" min="0.01" step="0.01" placeholder="ex.: 5" required></label>
            </div>
            <div class="row">
              <label>Disparar em (¢)<input name="triggerCents" type="number" min="0.1" max="99.9" step="0.1" placeholder="ex.: 50" required></label>
              <label>Preço limite (¢)<input name="orderLimitCents" type="number" min="0.1" max="99.9" step="0.1" placeholder="ex.: 50" required></label>
            </div>
            <button class="save" type="submit">Salvar automação</button>
            <p class="status" role="status"></p>
            <p class="hint">A regra seleciona <span class="side-label">Buy</span> e envia uma ordem limite quando o gatilho for atingido.</p>
          </form>
        </section>`;

      inlineAutoForm = inlineAutoRoot.querySelector("form");
      inlineAutoForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const autoStatus = inlineAutoRoot.querySelector(".status");
        await saveRule(new FormData(inlineAutoForm), autoStatus, inlineAutoForm, "auto_limit");
      });
      for (const input of inlineAutoForm.querySelectorAll('[name="triggerCents"], [name="orderLimitCents"]')) {
        input.addEventListener("input", () => {
          input.dataset.edited = "true";
        });
      }
    }

    const tabsRow = sideGroup.parentElement;
    const header = tabsRow.parentElement;
    if (autoLayoutPanel !== tradingPanel || autoLayoutHeader !== header) {
      restoreAutoLayout();
      autoLayoutPanel = tradingPanel;
      autoLayoutHeader = header;
    }
    if (inlineAutoHost.parentElement !== tradingPanel
      || inlineAutoHost.previousElementSibling !== header) {
      tradingPanel.insertBefore(inlineAutoHost, header.nextSibling);
    }

    const siteSide = [...findExactControls(sideGroup, "Buy"), ...findExactControls(sideGroup, "Sell")]
      .find((button) => button.getAttribute("aria-checked") === "true");
    if (siteSide && !autoModeActive) {
      lastNativeTradeSide = siteSide;
    }
    renderInlineAutoQuotes();
    inlineAutoRoot.querySelector(".side-label").textContent =
      normalizedText(lastNativeTradeSide || siteSide) === "sell" ? "Sell" : "Buy";
    setAutoMode(autoModeActive, sideGroup);
  }

  let inlineAutoButton = null;

  function createAutoButton(sideGroup) {
    const siteSides = [...findExactControls(sideGroup, "Buy"), ...findExactControls(sideGroup, "Sell")];
    const reference = siteSides.find((button) => button.getAttribute("aria-checked") !== "true") || siteSides[0];
    if (!reference) {
      return null;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "radio");
    button.className = reference.className;
    button.textContent = "Auto";
    button.setAttribute("aria-label", "Auto");
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-checked", "false");
    button.setAttribute("data-state", "unchecked");
    button.tabIndex = 0;
    button.style.cssText = copyButtonStyles(reference);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const selectedSide = [...findExactControls(sideGroup, "Buy"), ...findExactControls(sideGroup, "Sell")]
        .find((side) => side.getAttribute("aria-checked") === "true");
      if (!autoModeActive && selectedSide) {
        lastNativeTradeSide = selectedSide;
      }
      setAutoMode(!autoModeActive, sideGroup);
    });
    sideGroup.append(button);
    return button;
  }

  function copyButtonStyles(reference) {
    const style = window.getComputedStyle(reference);
    return [
      `height:${style.height}`,
      `min-height:${style.minHeight}`,
      `padding:${style.padding}`,
      `border:${style.border}`,
      `border-radius:${style.borderRadius}`,
      `font:${style.font}`,
      `cursor:pointer`,
      `flex:${style.flex}`,
      `width:auto`,
      `min-width:0`,
      `white-space:nowrap`
    ].join(";");
  }

  function updateAutoModeUI(sideGroup) {
    if (sideGroup) {
      const siteSides = [...findExactControls(sideGroup, "Buy"), ...findExactControls(sideGroup, "Sell")];
      if (!autoModeActive && !lastNativeTradeSide) {
        lastNativeTradeSide = siteSides.find((button) => button.getAttribute("aria-checked") === "true")
          || siteSides[0];
      }
      for (const side of siteSides) {
        const selected = !autoModeActive && side === lastNativeTradeSide;
        side.setAttribute("aria-checked", String(selected));
        side.setAttribute("data-state", selected ? "checked" : "unchecked");
      }
    }
    if (inlineAutoButton) {
      inlineAutoButton.setAttribute("aria-pressed", String(autoModeActive));
      inlineAutoButton.setAttribute("aria-checked", String(autoModeActive));
      inlineAutoButton.setAttribute("data-state", autoModeActive ? "checked" : "unchecked");
      inlineAutoButton.tabIndex = autoModeActive ? 0 : -1;
      inlineAutoButton.dataset.active = String(autoModeActive);
    }
  }

  function setAutoMode(active, sideGroup) {
    if (!sideGroup) {
      const tradingPanel = findTradingPanelElement();
      sideGroup = tradingPanel && findTradeSideGroup(tradingPanel);
    }

    const enteringAuto = active && !autoModeActive;
    autoModeActive = active;
    if (sideGroup) {
      const nativeSides = [...findExactControls(sideGroup, "Buy"), ...findExactControls(sideGroup, "Sell")];
      if (active) {
        const selected = nativeSides.find((side) => side.getAttribute("aria-checked") === "true");
        if (selected) {
          lastNativeTradeSide = selected;
        }
      } else if (!lastNativeTradeSide?.isConnected) {
        lastNativeTradeSide = nativeSides.find((side) => side.getAttribute("aria-checked") === "true")
          || nativeSides[0];
      }

      for (const side of nativeSides) {
        const selected = !active && side === lastNativeTradeSide;
        side.setAttribute("aria-checked", String(selected));
        side.setAttribute("data-state", selected ? "checked" : "unchecked");
        side.tabIndex = selected ? 0 : -1;
      }
    }

    updateAutoModeUI(sideGroup);
    if (inlineAutoHost) {
      inlineAutoHost.style.display = active ? "block" : "none";
      const autoScreen = inlineAutoRoot.querySelector(".auto");
      if (enteringAuto) {
        autoScreen.classList.remove("enter");
        void autoScreen.offsetWidth;
        autoScreen.classList.add("enter");
      }
    }
    if (active) {
      applyAutoLayout(sideGroup);
    } else if (autoHiddenElements.size > 0) {
      restoreAutoLayout();
    }
  }

  function applyAutoLayout(sideGroup) {
    const tradingPanel = findTradingPanelElement();
    const header = sideGroup?.parentElement?.parentElement;
    if (!tradingPanel || !header) {
      return;
    }

    if (autoLayoutPanel !== tradingPanel || autoLayoutHeader !== header) {
      restoreAutoLayout();
      autoLayoutPanel = tradingPanel;
      autoLayoutHeader = header;
    }

    if (inlineAutoHost.parentElement !== tradingPanel
      || inlineAutoHost.previousElementSibling !== header) {
      tradingPanel.insertBefore(inlineAutoHost, header.nextSibling);
    }

    for (const child of tradingPanel.children) {
      if (child !== header && child !== inlineAutoHost) {
        hideAutoElement(child);
      }
    }
    const typeControls = ["Market", "Limit"]
      .flatMap((label) => findExactControls(header, label))
      .filter((element) => element.getAttribute("aria-haspopup") === "menu");
    for (const control of typeControls) {
      hideAutoElement(control);
    }
  }

  function hideAutoElement(element) {
    if (!autoHiddenElements.has(element)) {
      autoHiddenElements.set(element, {
        display: element.style.getPropertyValue("display"),
        displayPriority: element.style.getPropertyPriority("display"),
        hidden: element.hidden,
        ariaHidden: element.getAttribute("aria-hidden")
      });
    }
    element.style.setProperty("display", "none", "important");
    element.hidden = true;
    element.setAttribute("aria-hidden", "true");
  }

  function restoreAutoLayout() {
    for (const [element, previous] of autoHiddenElements) {
      if (previous.display) {
        element.style.setProperty("display", previous.display, previous.displayPriority);
      } else {
        element.style.removeProperty("display");
      }
      element.hidden = previous.hidden;
      if (previous.ariaHidden === null) {
        element.removeAttribute("aria-hidden");
      } else {
        element.setAttribute("aria-hidden", previous.ariaHidden);
      }
    }
    autoHiddenElements.clear();
    autoLayoutPanel = null;
    autoLayoutHeader = null;
  }

  function findTradeSideGroup(tradingPanel) {
    const groups = [...tradingPanel.querySelectorAll("[role='radiogroup']")]
      .filter((group) => findExactControls(group, "Buy").length === 1
        && findExactControls(group, "Sell").length === 1);
    if (groups.length === 1) {
      return groups[0];
    }

    const buyButton = findExactControl(tradingPanel, "Buy");
    const sellButton = findExactControl(tradingPanel, "Sell");
    for (let node = buyButton?.parentElement, depth = 0; node && depth < 5; node = node.parentElement, depth += 1) {
      if (node.contains(sellButton) && findExactControls(node, "Buy").length === 1
        && findExactControls(node, "Sell").length === 1) {
        return node;
      }
    }
    return null;
  }

  function findOutcomeGroup(tradingPanel) {
    return [...tradingPanel.querySelectorAll("[role='radiogroup']")]
      .find((group) => [...group.querySelectorAll("button,[role='radio']")]
        .some((button) => parseQuoteButton(button)?.outcome === "Up")
        && [...group.querySelectorAll("button,[role='radio']")]
          .some((button) => parseQuoteButton(button)?.outcome === "Down"));
  }

  function getInlineQuotes() {
    const tradingPanel = findTradingPanelElement();
    const outcomeGroup = tradingPanel && findOutcomeGroup(tradingPanel);
    if (!outcomeGroup) {
      return [];
    }
    return [...outcomeGroup.querySelectorAll("button,[role='radio']")]
      .map((button) => {
        const quote = parseQuoteButton(button);
        return quote ? { ...quote, element: button } : null;
      })
      .filter(Boolean);
  }

  function renderInlineAutoQuotes() {
    if (!inlineAutoRoot || !inlineAutoForm) {
      return;
    }

    const currentQuotes = getInlineQuotes();
    const prices = inlineAutoRoot.querySelector(".prices");
    const quoteSelect = inlineAutoForm.querySelector('[name="quote"]');
    const selectedKey = quoteSelect.value;
    const selectedNativeQuote = currentQuotes.find((quote) => quote.element.getAttribute("aria-checked") === "true");
    prices.replaceChildren();
    quoteSelect.replaceChildren();

    if (currentQuotes.length === 0) {
      quoteSelect.add(new Option("Aguardando preços…", ""));
      return;
    }

    for (const quote of currentQuotes) {
      const option = new Option(`${quote.outcome} · ${quote.price}¢`, quote.key);
      quoteSelect.add(option);

      const priceButton = document.createElement("button");
      priceButton.type = "button";
      priceButton.className = `price ${quote.outcome.toLowerCase()}`;
      priceButton.textContent = `${quote.outcome} ${quote.price}¢`;
      priceButton.setAttribute("aria-pressed", String(quote.key === (selectedKey || selectedNativeQuote?.key)));
      priceButton.addEventListener("click", () => {
        quoteSelect.value = quote.key;
        selectNativeQuote(quote.key);
        updateAutoPriceDefaults();
        renderInlineAutoQuotes();
      });
      prices.append(priceButton);
    }

    quoteSelect.value = currentQuotes.some((quote) => quote.key === selectedKey)
      ? selectedKey
      : selectedNativeQuote?.key || currentQuotes[0].key;
    updateAutoPriceDefaults();
  }

  function selectNativeQuote(quoteKey) {
    const quote = getInlineQuotes().find((item) => item.key === quoteKey);
    if (quote && quote.element.getAttribute("aria-checked") !== "true") {
      quote.element.click();
    }
  }

  function updateAutoPriceDefaults() {
    const quoteKey = inlineAutoForm?.querySelector('[name="quote"]').value;
    const quote = getInlineQuotes().find((item) => item.key === quoteKey);
    if (!quote) {
      return;
    }
    for (const name of ["triggerCents", "orderLimitCents"]) {
      const input = inlineAutoForm.querySelector(`[name="${name}"]`);
      if (!input.dataset.edited || !input.value) {
        input.value = String(quote.price);
      }
    }
  }

  function parseQuoteButton(button) {
    const text = (button.innerText || button.textContent || "").replace(/\s+/g, " ").trim();
    const match = text.match(/\b(Up|Down)\s*([0-9]{1,3}(?:[.,][0-9]{1,2})?)\s*¢/i);
    if (!match) {
      return null;
    }

    const price = Number(match[2].replace(",", "."));
    if (!Number.isFinite(price) || price <= 0 || price >= 100) {
      return null;
    }

    const card = findCard(button);
    return {
      outcome: match[1][0].toUpperCase() + match[1].slice(1).toLowerCase(),
      price,
      market: card.market,
      key: `${card.key}|${match[1].toLowerCase()}`
    };
  }

  function findCard(button) {
    let node = button.parentElement;
    let candidate = node;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      const text = (node.innerText || "").replace(/\s+/g, " ").trim();
      const buttons = [...node.querySelectorAll("button,[role='button']")];
      const hasUp = buttons.some((item) => /\bUp\s*[0-9]{1,3}(?:[.,][0-9]{1,2})?\s*¢/i.test(item.innerText || item.textContent || ""));
      const hasDown = buttons.some((item) => /\bDown\s*[0-9]{1,3}(?:[.,][0-9]{1,2})?\s*¢/i.test(item.innerText || item.textContent || ""));
      if (text.length <= 1200 && hasUp && hasDown) {
        candidate = node;
        break;
      }
      if (text.length <= 1200) {
        candidate = node;
      }
    }

    const link = candidate.querySelector("a[href*='/event/'],a[href*='/market/']");
    const heading = candidate.querySelector("h1,h2,h3,h4,[role='heading']");
    const eventPage = location.pathname.match(/^\/event\/[^/]+/i)?.[0];
    const pageTitle = (document.querySelector("h1")?.innerText || "").replace(/\s+/g, " ").trim();
    const linkTitle = (link?.innerText || "").replace(/\s+/g, " ").trim();
    const localHeading = (heading?.innerText || "").replace(/\s+/g, " ").trim();
    const market = (eventPage && pageTitle)
      || linkTitle
      || localHeading
      || pageTitle
      || document.title;
    const key = eventPage || link?.getAttribute("href") || market.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return { market: market.slice(0, 100), key };
  }

  function scan() {
    const next = new Map();
    for (const button of document.querySelectorAll("button,[role='button']")) {
      const quote = parseQuoteButton(button);
      if (!quote) {
        continue;
      }
      next.set(quote.key, { ...quote, element: button });
    }

    for (const [key, quote] of next) {
      const previous = previousPrices.get(key);
      if (previous !== undefined && previous !== quote.price) {
        checkRules(quote, previous);
      }
    }

    previousPrices.clear();
    for (const [key, quote] of next) {
      previousPrices.set(key, quote.price);
    }
    quotes = [...next.values()];
    renderQuotes();
    processRuleQueue();
    scheduleNextScan();
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0
      && rect.height > 0
      && style.display !== "none"
      && style.visibility !== "hidden";
  }

  function scheduleNextScan() {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, 1000);
  }

  function checkRules(quote, previous) {
    const queued = [];
    for (const rule of rules) {
      if (!rule.enabled || rule.executionStatus || rule.quoteKey !== quote.key) continue;
      const limit = Number(rule.triggerCents ?? rule.limitCents);
      const crossed = rule.trigger === "rises"
        ? previous < limit && quote.price >= limit
        : rule.trigger === "falls"
          ? previous > limit && quote.price <= limit
          : (previous < limit && quote.price >= limit) || (previous > limit && quote.price <= limit);
      if (!crossed) continue;
      rule.executionStatus = "queued";
      rule.triggeredPrice = quote.price;
      rule.executionMessage = "Aguardando execução na fila.";
      queued.push(rule);
    }

    if (queued.length) {
      renderRules();
      persistRules().catch((error) => {
        for (const rule of queued) {
          rule.executionStatus = "failed";
          rule.executionMessage = `Não foi possível registrar a regra na fila; ela não foi executada: ${error.message || error}`;
        }
        statusElement.textContent = "Falha ao salvar o estado da fila. Nenhuma nova regra foi executada.";
        renderRules();
      });
    }
  }

  async function processRuleQueue() {
    if (queueWorkerRunning) return;
    queueWorkerRunning = true;
    try {
      while (true) {
        try {
          await rulesWrite;
        } catch (error) {
          await persistRules().catch((retryError) => {
            throw new Error(`Falha ao salvar regras: ${error.message || error}. Nova tentativa: ${retryError.message || retryError}.`);
          });
        }
        const rule = rules.find((item) => item.executionStatus === "queued");
        if (!rule) return;
        const quote = quotes.find((item) => item.key === rule.quoteKey);
        if (!quote) return;

        rule.executionStatus = "processing";
        rule.executionMessage = "Execução em andamento.";
        try {
          await persistRules();
        } catch (error) {
          rule.executionStatus = "failed";
          rule.executionMessage = `Não foi possível registrar o início da execução; a regra não foi executada: ${error.message || error}`;
          statusElement.textContent = rule.executionMessage;
          renderRules();
          return;
        }
        renderRules();

        const summary = ruleSummary(rule, quote);
        try {
          if (rule.mode === "auto_limit") {
            await executeLimitOrder(rule, quote);
            rule.executionMessage = "Concluída — clique em Trade enviado; confira o status da ordem no Polymarket.";
          } else {
            const notice = rule.mode === "confirm"
              ? "Confirmação não conectada; somente aviso."
              : "Somente alerta.";
            rule.executionMessage = "Concluída — aviso enviado.";
            sendRuleNotification(`${summary} ${notice}`, rule.side === "buy" ? "Comprar" : "Vender");
          }
          rule.executionStatus = "completed";
          await persistRules();
          renderRules();
          if (rule.mode === "auto_limit") {
            sendRuleNotification(`${summary} Clique em Trade enviado. Confira a ordem no Polymarket e confirme a carteira se solicitado.`, rule.side === "buy" ? "Comprar" : "Vender");
          }
        } catch (error) {
          rule.executionStatus = "failed";
          const reason = error instanceof Error ? error.message : "Falha inesperada ao executar a regra.";
          rule.executionMessage = `${reason} Confira o Polymarket antes de criar outra regra. A regra não será repetida automaticamente.`;
          try {
            await persistRules();
          } catch (storageError) {
            rule.executionMessage += ` Também não foi possível salvar o estado: ${storageError.message || storageError}.`;
          }
          statusElement.textContent = rule.executionMessage;
          renderRules();
          sendRuleNotification(`A regra não foi concluída: ${rule.executionMessage}`, "Execução não concluída");
        }
      }
    } catch (error) {
      statusElement.textContent = `Não foi possível continuar a fila: ${error.message || error}`;
    } finally {
      queueWorkerRunning = false;
    }
  }

  function ruleSummary(rule, quote) {
    const verb = rule.side === "buy" ? "Comprar" : "Vender";
    const trigger = Number(rule.triggerCents ?? rule.limitCents);
    const orderPrice = Number(rule.orderLimitCents ?? rule.limitCents);
    const size = rule.shares === undefined
      ? (rule.side === "buy" ? `US$ ${rule.amount}` : `${rule.amount} shares`)
      : `${rule.shares} shares`;
    const observed = Number(rule.triggeredPrice ?? quote.price);
    return `${verb} ${quote.outcome} em ${rule.market}: gatilho de ${trigger}¢ atingido (preço observado ${observed}¢). Ordem limite configurada em ${orderPrice}¢, tamanho: ${size}. Expiração: Never.`;
  }

  async function executeLimitOrder(rule, quote) {
    if (autoModeActive) {
      setAutoMode(false);
    }

    if (autoModeActive) {
      setAutoMode(false);
    }

    if (!["buy", "sell"].includes(rule.side)
      || !Number.isFinite(Number(rule.orderLimitCents))
      || Number(rule.orderLimitCents) <= 0
      || Number(rule.orderLimitCents) >= 100
      || !Number.isFinite(Number(rule.shares))
      || Number(rule.shares) < 0.01) {
      throw new Error("Os valores salvos da ordem são inválidos.");
    }

    const quoteButton = quote.element;
    const currentQuote = quoteButton && parseQuoteButton(quoteButton);
    if (!quoteButton || !quoteButton.isConnected || !isVisible(quoteButton)
      || !currentQuote || currentQuote.key !== rule.quoteKey || currentQuote.outcome !== rule.outcome) {
      throw new Error("O botão do resultado associado à regra não está mais disponível.");
    }

    quoteButton.click();
    await waitForPageUpdate();
    verifySelectedQuote(rule);

    let panel = findTradingPanelElement();
    if (!panel) {
      throw new Error("Não encontrei o formulário de ordem do Polymarket.");
    }

    await selectTradeSide(panel, rule.side);
    panel = findTradingPanelElement();
    if (!panel) {
      throw new Error("O formulário de ordem desapareceu após selecionar Buy/Sell.");
    }

    await selectLimitOrderType(panel);
    panel = findTradingPanelElement();
    if (!panel) {
      throw new Error("O formulário de ordem desapareceu após selecionar Limit.");
    }

    const priceInput = findUniqueInput(panel, "0¢", "preço limite");
    const sharesInput = findUniqueInput(panel, "0", "quantidade de shares");
    setInputValue(priceInput, String(rule.orderLimitCents));
    setInputValue(sharesInput, String(rule.shares));
    await waitForPageUpdate();

    panel = findTradingPanelElement();
    if (!panel) {
      throw new Error("O formulário de ordem desapareceu ao preencher preço e shares.");
    }

    const confirmedPriceInput = findUniqueInput(panel, "0¢", "preço limite");
    const confirmedSharesInput = findUniqueInput(panel, "0", "quantidade de shares");
    if (!valuesMatch(confirmedPriceInput.value, rule.orderLimitCents)
      || !valuesMatch(confirmedSharesInput.value, rule.shares)) {
      throw new Error("O Polymarket não confirmou os valores configurados; a ordem não foi enviada.");
    }

    const tradeButton = findExactControl(panel, "Trade");
    if (!tradeButton || tradeButton.disabled) {
      throw new Error("O botão Trade não está disponível para enviar a ordem.");
    }
    tradeButton.click();
  }

  async function selectTradeSide(panel, side) {
    const label = side === "buy" ? "Buy" : "Sell";
    let control = findExactControl(panel, label);
    if (!control) {
      throw new Error(`Não encontrei a opção ${label} no formulário.`);
    }
    if (control.getAttribute("aria-checked") !== "true") {
      control.click();
      await waitForPageUpdate();
      const updatedPanel = findTradingPanelElement();
      control = updatedPanel && findExactControl(updatedPanel, label);
    }
    if (!control || control.getAttribute("aria-checked") !== "true") {
      throw new Error(`Não foi possível confirmar a seleção ${label}.`);
    }
  }

  async function selectLimitOrderType(panel) {
    const typeControls = ["Market", "Limit"]
      .flatMap((label) => findExactControls(panel, label))
      .filter((element) => element.getAttribute("aria-haspopup") === "menu");
    if (typeControls.length !== 1) {
      throw new Error("Não encontrei o seletor de tipo de ordem.");
    }
    const control = typeControls[0];
    if (normalizedText(control) === "limit") {
      return;
    }

    control.click();
    await waitForPageUpdate();
    const limitOptions = findExactControls(document, "Limit")
      .filter((element) => element.getAttribute("role") === "menuitem"
        || element.getAttribute("role") === "menuitemradio"
        || element.getAttribute("role") === "option");
    if (limitOptions.length !== 1) {
      throw new Error("Não foi possível identificar com segurança a opção Limit.");
    }
    limitOptions[0].click();
    await waitForPageUpdate();

    const updatedPanel = findTradingPanelElement();
    const updatedControl = updatedPanel
      && findExactControls(updatedPanel, "Limit")
        .find((element) => element.getAttribute("aria-haspopup") === "menu");
    if (!updatedControl) {
      throw new Error("Não foi possível confirmar que o tipo de ordem Limit foi selecionado.");
    }
  }

  function verifySelectedQuote(rule) {
    const selected = [...document.querySelectorAll("button[role='radio']")]
      .find((button) => button.getAttribute("aria-checked") === "true"
        && parseQuoteButton(button)?.key === rule.quoteKey);
    if (!selected || parseQuoteButton(selected)?.outcome !== rule.outcome) {
      throw new Error("Não foi possível confirmar a seleção do resultado da regra.");
    }
  }

  function findTradingPanelElement() {
    if (autoModeActive && autoLayoutPanel?.isConnected) {
      return autoLayoutPanel;
    }

    const candidates = [...document.querySelectorAll("button,[role='button']")]
      .filter((button) => normalizedText(button) === "trade" && isVisible(button));

    for (const tradeButton of candidates) {
      let node = tradeButton.parentElement;
      for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
        if (!isVisible(node)) {
          continue;
        }

        const rect = node.getBoundingClientRect();
        if (rect.width < 230 || rect.width > 520 || rect.height < 280 || rect.height > 900) {
          continue;
        }

        const text = normalizedText(node);
        if (/\bbuy\b/.test(text) && /\bsell\b/.test(text) && /\bshares?\b/.test(text)) {
          return node;
        }
      }
    }

    return null;
  }

  function findExactControls(root, label) {
    return [...root.querySelectorAll("button,[role='button'],[role='radio'],[role='menuitem'],[role='menuitemradio'],[role='option']")]
      .filter((element) => isVisible(element) && normalizedText(element) === label.toLowerCase());
  }

  function findExactControl(root, label) {
    const matches = findExactControls(root, label);
    return matches.length === 1 ? matches[0] : null;
  }

  function findUniqueInput(panel, placeholder, description) {
    const matches = [...panel.querySelectorAll("input")]
      .filter((input) => isVisible(input)
        && input.getAttribute("placeholder") === placeholder
        && !input.disabled
        && !input.readOnly);
    if (matches.length !== 1) {
      throw new Error(`Não foi possível identificar com segurança o campo de ${description}.`);
    }
    return matches[0];
  }

  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) {
      throw new Error("Não foi possível preencher um campo do formulário de ordem.");
    }
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function valuesMatch(value, expected) {
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) && Math.abs(parsed - Number(expected)) < 0.001;
  }

  function normalizedText(element) {
    return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function waitForPageUpdate() {
    return new Promise((resolve) => window.setTimeout(resolve, 150));
  }

  function recordAutomaticOrderFailure(rule, error) {
    rule.executionStatus = "failed";
    const reason = error instanceof Error ? error.message : "Falha inesperada ao preparar a ordem.";
    rule.executionMessage = `${reason} Confira o Polymarket antes de criar outra regra.`;
    chrome.storage.local.set({ [RULES_KEY]: rules }).then(() => {
      renderRules();
    }).catch((storageError) => {
      rule.executionMessage += ` Também não foi possível salvar o estado: ${storageError.message || storageError}.`;
      renderRules();
    });
    const message = `A tentativa automática não foi concluída: ${rule.executionMessage}`;
    statusElement.textContent = message;
    sendRuleNotification(message, "Automação não concluída");
  }

  function sendRuleNotification(message, action) {
    statusElement.textContent = message;
    chrome.runtime.sendMessage({
      type: "POLYMAKR_NOTIFICATION",
      title: `Regra PolyMakr: ${action.toLowerCase()}`,
      message
    });
  }

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
    renderRuleList(rulesElement, rules, "rules");
    renderRuleList(favoritesElement, rules.filter((rule) => rule.favorite), "favorites");
  }

  function renderRuleList(container, list, view) {
    container.replaceChildren();
    if (list.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = view === "favorites" ? "Nenhuma regra favorita ainda." : "Nenhuma regra criada ainda.";
      container.append(empty);
      return;
    }

    for (const rule of list) {
      const row = document.createElement("div");
      row.className = "rule";
      const details = document.createElement("div");
      const title = document.createElement("div");
      title.className = "rule-title";
      const triggerPrice = Number(rule.triggerCents ?? rule.limitCents);
      const orderPrice = Number(rule.orderLimitCents ?? rule.limitCents);
      const action = document.createElement("span");
      action.textContent = `${rule.side === "buy" ? "Comprar" : "Vender"} `;
      const outcome = document.createElement("span");
      outcome.className = rule.outcome.toLowerCase() === "down" ? "outcome-down" : "outcome-up";
      outcome.textContent = rule.outcome;
      const prices = document.createElement("span");
      prices.textContent = ` · gatilho ${triggerPrice}¢ / ordem ${orderPrice}¢`;
      title.append(action, outcome, prices);
      const detail = document.createElement("div");
      detail.className = "rule-detail";
      const size = rule.shares === undefined
        ? (rule.side === "buy" ? `US$ ${rule.amount}` : `${rule.amount} shares`)
        : `${rule.shares} shares`;
      detail.textContent = `${rule.market} · ${size} · expira: Never`;
      const mode = document.createElement("div");
      mode.className = "rule-mode";
      mode.textContent = rule.executionMessage || modeLabel(rule.mode, rule.executionStatus);
      details.append(title, detail, mode);
      const actions = document.createElement("div");
      actions.className = "rule-actions";
      if (view === "favorites") {
        const useTemplate = document.createElement("button");
        useTemplate.type = "button";
        useTemplate.className = "use-template";
        useTemplate.textContent = "Usar modelo";
        useTemplate.addEventListener("click", () => useRuleTemplate(rule));
        actions.append(useTemplate);
      } else {
        const favorite = document.createElement("button");
        favorite.type = "button";
        favorite.className = "favorite";
        favorite.textContent = rule.favorite ? "★ Favorita" : "☆ Favoritar";
        favorite.addEventListener("click", () => updateFavorite(rule));
        actions.append(favorite);
        if (rule.executionStatus !== "queued" && rule.executionStatus !== "processing") {
          const edit = document.createElement("button");
          edit.type = "button";
          edit.className = "edit";
          edit.textContent = "Editar";
          edit.addEventListener("click", () => editRule(rule));
          actions.append(edit);
        }
      }

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete";
      remove.textContent = view === "favorites" ? "Desfavoritar" : "Remover";
      remove.addEventListener("click", async () => {
        if (view === "favorites") {
          await updateFavorite(rule, false);
          return;
        }
        const previous = rules;
        rules = rules.filter((item) => item.id !== rule.id);
        try {
          await persistRules();
          renderRules();
        } catch (error) {
          rules = previous;
          statusElement.textContent = `Não foi possível remover a regra: ${error.message || error}`;
          renderRules();
        }
      });
      actions.append(remove);
      row.append(details, actions);
      container.append(row);
    }
  }

  async function updateFavorite(rule, favorite = !rule.favorite) {
    const previous = rule.favorite;
    rule.favorite = favorite;
    try {
      await persistRules();
      renderRules();
    } catch (error) {
      rule.favorite = previous;
      statusElement.textContent = `Não foi possível salvar o favorito: ${error.message || error}`;
      renderRules();
    }
  }

  function editRule(rule) {
    if (rule.executionStatus === "queued" || rule.executionStatus === "processing") {
      statusElement.textContent = "Não é possível editar uma regra que está na fila ou em execução.";
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
    renderQuotes();
    updateRuleFormMode();
    statusElement.textContent = rule.executionStatus
      ? "A regra já foi executada; editar não a reativa."
      : "Edite os campos e salve para atualizar a regra.";
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
    renderQuotes();
    statusElement.classList.add("success");
    statusElement.textContent = quotes.some((quote) => quote.key === rule.quoteKey)
      ? "Modelo carregado. Salve para criar uma nova regra."
      : "Modelo carregado. Selecione o mercado atual antes de salvar.";
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

  const observer = new MutationObserver(updateOnMutation);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
})();
