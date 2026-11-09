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
      .launcher {
        position: fixed; z-index: 2147483646; right: 20px; bottom: 20px;
        width: 52px; height: 52px; border: 0; border-radius: 50%;
        background: #087c3b; color: #fff; cursor: pointer;
        box-shadow: 0 6px 24px #0003; font: 800 17px Inter, system-ui, sans-serif;
      }
      .panel {
        position: fixed; z-index: 2147483647; right: 20px; bottom: 82px;
        display: none; width: min(390px, calc(100vw - 28px)); max-height: min(720px, calc(100vh - 110px));
        overflow: auto; border: 1px solid #dfe6e0; border-radius: 16px;
        background: #fff; color: #18211b; box-shadow: 0 12px 40px #0003;
        font: 13px/1.45 Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .panel.open { display: block; }
      .top { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between;
        align-items: center; padding: 14px 16px; border-bottom: 1px solid #edf0ed; background: #fff; }
      .top strong { font-size: 15px; }
      .top small { display: block; color: #78827b; font-size: 11px; }
      .close { border: 0; background: transparent; color: #59645d; cursor: pointer; font-size: 20px; }
      .section { padding: 13px 16px; border-bottom: 1px solid #edf0ed; }
      .section h2 { margin: 0 0 9px; font-size: 12px; }
      .quotes { display: grid; gap: 7px; max-height: 150px; overflow: auto; }
      .quote { display: flex; justify-content: space-between; gap: 10px; padding: 8px 9px;
        border-radius: 9px; background: #f5f7f5; }
      .quote-label { display: flex; min-width: 0; align-items: center; gap: 6px; }
      .market-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .outcome-tag { flex: 0 0 auto; padding: 2px 6px; border-radius: 999px;
        font-size: 10px; font-weight: 750; }
      .outcome-tag.up { background: #e4f5ea; color: #087c3b; }
      .outcome-tag.down { background: #fde9e8; color: #c4312b; }
      .price { flex: 0 0 auto; font-weight: 750; }
      .price.up, .outcome-up { color: #087c3b; }
      .price.down, .outcome-down { color: #c4312b; }
      .empty { color: #758078; font-size: 12px; }
      form { display: grid; gap: 9px; }
      label { display: grid; gap: 4px; color: #59645d; font-size: 11px; }
      input, select {
        width: 100%; min-width: 0; padding: 8px 9px; border: 1px solid #d9e0db;
        border-radius: 8px; background: #fff; color: #17211b; font: inherit; font-size: 12px;
      }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .primary { padding: 9px; border: 0; border-radius: 8px; background: #087c3b;
        color: #fff; cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; }
      .primary:hover { background: #056b31; }
      .hint { margin: 0; color: #78827b; font-size: 10px; line-height: 1.45; }
      .warning { padding: 9px; border-radius: 8px; background: #fff5e6; color: #7b4a00; font-size: 11px; }
      .rules { display: grid; gap: 8px; }
      .rule { display: grid; grid-template-columns: 1fr auto; gap: 6px 10px;
        padding: 9px; border: 1px solid #e6ebe7; border-radius: 9px; }
      .rule-title { font-weight: 700; }
      .rule-detail { color: #657168; font-size: 11px; }
      .rule-mode { color: #087c3b; font-size: 10px; font-weight: 700; }
      .delete { grid-row: span 2; align-self: center; border: 0; background: transparent;
        color: #a33b2e; cursor: pointer; font: inherit; font-size: 11px; }
      .status { min-height: 15px; margin: 0; color: #a33b2e; font-size: 11px; }
      .mode-note { color: #7b4a00; }
    </style>
    <button class="launcher" type="button" aria-label="Abrir PolyMakr">PM</button>
    <section class="panel" aria-label="Painel PolyMakr">
      <header class="top">
        <div><strong>PolyMakr</strong><small>Monitor de preços</small></div>
        <button class="close" type="button" aria-label="Fechar painel">×</button>
      </header>
      <div class="section">
        <h2>Preços encontrados na página</h2>
        <div class="quotes"></div>
      </div>
      <div class="section">
        <h2>Nova regra</h2>
        <form>
          <label>Mercado e resultado<select name="quote" required></select></label>
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
          <p class="warning mode-note">Também é possível configurar a automação na aba Auto, junto de Buy e Sell no cartão de negociação.</p>
          <button class="primary" type="submit">Salvar regra</button>
          <p class="status" role="status"></p>
        </form>
      </div>
      <div class="section">
        <h2>Regras salvas</h2>
        <div class="rules"></div>
      </div>
      <div class="section"><p class="hint">Os preços são lidos dos botões visíveis do Polymarket. Ao recarregar ou mudar de mercado, confira se a regra continua associada ao resultado certo.</p></div>
    </section>
  `;

  const panel = shadow.querySelector(".panel");
  const quotesElement = shadow.querySelector(".quotes");
  const quoteSelect = shadow.querySelector('[name="quote"]');
  const rulesElement = shadow.querySelector(".rules");
  const form = shadow.querySelector("form");
  const statusElement = shadow.querySelector(".status");
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
  const firedRules = new Set();
  let scanTimer;
  let mutationScanScheduled = false;
  let tradingPanelRect = null;

  shadow.querySelector(".launcher").addEventListener("click", togglePanel);
  shadow.querySelector(".close").addEventListener("click", togglePanel);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "POLYMAKR_TOGGLE_PANEL") {
      togglePanel();
    }
  });

  chrome.storage.local.get({ [RULES_KEY]: [] }, (stored) => {
    rules = stored[RULES_KEY];
    renderRules();
    scan();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveRule(new FormData(form), statusElement, form, "notify");
  });

  function togglePanel() {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) {
      scan();
    }
    positionWidgets();
  }

  async function saveRule(data, ruleStatus, ruleForm, defaultMode) {
    const quote = quotes.find((item) => item.key === data.get("quote"));
    const triggerCents = Number(data.get("triggerCents"));
    const orderLimitCents = Number(data.get("orderLimitCents"));
    const shares = Number(data.get("shares"));
    const side = data.get("side")
      || (normalizedText(lastNativeTradeSide) === "sell" ? "sell" : "buy");

    if (!quote
      || !Number.isFinite(triggerCents) || triggerCents <= 0 || triggerCents >= 100
      || !Number.isFinite(orderLimitCents) || orderLimitCents <= 0 || orderLimitCents >= 100
      || !Number.isFinite(shares) || shares < 0.01) {
      ruleStatus.classList.remove("success");
      ruleStatus.textContent = "Confira mercado, preços em centavos e quantidade de shares.";
      return;
    }

    const rule = {
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
      enabled: true
    };

    rules = [...rules, rule];
    try {
      await chrome.storage.local.set({ [RULES_KEY]: rules });
    } catch (error) {
      rules = rules.filter((item) => item.id !== rule.id);
      ruleStatus.classList.remove("success");
      ruleStatus.textContent = `Não foi possível salvar a regra: ${error.message || error}`;
      return;
    }

    if (ruleForm) {
      if (ruleForm === form) {
        ruleForm.reset();
      }
    }
    ruleStatus.classList.add("success");
    ruleStatus.textContent = "Regra salva neste navegador.";
    renderRules();
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
    tradingPanelRect = findTradingPanel();
    positionWidgets();

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
    syncAutoTradeTab();
    scheduleNextScan();
  }

  function findTradingPanel() {
    return findTradingPanelElement()?.getBoundingClientRect() || null;
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0
      && rect.height > 0
      && style.display !== "none"
      && style.visibility !== "hidden";
  }

  function positionWidgets() {
    const launcher = shadow.querySelector(".launcher");
    const gap = 12;

    if (!tradingPanelRect) {
      launcher.style.right = "20px";
      launcher.style.top = "auto";
      launcher.style.bottom = "20px";
      panel.style.left = "auto";
      panel.style.right = "20px";
      panel.style.top = "auto";
      panel.style.bottom = "82px";
      return;
    }

    const launcherTop = Math.min(
      Math.max(8, tradingPanelRect.top + 8),
      Math.max(8, window.innerHeight - launcher.offsetHeight - 8)
    );
    const launcherRight = Math.max(8, window.innerWidth - tradingPanelRect.left + gap);
    launcher.style.right = `${launcherRight}px`;
    launcher.style.top = `${launcherTop}px`;
    launcher.style.bottom = "auto";

    if (!panel.classList.contains("open")) {
      return;
    }

    const panelWidth = panel.getBoundingClientRect().width || 390;
    const panelHeight = panel.getBoundingClientRect().height || 600;
    const leftOfCard = tradingPanelRect.left - panelWidth - gap;
    if (leftOfCard >= 8) {
      panel.style.left = `${leftOfCard}px`;
      panel.style.right = "auto";
    } else {
      panel.style.left = "auto";
      panel.style.right = `${Math.max(8, window.innerWidth - tradingPanelRect.right + gap)}px`;
    }

    const top = Math.min(
      Math.max(8, tradingPanelRect.top),
      Math.max(8, window.innerHeight - panelHeight - 8)
    );
    panel.style.top = `${top}px`;
    panel.style.bottom = "auto";
  }

  function scheduleNextScan() {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, 1000);
  }

  function checkRules(quote, previous) {
    for (const rule of rules) {
      if (!rule.enabled || rule.executionStatus || rule.quoteKey !== quote.key) {
        continue;
      }
      const limit = Number(rule.triggerCents ?? rule.limitCents);
      const isCrossed = rule.trigger === "rises"
        ? previous < limit && quote.price >= limit
        : rule.trigger === "falls"
          ? previous > limit && quote.price <= limit
          : (previous < limit && quote.price >= limit) || (previous > limit && quote.price <= limit);
      if (!isCrossed || firedRules.has(rule.id)) {
        continue;
      }

      firedRules.add(rule.id);
      const verb = rule.side === "buy" ? "Comprar" : "Vender";
      const size = rule.shares === undefined
        ? (rule.side === "buy" ? `US$ ${rule.amount}` : `${rule.amount} shares`)
        : `${rule.shares} shares`;
      const orderPrice = Number(rule.orderLimitCents ?? rule.limitCents);
      const summary = `${verb} ${quote.outcome} em ${quote.market}: gatilho de ${limit}¢ atingido (preço observado ${quote.price}¢). Ordem limite configurada em ${orderPrice}¢, tamanho: ${size}. Expiração: Never.`;
      if (rule.mode === "auto_limit") {
        startAutomaticOrder(rule, quote, summary).catch((error) => {
          recordAutomaticOrderFailure(rule, error);
        });
        continue;
      }

      const modeNotice = rule.mode === "confirm"
        ? "Confirmação não conectada; somente aviso."
        : "Somente alerta.";
      sendRuleNotification(`${summary} ${modeNotice}`, verb);
    }
  }

  async function startAutomaticOrder(rule, quote, summary) {
    rule.executionStatus = "processing";
    await chrome.storage.local.set({ [RULES_KEY]: rules });
    renderRules();

    await executeLimitOrder(rule, quote);

    rule.executionStatus = "clicked";
    rule.executionMessage = "Clique em Trade enviado; confira o status da ordem no Polymarket.";
    await chrome.storage.local.set({ [RULES_KEY]: rules });
    renderRules();
    sendRuleNotification(`${summary} Clique em Trade enviado. Confira a ordem no Polymarket e confirme a carteira se solicitado.`, rule.side === "buy" ? "Comprar" : "Vender");
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
    const selectedQuoteKey = quoteSelect.value;
    quotesElement.replaceChildren();
    quoteSelect.replaceChildren();

    if (quotes.length === 0) {
      quotesElement.innerHTML = '<p class="empty">Nenhum botão Up/Down com preço em centavos foi detectado. Abra um mercado com esses botões.</p>';
      quoteSelect.add(new Option("Aguardando preços…", ""));
      return;
    }

    for (const quote of quotes) {
      const row = document.createElement("div");
      row.className = `quote ${quote.outcome.toLowerCase()}`;
      const description = document.createElement("span");
      description.className = "quote-label";
      const market = document.createElement("span");
      market.className = "market-name";
      market.textContent = quote.market;
      const outcome = document.createElement("span");
      outcome.className = `outcome-tag ${quote.outcome.toLowerCase()}`;
      outcome.textContent = quote.outcome;
      description.append(market, outcome);
      const price = document.createElement("span");
      price.className = `price ${quote.outcome.toLowerCase()}`;
      price.textContent = `${quote.price}¢`;
      row.append(description, price);
      quotesElement.append(row);
      const option = new Option(`${quote.market} · ${quote.outcome} — ${quote.price}¢`, quote.key);
      option.style.color = quote.outcome.toLowerCase() === "down" ? "#c4312b" : "#087c3b";
      quoteSelect.add(option);
    }

    if (quotes.some((quote) => quote.key === selectedQuoteKey)) {
      quoteSelect.value = selectedQuoteKey;
    }
  }

  function renderRules() {
    rulesElement.replaceChildren();
    if (rules.length === 0) {
      rulesElement.innerHTML = '<p class="empty">Nenhuma regra configurada.</p>';
      return;
    }

    for (const rule of rules) {
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
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete";
      remove.textContent = "Remover";
      remove.addEventListener("click", async () => {
        rules = rules.filter((item) => item.id !== rule.id);
        firedRules.delete(rule.id);
        await chrome.storage.local.set({ [RULES_KEY]: rules });
        renderRules();
      });
      row.append(details, remove);
      rulesElement.append(row);
    }
  }

  function modeLabel(mode, executionStatus) {
    if (executionStatus === "processing") return "Tentativa em andamento; confira no Polymarket";
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
  window.addEventListener("resize", positionWidgets);
  window.addEventListener("scroll", positionWidgets, true);
})();
