async function scan() {
  const activeQuotes = getInlineQuotes();
  const marketKeys = new Set(activeQuotes.map(quoteMarketKey));
  const nextMarketKey = marketKeys.size === 1 ? [...marketKeys][0] : "";
  const next = new Map((marketKeys.size === 1 ? activeQuotes : []).map((quote) => [quote.key, quote]));
  const marketChanged = nextMarketKey !== activeMarketKey;

  quotes = marketKeys.size === 1 ? [...next.values()] : [];
  if (marketChanged) {
    activeMarketKey = nextMarketKey;
    previousPrices.clear();
    try {
      executionStates = activeMarketKey ? await loadExecutionStates(activeMarketKey) : {};
    } catch (error) {
      showToast("Não foi possível carregar o estado das regras", error.message || String(error), "error");
      scheduleNextScan();
      return;
    }
    renderRules();
  }

  for (const [key, quote] of next) {
    const previous = previousPrices.get(key);
    if (!marketChanged && previous !== undefined && previous !== quote.price) {
      await checkRules(quote, previous);
    }
  }

  previousPrices.clear();
  for (const [key, quote] of next) {
    previousPrices.set(key, quote.price);
  }
  renderQuotes();
  if (Object.values(executionStates).some((state) =>
    ["queued", "completed", "failed", "clicked", "awaiting_fill", "partially_filled", "filled"].includes(state.status)
  )) {
    await processRuleQueue();
  }
  scheduleNextScan();
}

function quoteMarketKey(quote) {
  return quote.key.slice(0, quote.key.lastIndexOf("|"));
}

function executionStorageKey(marketKey) {
  return `${EXECUTION_STATE_PREFIX}${encodeURIComponent(marketKey)}`;
}

function executionLockName(marketKey) {
  return `polymakr-execution-${marketKey}`;
}

async function loadExecutionStates(marketKey) {
  if (!marketKey) return {};
  const key = executionStorageKey(marketKey);
  const stored = await chrome.storage.local.get(key);
  const states = stored[key];
  return states && typeof states === "object" && !Array.isArray(states) ? states : {};
}

async function hasPendingRuleExecution(ruleId) {
  const stored = await chrome.storage.local.get(null);
  return Object.keys(stored).some((key) =>
    key.startsWith(EXECUTION_STATE_PREFIX)
    && ["queued", "processing"].includes(stored[key]?.[ruleId]?.status)
  );
}

async function saveExecutionStates(marketKey, states) {
  await chrome.storage.local.set({ [executionStorageKey(marketKey)]: states });
  if (marketKey === activeMarketKey) {
    executionStates = states;
    renderRules();
  }
}

async function withMarketExecutionLock(marketKey, callback) {
  if (!marketKey || !navigator.locks?.request) {
    throw new Error("Não foi possível coordenar a execução desta regra entre abas do Polymarket.");
  }
  return navigator.locks.request(executionLockName(marketKey), callback);
}

async function migrateMarketAgnosticStorage() {
  if (!navigator.locks?.request) {
    throw new Error("O navegador não oferece coordenação segura entre abas para migrar as regras.");
  }
  return navigator.locks.request("polymakr-market-rule-migration", async () => {
    const allStored = await chrome.storage.local.get(null);
    if (allStored[EXECUTION_SCHEMA_KEY] === 2) return allStored;

    const migratedRules = Array.isArray(allStored[RULES_KEY]) ? allStored[RULES_KEY] : [];
    const migratedFavorites = Array.isArray(allStored[FAVORITES_KEY]) ? allStored[FAVORITES_KEY] : [];
    const changes = {};
    for (const rule of migratedRules) {
      if (rule.quoteKey) {
        const marketKey = rule.quoteKey.slice(0, rule.quoteKey.lastIndexOf("|"));
        rule.marketKey = rule.marketKey || marketKey;
        const storageKey = executionStorageKey(marketKey);
        const states = changes[storageKey] || allStored[storageKey] || {};
        if (rule.executionStatus) {
          states[rule.id] = {
            status: rule.executionStatus === "processing" ? "failed" : rule.executionStatus,
            message: rule.executionStatus === "processing"
              ? "Execução interrompida durante a atualização. Confira o Polymarket antes de tentar novamente."
              : rule.executionMessage || "",
            triggeredPrice: rule.triggeredPrice,
            updatedAt: Date.now()
          };
        }
        changes[storageKey] = states;
      }
      delete rule.market;
      delete rule.quoteKey;
      delete rule.executionStatus;
      delete rule.executionMessage;
      delete rule.triggeredPrice;
    }
    for (const favorite of migratedFavorites) {
      delete favorite.market;
      delete favorite.quoteKey;
    }
    changes[RULES_KEY] = migratedRules;
    changes[FAVORITES_KEY] = migratedFavorites;
    changes[EXECUTION_SCHEMA_KEY] = 2;
    await chrome.storage.local.set(changes);
    return { ...allStored, ...changes };
  });
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
  scanTimer = window.setTimeout(scan, 300);
}

async function checkRules(quote, previous) {
  const marketKey = quoteMarketKey(quote);
  await withMarketExecutionLock(marketKey, async () => {
    const states = await loadExecutionStates(marketKey);
    const triggered = [];
    for (const rule of rules) {
      if (rule.enabled === false || states[rule.id]?.status
        || rule.marketKey !== marketKey || rule.outcome !== quote.outcome) continue;
      const limit = Number(rule.triggerCents ?? rule.limitCents);
      const crossed = rule.trigger === "rises"
        ? previous < limit && quote.price >= limit
        : rule.trigger === "falls"
          ? previous > limit && quote.price <= limit
          : (previous < limit && quote.price >= limit) || (previous > limit && quote.price <= limit);
      if (!crossed) continue;
      states[rule.id] = {
        status: "queued",
        triggeredPrice: quote.price,
        message: rule.queuePolicy === "independent"
          ? "Gatilho atingido; aguardando execução independente."
          : "Gatilho atingido; aguardando sua vez na fila.",
        updatedAt: Date.now()
      };
      triggered.push(rule);
    }
    if (triggered.length) await saveExecutionStates(marketKey, states);
    await processQueuedRulesLocked(marketKey, states);
  }).catch((error) => {
    showToast("Falha na fila de regras", error.message || String(error), "error");
  });
}

async function processRuleQueue() {
  if (!activeMarketKey || queueWorkerRunning) return;
  queueWorkerRunning = true;
  try {
    await withMarketExecutionLock(activeMarketKey, async () => {
      const states = await loadExecutionStates(activeMarketKey);
      await processQueuedRulesLocked(activeMarketKey, states);
    });
  } catch (error) {
    showToast("Falha na fila de regras", error.message || String(error), "error");
  } finally {
    queueWorkerRunning = false;
  }
}

async function processQueuedRulesLocked(marketKey, states) {
  let recoveredInterruptedExecution = false;
  for (const state of Object.values(states)) {
    if (state.status !== "processing") continue;
    state.status = "failed";
    state.message = "Execução interrompida; confira o Polymarket antes de criar outra regra.";
    state.updatedAt = Date.now();
    recoveredInterruptedExecution = true;
  }
  if (recoveredInterruptedExecution) await saveExecutionStates(marketKey, states);

  for (const rule of [...rules]) {
    const state = states[rule.id];
    if (!state || !["completed", "failed", "clicked", "awaiting_fill", "partially_filled", "filled"].includes(state.status)) continue;
    const archiveStatus = state.status === "clicked"
      || (state.status === "completed" && rule.mode === "auto_limit" && !state.conditionId)
      ? "submitted_untracked"
      : state.status;
    try {
      await moveRuleToArchive(rule, archiveStatus, state.message, {
        triggeredPrice: state.triggeredPrice,
        submittedAt: state.submittedAt,
        conditionId: state.conditionId,
        assetId: state.assetId,
        baselineTradeKeys: state.baselineTradeKeys,
        matchedTradeKeys: state.matchedTradeKeys || [],
        matchedShares: state.matchedShares || 0
      });
    } catch (error) {
      showToast("Não foi possível mover a regra para o Registro", error.message || String(error), "error");
    }
  }

  while (true) {
    const rule = findNextQueuedRule(states);
    if (!rule) return;
    const quote = quotes.find((item) => item.outcome === rule.outcome);
    if (!quote || quoteMarketKey(quote) !== marketKey) return;

    states[rule.id] = {
      ...states[rule.id],
      status: "processing",
      message: "Execução em andamento.",
      updatedAt: Date.now()
    };
    try {
      await saveExecutionStates(marketKey, states);
    } catch (error) {
      states[rule.id] = {
        ...states[rule.id],
        status: "failed",
        message: `Não foi possível registrar o início da execução; a regra não foi executada: ${error.message || error}`,
        updatedAt: Date.now()
      };
      try {
        await saveExecutionStates(marketKey, states);
      } catch (storageError) {
        states[rule.id].message += ` Também não foi possível salvar o estado: ${storageError.message || storageError}.`;
        if (marketKey === activeMarketKey) {
          executionStates = states;
          renderRules();
        }
      }
      showToast("Não foi possível iniciar a regra", states[rule.id].message, "error");
      return;
    }

    const summary = ruleSummary(rule, quote, states[rule.id]);
    let orderWasSent = false;
    let actionCompleted = false;
    let trackingDetails = null;
    try {
      if (rule.mode === "auto_limit") {
        trackingDetails = await executeLimitOrder(rule, quote);
        orderWasSent = true;
        states[rule.id] = {
          ...states[rule.id],
          ...trackingDetails,
          status: "awaiting_fill",
          message: "Trade enviado; aguardando um preenchimento compatível na atividade pública da carteira.",
          updatedAt: Date.now()
        };
        await saveExecutionStates(marketKey, states);
        await moveRuleToArchive(rule, "awaiting_fill", states[rule.id].message, {
          triggeredPrice: states[rule.id].triggeredPrice,
          ...trackingDetails,
          matchedShares: 0,
          matchedTradeKeys: []
        });
        sendRuleNotification(`${summary} Trade enviado; aguardando confirmação de fills na carteira.`, rule.side === "buy" ? "Comprar" : "Vender");
        continue;
      } else {
        const notice = rule.mode === "confirm"
          ? "Confirmação não conectada; somente aviso."
          : "Somente alerta.";
        states[rule.id].message = "Concluída — aviso enviado.";
        sendRuleNotification(`${summary} ${notice}`, rule.side === "buy" ? "Comprar" : "Vender");
        actionCompleted = true;
      }
      states[rule.id].status = "completed";
      states[rule.id].updatedAt = Date.now();
      await saveExecutionStates(marketKey, states);
      await moveRuleToArchive(rule, "completed", states[rule.id].message, {
        triggeredPrice: states[rule.id].triggeredPrice
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Falha inesperada ao executar a regra.";
      states[rule.id].status = orderWasSent ? "awaiting_fill" : actionCompleted ? "completed" : "failed";
      states[rule.id].message = orderWasSent
        ? `Trade enviado; erro ao salvar o acompanhamento: ${reason}. Verifique a carteira.`
        : actionCompleted
          ? `Ação executada; erro ao salvar o registro: ${reason}.`
          : `${reason} Confira o Polymarket antes de criar outra regra. A regra não será repetida automaticamente.`;
      states[rule.id].updatedAt = Date.now();
      try {
        await saveExecutionStates(marketKey, states);
        if (!orderWasSent && !actionCompleted) {
          await moveRuleToArchive(rule, "failed", states[rule.id].message, {
            triggeredPrice: states[rule.id].triggeredPrice
          });
        } else if (trackingDetails) {
          await moveRuleToArchive(rule, "awaiting_fill", states[rule.id].message, {
            triggeredPrice: states[rule.id].triggeredPrice,
            ...trackingDetails,
            matchedShares: 0,
            matchedTradeKeys: []
          });
        } else if (actionCompleted) {
          await moveRuleToArchive(rule, "completed", states[rule.id].message, {
            triggeredPrice: states[rule.id].triggeredPrice
          });
        }
      } catch (storageError) {
        states[rule.id].message += ` Também não foi possível salvar o estado: ${storageError.message || storageError}.`;
      }
      sendRuleNotification(`A regra não foi concluída: ${states[rule.id].message}`, "Execução não concluída");
    }
  }
}

function findNextQueuedRule(states) {
  const independentRule = rules.find((rule) =>
    rule.enabled !== false
    && rule.queuePolicy === "independent"
    && rule.marketKey === activeMarketKey
    && states[rule.id]?.status === "queued"
    && quotes.some((quote) => quote.outcome === rule.outcome)
  );
  if (independentRule) return independentRule;

  const firstOrderedRule = rules.find((rule) =>
    rule.enabled !== false
    && rule.marketKey === activeMarketKey
    && rule.queuePolicy !== "independent"
    && !["completed", "failed", "clicked", "awaiting_fill", "partially_filled", "filled"].includes(states[rule.id]?.status)
  );
  return states[firstOrderedRule?.id]?.status === "queued"
    && quotes.some((quote) => quote.outcome === firstOrderedRule.outcome)
    ? firstOrderedRule
    : null;
}

function ruleSummary(rule, quote, state) {
  const verb = rule.side === "buy" ? "Comprar" : "Vender";
  const trigger = Number(rule.triggerCents ?? rule.limitCents);
  const orderPrice = Number(rule.orderLimitCents ?? rule.limitCents);
  const size = rule.shares === undefined
    ? (rule.side === "buy" ? `US$ ${rule.amount}` : `${rule.amount} shares`)
    : `${rule.shares} shares`;
  const observed = Number(state.triggeredPrice ?? quote.price);
  return `${verb} ${quote.outcome} em ${quote.market}: gatilho de ${trigger}¢ atingido (preço observado ${observed}¢). Ordem limite configurada em ${orderPrice}¢, tamanho: ${size}. Expiração: Never.`;
}

async function executeLimitOrder(rule, quote) {
  if (autoModeActive) {
    setAutoMode(false);
  }

  if (autoModeActive) {
    setAutoMode(false);
  }

  if (!["buy", "sell"].includes(rule.side)
    || !/^0x[a-fA-F0-9]{40}$/.test(rule.walletAddress || "")
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
    || !currentQuote || currentQuote.key !== quote.key
    || quoteMarketKey(currentQuote) !== activeMarketKey
    || currentQuote.outcome !== rule.outcome) {
    throw new Error("O botão do resultado no mercado ativo não está mais disponível.");
  }

  const marketData = await resolveMarketTradingData(rule);

  let panel = await openTradingPanelForQuote(quote);

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
  const baselineTrades = await loadBaselineTrades(rule, marketData);
  panel = findTradingPanelElement();
  const currentTradeButton = panel && findExactControl(panel, "Trade");
  if (!currentTradeButton || currentTradeButton.disabled) {
    throw new Error("O botão Trade deixou de estar disponível enquanto os trades eram consultados.");
  }
  const submittedAt = Date.now();
  currentTradeButton.click();
  const baselineTradeKeys = baselineTrades
    .filter((trade) => tradeTimestampMs(trade) >= Math.floor(submittedAt / 1000) * 1000 - 1000)
    .map(publicTradeKey);
  return {
    submittedAt,
    walletAddress: rule.walletAddress.toLowerCase(),
    conditionId: marketData.conditionId,
    assetId: marketData.assetId,
    baselineTradeKeys
  };
}

async function resolveMarketTradingData(rule) {
  if (!rule.marketSlug || !["market", "event"].includes(rule.marketRoute)) {
    throw new Error("Não foi possível identificar o slug do mercado para acompanhar os fills.");
  }
  const route = rule.marketRoute === "market" ? "markets" : "events";
  const response = await fetch(`https://gamma-api.polymarket.com/${route}/slug/${encodeURIComponent(rule.marketSlug)}`);
  if (!response.ok) {
    throw new Error(`O Polymarket não retornou os dados do mercado (${response.status}).`);
  }
  const result = await response.json();
  const markets = rule.marketRoute === "event"
    ? (Array.isArray(result) ? result.flatMap((event) => event.markets || []) : result.markets || [])
    : [result];
  const question = normalizeMarketLabel(rule.marketTitle || "");
  const exactMatches = markets.filter((market) => normalizeMarketLabel(market.question || "") === question);
  const candidates = exactMatches.length ? exactMatches : markets.length === 1 ? markets : [];
  if (candidates.length !== 1) {
    throw new Error("Não foi possível associar este resultado a um único mercado do Polymarket.");
  }
  const market = candidates[0];
  const outcomes = parseMarketArray(market.outcomes);
  const assetIds = market.version === "v2"
    ? parseMarketArray(market.positionIds)
    : parseMarketArray(market.clobTokenIds);
  const outcomeIndex = outcomes.findIndex((outcome) => normalizeMarketLabel(outcome) === normalizeMarketLabel(rule.outcome));
  if (!market.conditionId || outcomeIndex < 0 || !assetIds[outcomeIndex]) {
    throw new Error("O mercado não forneceu identificadores válidos para acompanhar o resultado escolhido.");
  }
  return { conditionId: market.conditionId, assetId: String(assetIds[outcomeIndex]) };
}

function parseMarketArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeMarketLabel(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

async function loadBaselineTrades(rule, marketData) {
  const url = new URL("https://data-api.polymarket.com/v2/trades");
  url.searchParams.set("user", rule.walletAddress.toLowerCase());
  url.searchParams.set("condition", marketData.conditionId);
  url.searchParams.set("limit", "100");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Não foi possível consultar os trades públicos da carteira (${response.status}).`);
  }
  const result = await response.json();
  if (!Array.isArray(result.data)) {
    throw new Error("A resposta de trades públicos do Polymarket está em formato inesperado.");
  }
  return result.data
    .filter((trade) => String(trade.token_id) === marketData.assetId
      && String(trade.side).toLowerCase() === rule.side);
}

function tradeTimestampMs(trade) {
  const timestamp = Number(trade.timestamp);
  return timestamp < 1e12 ? timestamp * 1000 : timestamp;
}

function publicTradeKey(trade) {
  return [
    trade.transaction_hash,
    trade.timestamp,
    trade.token_id,
    trade.side,
    trade.size,
    trade.price
  ].join("|");
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

function verifySelectedQuote(quote) {
  const selected = [...document.querySelectorAll("button[role='radio']")]
    .find((button) => button.getAttribute("aria-checked") === "true"
      && parseQuoteButton(button)?.key === quote.key);
  if (!selected || parseQuoteButton(selected)?.outcome !== quote.outcome) {
    throw new Error("Não foi possível confirmar a seleção do resultado da regra.");
  }
}

async function openTradingPanelForQuote(quote) {
  quote.element.click();
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    await waitForPageUpdate();
    const panel = findTradingPanelElement();
    if (panel) {
      verifySelectedQuote(quote);
      return panel;
    }
  }
  throw new Error("Não foi possível abrir o formulário de ordem após selecionar o resultado.");
}

function findTradingPanelElement() {
  if (autoModeActive && autoLayoutPanel?.isConnected) {
    return autoLayoutPanel;
  }

  const candidates = [...document.querySelectorAll("button,[role='button']")]
    .filter((button) => normalizedText(button) === "trade" && isVisible(button));
  const panels = new Set();

  for (const tradeButton of candidates) {
    let node = tradeButton.parentElement;
    for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
      if (!isVisible(node)) {
        continue;
      }

      if (findExactControls(node, "Buy").length === 1
        && findExactControls(node, "Sell").length === 1
        && findOutcomeGroup(node)) {
        panels.add(node);
        break;
      }
    }
  }

  return panels.size === 1 ? [...panels][0] : null;
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

function sendRuleNotification(message, action) {
  const isFailure = /falh|não foi concluída|não foi conclu[ií]da/i.test(action) || /não foi concluída|não foi executada/i.test(message);
  showToast(action, message, isFailure ? "error" : "success", 9000);
  chrome.runtime.sendMessage({
    type: "POLYMAKR_NOTIFICATION",
    title: `Regra PolyMakr: ${action.toLowerCase()}`,
    message
  }).then((response) => {
    if (response?.error) {
      showToast("Notificação do navegador indisponível", response.error, "warning");
    }
  }).catch((error) => {
    showToast("Notificação do navegador indisponível", error.message || String(error), "warning");
  });
}
