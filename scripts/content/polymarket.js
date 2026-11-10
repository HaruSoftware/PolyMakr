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
        <div class="prices" aria-label="Selecionar resultado"></div>
        <form>
          <select name="quote" aria-label="Resultado" hidden></select>
          <div class="row">
            <label>Condição<select name="trigger"><option value="reaches">Atingir o preço</option><option value="rises">Subir até o preço</option><option value="falls">Cair até o preço</option></select></label>
            <label>Quantidade (shares)<input name="shares" type="number" min="0.01" step="0.01" placeholder="ex.: 5" required></label>
          </div>
          <div class="row">
            <label>Disparar em (¢)<input name="triggerCents" type="number" min="0.1" max="99.9" step="0.1" placeholder="ex.: 50" required></label>
            <label>Preço limite (¢)<input name="orderLimitCents" type="number" min="0.1" max="99.9" step="0.1" placeholder="ex.: 50" required></label>
          </div>
          <label>Ordem de execução<select name="queuePolicy"><option value="ordered">Respeitar a fila</option><option value="independent">Executar ao atingir o gatilho, mesmo fora da ordem</option></select></label>
          <button class="save" type="submit">Salvar automação</button>
          <p class="status" role="status"></p>
          <p class="hint">O gatilho é definido manualmente; ao atingi-lo, a regra envia uma ordem limite no mercado desta página.</p>
        </form>
      </section>`;

    inlineAutoForm = inlineAutoRoot.querySelector("form");
    inlineAutoForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const side = lastNativeTradeSide ? normalizedText(lastNativeTradeSide) : "";
      if (!["buy", "sell"].includes(side)) {
        showToast("Selecione uma ação", "Selecione Buy ou Sell no painel de negociação antes de salvar a regra.", "warning");
        return;
      }
      const data = new FormData(inlineAutoForm);
      data.set("side", side);
      await saveRule(data, inlineAutoForm, "auto_limit");
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
  const groups = [...tradingPanel.querySelectorAll("[role='radiogroup']")]
    .filter((group) => {
      const buttons = [...group.querySelectorAll("button,[role='radio']")].filter(isVisible);
      return buttons.some((button) => parseQuoteButton(button)?.outcome === "Up")
        && buttons.some((button) => parseQuoteButton(button)?.outcome === "Down");
    });
  return groups.length === 1 ? groups[0] : null;
}

function getInlineQuotes() {
  const tradingPanel = findTradingPanelElement();
  const outcomeGroup = tradingPanel && findOutcomeGroup(tradingPanel);
  if (!outcomeGroup) {
    return [];
  }
  const quotes = [...outcomeGroup.querySelectorAll("button,[role='radio']")]
    .map((button) => {
      const quote = parseQuoteButton(button);
      return quote ? { ...quote, element: button } : null;
    })
    .filter(Boolean);
  const marketKeys = new Set(quotes.map((quote) => quote.key.slice(0, quote.key.lastIndexOf("|"))));
  if (quotes.length !== 2
    || marketKeys.size !== 1
    || quotes.filter((quote) => quote.outcome === "Up").length !== 1
    || quotes.filter((quote) => quote.outcome === "Down").length !== 1) {
    return [];
  }
  return quotes;
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
    quoteSelect.add(new Option("Aguardando mercado…", ""));
    return;
  }

  for (const quote of currentQuotes) {
    const option = new Option(quote.outcome, quote.key);
    quoteSelect.add(option);

    const priceButton = document.createElement("button");
    priceButton.type = "button";
    priceButton.className = `price ${quote.outcome.toLowerCase()}`;
    priceButton.textContent = quote.outcome;
    priceButton.setAttribute("aria-label", quote.outcome);
    priceButton.setAttribute("aria-pressed", String(quote.key === (selectedKey || selectedNativeQuote?.key)));
    priceButton.addEventListener("click", () => {
      quoteSelect.value = quote.key;
      selectNativeQuote(quote.key);
      renderInlineAutoQuotes();
    });
    prices.append(priceButton);
  }

  quoteSelect.value = currentQuotes.some((quote) => quote.key === selectedKey)
    ? selectedKey
    : selectedNativeQuote?.key || currentQuotes[0].key;
}

function selectNativeQuote(quoteKey) {
  const quote = getInlineQuotes().find((item) => item.key === quoteKey);
  if (quote && quote.element.getAttribute("aria-checked") !== "true") {
    quote.element.click();
  }
}

function parseQuoteButton(button) {
  const text = [
    button.innerText,
    button.textContent,
    button.getAttribute("aria-label"),
    button.getAttribute("title")
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
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
  const pageTitle = (document.querySelector("h1")?.innerText || "").replace(/\s+/g, " ").trim();
  const linkTitle = (link?.innerText || "").replace(/\s+/g, " ").trim();
  const localHeading = (heading?.innerText || "").replace(/\s+/g, " ").trim();
  const market = linkTitle
    || localHeading
    || pageTitle
    || document.title;
  const marketPaths = [location.pathname, link?.getAttribute("href")]
    .filter(Boolean)
    .map((path) => new URL(path, location.origin).pathname.replace(/\/+$/, ""));
  const key = marketPaths.sort((left, right) =>
    right.split("/").length - left.split("/").length
  )[0] || market.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return { market: market.slice(0, 100), key };
}
