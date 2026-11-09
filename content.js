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
          <p class="warning mode-note">A execução de ordens ainda não está conectada. Nesta versão, todos os modos apenas geram avisos; nenhuma ordem é enviada.</p>
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
  let rules = [];
  let quotes = [];
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
    const data = new FormData(form);
    const quote = quotes.find((item) => item.key === data.get("quote"));
    const triggerCents = Number(data.get("triggerCents"));
    const orderLimitCents = Number(data.get("orderLimitCents"));
    const shares = Number(data.get("shares"));

    if (!quote
      || !Number.isFinite(triggerCents) || triggerCents <= 0 || triggerCents >= 100
      || !Number.isFinite(orderLimitCents) || orderLimitCents <= 0 || orderLimitCents >= 100
      || !Number.isFinite(shares) || shares < 0.01) {
      statusElement.textContent = "Confira mercado, preços em centavos e quantidade de shares.";
      return;
    }

    const rule = {
      id: crypto.randomUUID(),
      market: quote.market,
      quoteKey: quote.key,
      outcome: quote.outcome,
      side: data.get("side"),
      trigger: data.get("trigger"),
      triggerCents,
      orderLimitCents,
      shares,
      expiration: data.get("expiration"),
      mode: data.get("mode"),
      enabled: true
    };

    rules = [...rules, rule];
    await chrome.storage.local.set({ [RULES_KEY]: rules });
    form.reset();
    statusElement.textContent = "Regra salva neste navegador.";
    renderRules();
  });

  function togglePanel() {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) {
      scan();
    }
    positionWidgets();
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
    scheduleNextScan();
  }

  function findTradingPanel() {
    const candidates = [...document.querySelectorAll("button,[role='button']")]
      .filter((button) => {
        const label = (button.innerText || button.textContent || "").replace(/\s+/g, " ").trim();
        return /^trade$/i.test(label) && isVisible(button);
      });

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

        const text = (node.innerText || "").replace(/\s+/g, " ").toLowerCase();
        if (/\bbuy\b/.test(text) && /\bsell\b/.test(text) && /\bshares?\b/.test(text)) {
          return rect;
        }
      }
    }

    return null;
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
      if (!rule.enabled || rule.quoteKey !== quote.key) {
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
      const modeNotice = rule.mode === "auto_limit"
        ? "Automação não conectada; ordem não enviada."
        : rule.mode === "confirm"
          ? "Confirmação não conectada."
          : "Somente alerta.";
      const message = `${verb} ${quote.outcome} em ${quote.market}: gatilho de ${limit}¢ atingido (preço observado ${quote.price}¢). Ordem limite configurada em ${orderPrice}¢, tamanho: ${size}. Expiração: Never. ${modeNotice}`;
      statusElement.textContent = message;
      chrome.runtime.sendMessage({
        type: "POLYMAKR_NOTIFICATION",
        title: `Regra PolyMakr: ${verb.toLowerCase()}`,
        message
      });
    }
  }

  function renderQuotes() {
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
      mode.textContent = modeLabel(rule.mode);
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

  function modeLabel(mode) {
    if (mode === "auto_limit") return "Automatizar ordem limite (não conectado)";
    if (mode === "confirm") return "Avisar e pedir confirmação (não conectado)";
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
