let marketValueDifferenceSnapshot = {
  marketKey: "",
  checkedAt: 0,
  currentPrice: null,
  priceToBeat: null,
  error: ""
};

function normalizeValueDifferenceParameter(parameter) {
  const threshold = Number(parameter.threshold);
  if (!Number.isFinite(threshold)
    || ![">=", "<="].includes(parameter.comparison)
    || !["absolute", "percentage"].includes(parameter.unit)) return null;
  return {
    comparison: parameter.comparison,
    threshold,
    unit: parameter.unit
  };
}

function readValueDifferenceFields(data) {
  const rawThreshold = data.get("threshold");
  return {
    comparison: data.get("comparison"),
    threshold: rawThreshold === "" ? NaN : Number(rawThreshold),
    unit: data.get("unit")
  };
}

function renderValueDifferenceFields(container, parameter = null) {
  const expression = document.createElement("div");
  expression.className = "execution-parameter-expression";
  const prefix = document.createElement("span");
  prefix.textContent = "Se";
  const subject = document.createElement("strong");
  subject.textContent = "Diferença de valor";

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

  const threshold = document.createElement("input");
  threshold.name = "threshold";
  threshold.type = "number";
  threshold.step = "any";
  threshold.value = String(parameter?.threshold ?? 0);
  threshold.required = true;
  const thresholdLabel = document.createElement("label");
  thresholdLabel.textContent = "Limite (com sinal)";
  thresholdLabel.append(threshold);

  const unit = document.createElement("select");
  unit.name = "unit";
  for (const [value, label] of [["absolute", "Valor (US$)"], ["percentage", "Percentual (%)"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    unit.append(option);
  }
  unit.value = parameter?.unit || "absolute";
  const unitLabel = document.createElement("label");
  unitLabel.textContent = "Unidade";
  unitLabel.append(unit);

  expression.append(prefix, subject, comparisonLabel, thresholdLabel, unitLabel);
  container.append(expression);
}

function parseDisplayedMarketUsd(value) {
  const match = String(value || "").replace(/\u00a0/g, " ").trim()
    .match(/^\$\s*(-?[\d,]+(?:\.\d+)?)$/);
  if (!match) return null;
  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function readLabeledMarketPrice(labels) {
  for (const labelText of labels) {
    const labelNodes = [...document.querySelectorAll("span,div")].filter((element) =>
      element.childElementCount === 0
      && element.textContent.trim().toLowerCase() === labelText.toLowerCase()
      && isVisible(element)
    );
    if (!labelNodes.length) continue;

    for (const label of labelNodes) {
      let ancestor = label.parentElement;
      for (let depth = 0; ancestor && depth < 6; depth += 1, ancestor = ancestor.parentElement) {
        const prices = [...ancestor.querySelectorAll("span,div")]
          .filter((element) => element !== label
            && element.childElementCount === 0
            && isVisible(element))
          .map((element) => parseDisplayedMarketUsd(element.textContent))
          .filter((value) => value !== null);
        const uniquePrices = [...new Set(prices)];
        if (uniquePrices.length === 1) return uniquePrices[0];
      }
    }
    return null;
  }
  return null;
}

function readMarketValueDifference() {
  if (marketValueDifferenceSnapshot.marketKey === activeMarketKey
    && Date.now() - marketValueDifferenceSnapshot.checkedAt < 250) {
    return marketValueDifferenceSnapshot;
  }
  const currentPrice = readLabeledMarketPrice(["Current price", "Final price"]);
  const priceToBeat = readLabeledMarketPrice(["Price To Beat"]);
  marketValueDifferenceSnapshot = {
    marketKey: activeMarketKey,
    checkedAt: Date.now(),
    currentPrice,
    priceToBeat,
    error: currentPrice === null || priceToBeat === null || priceToBeat <= 0
      ? "Não foi possível ler, sem ambiguidade, o preço atual e o Price To Beat do mercado ativo."
      : ""
  };
  return marketValueDifferenceSnapshot;
}

function formatValueDifference(value, unit, signed = true) {
  if (unit === "percentage") {
    return `${new Intl.NumberFormat("pt-BR", {
      signDisplay: signed ? "always" : "auto",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(value)}%`;
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    signDisplay: signed ? "always" : "auto",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value);
}

function valueDifferenceResult(parameter) {
  const prices = readMarketValueDifference();
  if (prices.error) return { state: "unknown", error: prices.error };
  const absoluteDifference = Number((prices.currentPrice - prices.priceToBeat).toFixed(2));
  const difference = parameter.unit === "percentage"
    ? Number(((absoluteDifference / prices.priceToBeat) * 100).toFixed(8))
    : absoluteDifference;
  const satisfied = parameter.comparison === ">="
    ? difference >= parameter.threshold
    : difference <= parameter.threshold;
  const detail = formatValueDifference(difference, parameter.unit);
  return {
    state: satisfied ? "blocking" : "released",
    label: satisfied ? "Bloqueando" : "Liberado",
    difference,
    detail,
    title: `Preço atual ${formatValueDifference(prices.currentPrice, "absolute", false)}; Price To Beat ${formatValueDifference(prices.priceToBeat, "absolute", false)}; diferença (atual − Price To Beat) ${detail}. ${describeValueDifferenceParameter(parameter)}`
  };
}

function describeValueDifferenceParameter(parameter) {
  return `Se diferença (preço atual − Price To Beat) ${parameter.comparison} ${formatValueDifference(parameter.threshold, parameter.unit)}: ${parameter.effect === "block" ? "bloquear" : "não bloquear"}.`;
}

function summarizeValueDifferenceParameters(parameters) {
  const blockingParameters = parameters.filter((parameter) => parameter.effect === "block");
  if (!blockingParameters.length) return null;
  const prices = readMarketValueDifference();
  if (prices.error) {
    return {
      text: "Diferença indisponível · regras opt-in bloqueadas",
      title: prices.error,
      error: true
    };
  }
  const absoluteDifference = Number((prices.currentPrice - prices.priceToBeat).toFixed(2));
  const percentageDifference = Number(((absoluteDifference / prices.priceToBeat) * 100).toFixed(8));
  const blockingCount = blockingParameters.filter((parameter) =>
    valueDifferenceResult(parameter).state === "blocking"
  ).length;
  return {
    text: `${formatValueDifference(absoluteDifference, "absolute")} / ${formatValueDifference(percentageDifference, "percentage")} · ${blockingCount ? `${blockingCount} bloqueando` : "liberado"}`,
    title: `Preço atual ${formatValueDifference(prices.currentPrice, "absolute", false)}; Price To Beat ${formatValueDifference(prices.priceToBeat, "absolute", false)}. Diferença calculada como preço atual menos Price To Beat.`,
    error: blockingCount > 0
  };
}

function resetValueDifferenceSnapshot(marketKey) {
  marketValueDifferenceSnapshot = {
    marketKey,
    checkedAt: 0,
    currentPrice: null,
    priceToBeat: null,
    error: ""
  };
}

registerExecutionParameterType("value_difference", {
  label: "Diferença de valor",
  icon: "±",
  helpText: "Preço atual menos Price To Beat, com sinal.",
  normalize: normalizeValueDifferenceParameter,
  readFields: readValueDifferenceFields,
  renderFields: renderValueDifferenceFields,
  defaultName: (parameter, effect) =>
    `Diferença ${parameter.comparison} ${formatValueDifference(parameter.threshold, parameter.unit)} · ${effect === "block" ? "Bloquear" : "Não bloquear"}`,
  describe: describeValueDifferenceParameter,
  evaluate: (parameter) => {
    const result = valueDifferenceResult(parameter);
    if (result.state === "unknown") {
      return {
        state: "unknown",
        label: "Indisponível",
        title: result.error,
        error: result.error
      };
    }
    return result;
  },
  marketChanged: resetValueDifferenceSnapshot,
  summarize: summarizeValueDifferenceParameters
});
