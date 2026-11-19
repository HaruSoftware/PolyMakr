function normalizeSharePriceParameter(parameter) {
  const threshold = Number(parameter.threshold);
  if (!["Up", "Down"].includes(parameter.outcome)
    || ![">", "<"].includes(parameter.comparison)
    || !Number.isFinite(threshold) || threshold <= 0 || threshold >= 100) return null;
  return {
    outcome: parameter.outcome,
    comparison: parameter.comparison,
    threshold
  };
}

function readSharePriceFields(data) {
  const rawThreshold = data.get("threshold");
  return {
    outcome: data.get("outcome"),
    comparison: data.get("comparison"),
    threshold: rawThreshold === "" ? NaN : Number(rawThreshold)
  };
}

function renderSharePriceFields(container, parameter = null) {
  const expression = document.createElement("div");
  expression.className = "execution-parameter-expression";
  const prefix = document.createElement("span");
  prefix.textContent = "Se";
  const subject = document.createElement("strong");
  subject.textContent = "Preço do share";

  const outcome = document.createElement("select");
  outcome.name = "outcome";
  for (const value of ["Up", "Down"]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value.toUpperCase();
    outcome.append(option);
  }
  outcome.value = parameter?.outcome || "Up";
  const outcomeLabel = document.createElement("label");
  outcomeLabel.textContent = "Resultado";
  outcomeLabel.append(outcome);

  const comparison = document.createElement("select");
  comparison.name = "comparison";
  for (const [value, label] of [[">", ">"], ["<", "<"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    comparison.append(option);
  }
  comparison.value = parameter?.comparison || ">";
  const comparisonLabel = document.createElement("label");
  comparisonLabel.textContent = "Condição";
  comparisonLabel.append(comparison);

  const threshold = document.createElement("input");
  threshold.name = "threshold";
  threshold.type = "number";
  threshold.min = "0.1";
  threshold.max = "99.9";
  threshold.step = "0.1";
  threshold.value = String(parameter?.threshold ?? 87);
  threshold.required = true;
  const thresholdLabel = document.createElement("label");
  thresholdLabel.textContent = "Preço (¢)";
  thresholdLabel.append(threshold);

  const fields = document.createElement("div");
  fields.className = "execution-parameter-expression-fields";
  fields.append(outcomeLabel, comparisonLabel, thresholdLabel);
  expression.append(prefix, subject, fields);
  container.append(expression);
}

function evaluateSharePriceParameter(parameter) {
  const matches = quotes.filter((quote) =>
    quoteMarketKey(quote) === activeMarketKey && quote.outcome === parameter.outcome
  );
  if (!activeMarketKey || matches.length !== 1 || !Number.isFinite(matches[0].price)) {
    const error = `Não foi possível identificar sem ambiguidade o preço de ${parameter.outcome}.`;
    return {
      state: "unknown",
      label: "Indisponível",
      title: error,
      error
    };
  }

  const price = matches[0].price;
  const satisfied = parameter.comparison === ">"
    ? price > parameter.threshold
    : price < parameter.threshold;
  const formattedPrice = `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1
  }).format(price)}¢`;
  const formattedThreshold = `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1
  }).format(parameter.threshold)}¢`;
  return {
    state: satisfied ? "blocking" : "released",
    label: satisfied ? "Bloqueando" : "Liberado",
    detail: formattedPrice,
    title: `${parameter.outcome} está em ${formattedPrice}; condição: ${parameter.outcome} ${parameter.comparison} ${formattedThreshold}.`
  };
}

function describeSharePriceParameter(parameter) {
  return `Se ${parameter.outcome} ${parameter.comparison} ${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1
  }).format(parameter.threshold)}¢.`;
}

registerExecutionParameterType("share_price", {
  label: "Preço do share",
  icon: "¢",
  helpText: "Bloqueie quando o preço de Up ou Down cruzar um limite.",
  normalize: normalizeSharePriceParameter,
  readFields: readSharePriceFields,
  renderFields: renderSharePriceFields,
  defaultName: (parameter) => `${parameter.outcome} ${parameter.comparison} ${parameter.threshold}¢`,
  describe: describeSharePriceParameter,
  evaluate: evaluateSharePriceParameter
});
