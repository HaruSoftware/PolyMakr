const MARKET_ANALYSIS_SAMPLE_INTERVAL = 1500;
const MARKET_ANALYSIS_HISTORY_LIMIT = 500;
const MARKET_ANALYSIS_BOOK_INTERVAL = 15000;
const MARKET_ANALYSIS_WINDOW = 5 * 60 * 1000;
let marketAnalysisKey = "";
let marketAnalysisHistory = [];
let marketAnalysisBooks = null;
let marketAnalysisBookFetchedAt = 0;
let marketAnalysisStatus = "";
let marketAnalysisStatusIsError = false;
let marketAnalysisLastSampleAt = 0;
let marketAnalysisRefreshRunning = false;
let marketAnalysisActive = false;
let marketAnalysisTimer = null;

function observeMarketAnalysisQuotes(currentQuotes, currentMarketKey) {
  if (currentMarketKey !== marketAnalysisKey) {
    marketAnalysisKey = currentMarketKey;
    marketAnalysisHistory = [];
    marketAnalysisBooks = null;
    marketAnalysisBookFetchedAt = 0;
    marketAnalysisLastSampleAt = 0;
    marketAnalysisStatus = currentMarketKey ? "Coletando cotações observadas nesta sessão." : "";
    marketAnalysisStatusIsError = false;
  }
  if (!currentMarketKey) return;

  const up = currentQuotes.find((quote) => quote.outcome === "Up");
  const down = currentQuotes.find((quote) => quote.outcome === "Down");
  if (!up || !down || !Number.isFinite(up.price) || !Number.isFinite(down.price)) return;

  const now = Date.now();
  if (now - marketAnalysisLastSampleAt >= MARKET_ANALYSIS_SAMPLE_INTERVAL) {
    marketAnalysisHistory.push({ at: now, up: up.price, down: down.price });
    marketAnalysisHistory = marketAnalysisHistory.slice(-MARKET_ANALYSIS_HISTORY_LIMIT);
    marketAnalysisLastSampleAt = now;
    if (marketAnalysisActive) renderMarketAnalysis();
  }
}

function startMarketAnalysis() {
  marketAnalysisActive = true;
  renderMarketAnalysis();
  refreshMarketAnalysisBook();
}

function stopMarketAnalysis() {
  marketAnalysisActive = false;
  window.clearTimeout(marketAnalysisTimer);
  marketAnalysisTimer = null;
}

async function refreshMarketAnalysisBook() {
  if (marketAnalysisRefreshRunning) return;
  window.clearTimeout(marketAnalysisTimer);
  marketAnalysisTimer = null;
  marketAnalysisRefreshRunning = true;
  const refreshButton = shadow.querySelector(".analysis-refresh");
  refreshButton.disabled = true;
  try {
    const up = quotes.find((quote) => quote.outcome === "Up" && quoteMarketKey(quote) === activeMarketKey);
    const down = quotes.find((quote) => quote.outcome === "Down" && quoteMarketKey(quote) === activeMarketKey);
    if (!activeMarketKey || !up || !down) {
      marketAnalysisStatus = "Abra um mercado com resultados Up e Down para carregar a análise.";
      marketAnalysisStatusIsError = false;
      return;
    }

    const marketData = await resolveMarketTradingData(up);
    const tokenIds = marketData.outcomeAssets || {};
    if (!marketData.conditionId || !/^\d+$/.test(String(tokenIds.up || ""))
      || !/^\d+$/.test(String(tokenIds.down || ""))) {
      throw new Error("O mercado não forneceu identificadores válidos para os resultados Up e Down.");
    }
    const [upBook, downBook] = await Promise.all([
      fetchSimulationBook(tokenIds.up),
      fetchSimulationBook(tokenIds.down)
    ]);
    if (activeMarketKey !== marketAnalysisKey || quoteMarketKey(up) !== activeMarketKey) return;
    marketAnalysisBooks = { Up: upBook, Down: downBook };
    marketAnalysisBookFetchedAt = Date.now();
    marketAnalysisStatus = "Livro de ofertas atualizado.";
    marketAnalysisStatusIsError = false;
  } catch (error) {
    marketAnalysisStatus = `Não foi possível atualizar o livro de ofertas: ${error.message || String(error)}`;
    marketAnalysisStatusIsError = true;
  } finally {
    marketAnalysisRefreshRunning = false;
    refreshButton.disabled = false;
    if (marketAnalysisActive) {
      renderMarketAnalysis();
      marketAnalysisTimer = window.setTimeout(() => {
        if (marketAnalysisActive) refreshMarketAnalysisBook();
      }, MARKET_ANALYSIS_BOOK_INTERVAL);
    }
  }
}

function renderMarketAnalysis() {
  const title = shadow.querySelector(".analysis-market-title");
  const status = shadow.querySelector(".analysis-status");
  const up = quotes.find((quote) => quote.outcome === "Up" && quoteMarketKey(quote) === activeMarketKey);
  const down = quotes.find((quote) => quote.outcome === "Down" && quoteMarketKey(quote) === activeMarketKey);
  title.textContent = up?.marketTitle || up?.market || "Abra um mercado com resultados Up/Down.";

  const fearValue = shadow.querySelector('[data-analysis-value="fear"]');
  const movementValue = shadow.querySelector('[data-analysis-value="movement"]');
  const trendValue = shadow.querySelector('[data-analysis-value="trend"]');
  const rangeValue = shadow.querySelector('[data-analysis-value="range"]');
  const now = Date.now();
  const windowSamples = marketAnalysisHistory.filter((sample) =>
    sample.at >= now - MARKET_ANALYSIS_WINDOW
  );
  const first = windowSamples[0];
  const last = windowSamples[windowSamples.length - 1];

  fearValue.textContent = down ? `${down.price.toFixed(1)}¢ · ${down.price.toFixed(1)}%` : "—";
  if (first && last && first !== last) {
    const movement = last.up - first.up;
    const observedPeriod = formatMarketAnalysisDuration(last.at - first.at);
    shadow.querySelector('[data-analysis-value="movement"]').previousElementSibling.textContent =
      `Movimento Up · ${observedPeriod}`;
    shadow.querySelector('[data-analysis-value="range"]').previousElementSibling.textContent =
      `Amplitude Up · ${observedPeriod}`;
    trendValue.previousElementSibling.textContent = `Tendência Up · ${observedPeriod}`;
    movementValue.textContent = `${movement > 0 ? "+" : ""}${movement.toFixed(1)} pp`;
    movementValue.className = movement > 0 ? "analysis-up" : movement < 0 ? "analysis-down" : "";
    shadow.querySelector('[data-analysis-detail="movement"]').textContent =
      `Up: ${first.up.toFixed(1)}¢ → ${last.up.toFixed(1)}¢ no período observado.`;
    const direction = movement >= 0.3 ? "Alta ↑" : movement <= -0.3 ? "Baixa ↓" : "Lateral";
    trendValue.textContent = direction;
    trendValue.className = movement >= 0.3 ? "analysis-up" : movement <= -0.3 ? "analysis-down" : "";
    shadow.querySelector('[data-analysis-detail="trend"]').textContent =
      `Variação de ${movement > 0 ? "+" : ""}${movement.toFixed(1)} pp no período observado.`;
    const values = windowSamples.map((sample) => sample.up);
    rangeValue.textContent = `${(Math.max(...values) - Math.min(...values)).toFixed(1)} pp`;
  } else {
    movementValue.textContent = "Coletando…";
    movementValue.className = "";
    trendValue.textContent = "Coletando…";
    trendValue.className = "";
    trendValue.previousElementSibling.textContent = "Tendência Up · janela observada";
    rangeValue.textContent = "—";
    shadow.querySelector('[data-analysis-value="movement"]').previousElementSibling.textContent =
      "Movimento Up · janela observada";
    shadow.querySelector('[data-analysis-value="range"]').previousElementSibling.textContent =
      "Amplitude Up · janela observada";
    trendValue.previousElementSibling.textContent = "Tendência Up · janela observada";
    shadow.querySelector('[data-analysis-detail="movement"]').textContent =
      "São necessárias ao menos duas observações.";
    shadow.querySelector('[data-analysis-detail="trend"]').textContent =
      "A tendência aparece após observar o mercado por algum tempo.";
  }

  status.textContent = marketAnalysisStatusIsError
    ? marketAnalysisStatus
    : !activeMarketKey
      ? "Abra um mercado com resultados Up e Down para carregar a análise."
      : marketAnalysisBookFetchedAt
        ? `Cotações observadas na página · livro atualizado às ${new Date(marketAnalysisBookFetchedAt).toLocaleTimeString("pt-BR")}.`
        : "Cotações observadas na página · aguardando atualização do livro.";
  status.classList.toggle("error", marketAnalysisStatusIsError);
  renderMarketAnalysisChart(windowSamples, now);
  shadow.querySelector(".analysis-sample-count").textContent =
    `${windowSamples.length} ${windowSamples.length === 1 ? "observação" : "observações"} na janela`;
  renderMarketAnalysisBooks();
}

function renderMarketAnalysisChart(samples, now) {
  const chart = shadow.querySelector(".analysis-chart");
  const upPath = chart.querySelector(".analysis-chart-up");
  const downPath = chart.querySelector(".analysis-chart-down");
  if (samples.length < 2) {
    upPath.setAttribute("d", "");
    downPath.setAttribute("d", "");
    return;
  }

  const windowStart = now - MARKET_ANALYSIS_WINDOW;
  const makePath = (outcome) => samples.map((sample, index) => {
    const x = 40 + ((sample.at - windowStart) / MARKET_ANALYSIS_WINDOW) * 550;
    const y = 150 - (sample[outcome] / 100) * 130;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  upPath.setAttribute("d", makePath("up"));
  downPath.setAttribute("d", makePath("down"));
}

function renderMarketAnalysisBooks() {
  for (const outcome of ["Up", "Down"]) {
    const card = shadow.querySelector(`[data-analysis-book="${outcome}"]`);
    const book = marketAnalysisBooks?.[outcome];
    const spreadValue = card.querySelector('[data-book-value="spread"]');
    const quotesValue = card.querySelector('[data-book-value="quotes"]');
    const depthValue = card.querySelector('[data-book-value="depth"]');
    const imbalanceValue = card.querySelector('[data-book-value="imbalance"]');
    if (!book) {
      quotesValue.textContent = "—";
      spreadValue.textContent = "—";
      depthValue.textContent = "—";
      imbalanceValue.textContent = "—";
      continue;
    }

    const bid = book.bids[0];
    const ask = book.asks[0];
    quotesValue.textContent = bid && ask
      ? `${(bid.price * 100).toFixed(1)}¢ / ${(ask.price * 100).toFixed(1)}¢`
      : "Sem bid ou ask";
    spreadValue.textContent = bid && ask
      ? `${((ask.price - bid.price) * 100).toFixed(1)}¢`
      : "—";
    const bidDepth = marketAnalysisDepth(book.bids);
    const askDepth = marketAnalysisDepth(book.asks);
    depthValue.textContent = `${formatMarketAnalysisUsd(bidDepth)} / ${formatMarketAnalysisUsd(askDepth)}`;
    const totalDepth = bidDepth + askDepth;
    const imbalance = totalDepth > 0 ? ((bidDepth - askDepth) / totalDepth) * 100 : null;
    imbalanceValue.textContent = imbalance === null
      ? "Sem profundidade"
      : `${imbalance > 0 ? "+" : ""}${imbalance.toFixed(1)}% ${imbalance > 0 ? "mais bids" : imbalance < 0 ? "mais asks" : "equilibrado"}`;
  }
}

function marketAnalysisDepth(levels) {
  return levels.slice(0, 5).reduce((total, level) => total + level.price * level.size, 0);
}

function formatMarketAnalysisUsd(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

function formatMarketAnalysisDuration(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  return minutes > 0 ? `${minutes} min` : `${Math.max(1, Math.floor(milliseconds / 1000))} s`;
}
