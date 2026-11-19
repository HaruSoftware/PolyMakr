let executionParameterMarketTime = {
  marketKey: "",
  state: "unavailable",
  endDate: null,
  error: "",
  checkedAt: 0
};
let executionParameterMarketTimeRequest = null;
let lastExecutionParameterErrorAt = 0;

function normalizeMarketTimeParameter(parameter) {
  const seconds = Number(parameter.seconds);
  if (!Number.isSafeInteger(seconds) || seconds < 0
    || ![">=", "<="].includes(parameter.comparison)) return null;
  return {
    comparison: parameter.comparison,
    seconds
  };
}

function evaluateMarketTimeParameter(parameter) {
  if (executionParameterMarketTime.state !== "ready"
    || executionParameterMarketTime.marketKey !== activeMarketKey
    || !Number.isFinite(executionParameterMarketTime.endDate)) {
    return {
      state: "unknown",
      label: "Indisponível",
      title: executionParameterMarketTime.error || "Abra um mercado para consultar o tempo restante.",
      error: executionParameterMarketTime.error
    };
  }
  const remainingSeconds = Math.max(0,
    Math.ceil((executionParameterMarketTime.endDate - Date.now()) / 1000));
  const satisfied = parameter.comparison === ">="
    ? remainingSeconds >= parameter.seconds
    : remainingSeconds <= parameter.seconds;
  return {
    state: satisfied ? "blocking" : "released",
    label: satisfied ? "Bloqueando" : "Liberado",
    remainingSeconds,
    title: `Restam ${remainingSeconds} segundo(s). ${describeMarketTimeParameter(parameter)}`
  };
}

function describeMarketTimeParameter(parameter) {
  const effectLabel = { block: "bloquear", block_buy: "bloquear compras", block_sell: "bloquear vendas", block_both: "bloquear compras e vendas" }[parameter.effect] || "bloquear";
  return `Se tempo restante ${parameter.comparison} ${parameter.seconds} segundos: ${effectLabel}.`;
}

function renderMarketTimeFields(container, parameter = null) {
  const expression = document.createElement("div");
  expression.className = "execution-parameter-expression";
  const prefix = document.createElement("span");
  prefix.textContent = "Se";
  const subject = document.createElement("strong");
  subject.textContent = "Tempo";
  const comparison = document.createElement("select");
  comparison.name = "comparison";
  for (const [value, label] of [["<=", "≤"], [">=", "≥"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    comparison.append(option);
  }
  comparison.value = parameter?.comparison || "<=";
  const comparisonLabel = document.createElement("label");
  comparisonLabel.textContent = "Comparação";
  comparisonLabel.append(comparison);
  const seconds = document.createElement("input");
  seconds.name = "seconds";
  seconds.type = "number";
  seconds.min = "0";
  seconds.step = "1";
  seconds.value = String(parameter?.seconds ?? 60);
  seconds.required = true;
  const secondsLabel = document.createElement("label");
  secondsLabel.textContent = "Segundos";
  secondsLabel.append(seconds);
  const fields = document.createElement("div");
  fields.className = "execution-parameter-expression-fields";
  fields.append(comparisonLabel, secondsLabel);
  expression.append(prefix, subject, fields);
  container.append(expression);
}

function readMarketTimeFields(data) {
  const rawSeconds = data.get("seconds");
  return {
    comparison: data.get("comparison"),
    seconds: rawSeconds === "" ? NaN : Number(rawSeconds)
  };
}

function summarizeMarketTimeParameters(parameters) {
  const blockingParameters = parameters.filter((parameter) => ["block", "block_buy", "block_sell", "block_both"].includes(parameter.effect));
  if (!blockingParameters.length) return null;
  if (!activeMarketKey) {
    return { text: "Abra um mercado", error: false };
  }
  if (executionParameterMarketTime.marketKey !== activeMarketKey
    || executionParameterMarketTime.state === "unavailable"
    || executionParameterMarketTime.state === "loading") {
    return { text: "Consultando tempo do mercado…", error: false };
  }
  if (executionParameterMarketTime.state !== "ready") {
    return {
      text: "Tempo indisponível · regras opt-in bloqueadas",
      title: executionParameterMarketTime.error,
      error: true
    };
  }
  const remainingSeconds = Math.max(0,
    Math.ceil((executionParameterMarketTime.endDate - Date.now()) / 1000));
  const blockingCount = blockingParameters.filter((parameter) =>
    evaluateMarketTimeParameter(parameter).state === "blocking"
  ).length;
  return {
    text: `Restam ${remainingSeconds}s · ${blockingCount ? `${blockingCount} bloqueando` : "liberado"}`,
    title: `Encerramento previsto: ${new Date(executionParameterMarketTime.endDate).toLocaleString()}. O tempo restante é calculado com este horário.`,
    error: blockingCount > 0
  };
}

function resetMarketTimeParameter(marketKey) {
  executionParameterMarketTime = {
    marketKey,
    state: "unavailable",
    endDate: null,
    error: "",
    checkedAt: 0
  };
  executionParameterMarketTimeRequest = null;
}

async function refreshMarketTimeParameter() {
  if (!executionParameters.some((parameter) =>
    parameter.type === "market_time" && ["block", "block_buy", "block_sell", "block_both"].includes(parameter.effect)
  )) {
    executionParameterMarketTime = {
      marketKey: activeMarketKey,
      state: "unavailable",
      endDate: null,
      error: "",
      checkedAt: Date.now()
    };
    return executionParameterMarketTime;
  }
  if (!activeMarketKey) {
    executionParameterMarketTime = {
      marketKey: "",
      state: "unavailable",
      endDate: null,
      error: "",
      checkedAt: Date.now()
    };
    return executionParameterMarketTime;
  }
  if (executionParameterMarketTime.marketKey !== activeMarketKey) {
    resetMarketTimeParameter(activeMarketKey);
  }
  if (executionParameterMarketTimeRequest?.marketKey === activeMarketKey) {
    return executionParameterMarketTimeRequest.promise;
  }
  if (["ready", "error"].includes(executionParameterMarketTime.state)
    && executionParameterMarketTime.checkedAt
    && Date.now() - executionParameterMarketTime.checkedAt < 30000) {
    return executionParameterMarketTime;
  }

  const marketKey = activeMarketKey;
  const reference = quotes[0] || rules.find((rule) => rule.marketKey === marketKey);
  executionParameterMarketTime = {
    marketKey,
    state: "loading",
    endDate: null,
    error: "",
    checkedAt: 0
  };
  const request = (async () => {
    try {
      if (!reference?.marketSlug || !reference.marketRoute || !reference.outcome) {
        throw new Error("Não foi possível identificar o mercado ativo para consultar seu encerramento.");
      }
      const marketData = await resolveMarketTradingData(reference);
      if (!Number.isFinite(marketData.endDate) || marketData.endDate <= 0) {
        throw new Error("O mercado não informou um horário de encerramento preciso.");
      }
      const result = {
        marketKey,
        state: "ready",
        endDate: marketData.endDate,
        error: "",
        checkedAt: Date.now()
      };
      if (activeMarketKey === marketKey) executionParameterMarketTime = result;
      return result;
    } catch (error) {
      const message = error.message || String(error);
      const result = {
        marketKey,
        state: "error",
        endDate: null,
        error: message,
        checkedAt: Date.now()
      };
      if (activeMarketKey === marketKey) {
        executionParameterMarketTime = result;
        if (Date.now() - lastExecutionParameterErrorAt >= 30000) {
          lastExecutionParameterErrorAt = Date.now();
          showToast("Parâmetro sem tempo do mercado", message, "error");
        }
      }
      return result;
    }
  })();
  executionParameterMarketTimeRequest = { marketKey, promise: request };
  try {
    return await request;
  } finally {
    if (executionParameterMarketTimeRequest?.promise === request) {
      executionParameterMarketTimeRequest = null;
    }
  }
}

registerExecutionParameterType("market_time", {
  label: "Tempo do mercado",
  icon: "clock",
  helpText: "Conta até o encerramento previsto.",
  normalize: normalizeMarketTimeParameter,
  readFields: readMarketTimeFields,
  renderFields: renderMarketTimeFields,
  defaultName: (parameter, effect) => {
    const effectLabel = { block: "Bloquear", block_buy: "Bloquear Compras", block_sell: "Bloquear Vendas", block_both: "Bloquear Ambos" }[effect] || "Bloquear";
    return `Tempo ${parameter.comparison} ${parameter.seconds}s · ${effectLabel}`;
  },
  describe: describeMarketTimeParameter,
  evaluate: evaluateMarketTimeParameter,
  refresh: refreshMarketTimeParameter,
  marketChanged: resetMarketTimeParameter,
  summarize: summarizeMarketTimeParameters
});