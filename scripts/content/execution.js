function scan() {
  const next = new Map();
  for (const button of document.querySelectorAll("button,[role='button']")) {
    const label = [
      button.innerText,
      button.textContent,
      button.getAttribute("aria-label"),
      button.getAttribute("title")
    ].filter(Boolean).join(" ");
    if (!/\b(Up|Down)\s*[0-9]{1,3}(?:[.,][0-9]{1,2})?\s*¢/i.test(label)) {
      continue;
    }
    if (!isVisible(button)) {
      continue;
    }
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
  scanTimer = window.setTimeout(scan, 300);
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
    rule.executionMessage = rule.queuePolicy === "independent"
      ? "Gatilho atingido; aguardando execução independente."
      : "Gatilho atingido; aguardando sua vez na fila.";
    queued.push(rule);
  }

  if (queued.length) {
    renderRules();
    persistRules().catch((error) => {
      for (const rule of queued) {
        rule.executionStatus = "failed";
        rule.executionMessage = `Não foi possível registrar a regra na fila; ela não foi executada: ${error.message || error}`;
      }
      showToast("Falha ao salvar a fila", "Nenhuma nova regra foi executada. Confira o armazenamento local.", "error");
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
      const rule = findNextQueuedRule();
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
        showToast("Não foi possível iniciar a regra", rule.executionMessage, "error");
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
        renderRules();
        sendRuleNotification(`A regra não foi concluída: ${rule.executionMessage}`, "Execução não concluída");
      }
    }
  } catch (error) {
    showToast("Falha na fila de regras", error.message || String(error), "error");
  } finally {
    queueWorkerRunning = false;
  }
}

function findNextQueuedRule() {
  const independentRule = rules.find((rule) =>
    rule.enabled !== false
    && rule.queuePolicy === "independent"
    && rule.executionStatus === "queued"
    && quotes.some((quote) => quote.key === rule.quoteKey)
  );
  if (independentRule) return independentRule;

  const firstOrderedRule = rules.find((rule) =>
    rule.enabled !== false
    && rule.queuePolicy !== "independent"
    && !["completed", "failed", "clicked"].includes(rule.executionStatus)
  );
  return firstOrderedRule?.executionStatus === "queued"
    && quotes.some((quote) => quote.key === firstOrderedRule.quoteKey)
    ? firstOrderedRule
    : null;
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
  sendRuleNotification(message, "Automação não concluída");
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
