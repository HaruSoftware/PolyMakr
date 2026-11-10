const HOST_ID = "polymakr-extension-root";
const RULES_KEY = "polymakr.rules";
const FAVORITES_KEY = "polymakr.favorites";
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
      display: none; width: min(1040px, calc(100vw - 28px)); max-height: min(760px, calc(100vh - 32px));
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
    .tabs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; padding: 10px 16px; border-bottom: 1px solid #edf0ed; }
    .tab { padding: 8px; border: 0; border-radius: 8px; background: transparent; color: #657168; cursor: pointer; font: inherit; font-size: 12px; font-weight: 650; }
    .tab[aria-selected="true"] { background: #e8f4ec; color: #087c3b; }
    .view { display: none; max-height: min(620px, calc(100vh - 150px)); overflow: auto; padding: 18px; }
    [data-panel="create"] form { max-width: 560px; margin: 0 auto; }
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
    .board { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; align-items: start; }
    .board-lane { min-width: 0; min-height: 220px; padding: 9px; border: 1px solid #e6ebe7; border-radius: 12px; background: #f7f9f7; transition: background .15s, border-color .15s; }
    .board-lane.drag-over { border-color: #087c3b; background: #e8f4ec; }
    .lane-heading { display: flex; align-items: center; justify-content: space-between; gap: 5px; margin: 0 0 9px; font-size: 12px; font-weight: 750; }
    .lane-count { flex: 0 0 auto; padding: 2px 6px; border-radius: 999px; background: #e9eeea; color: #59645d; font-size: 9px; }
    .rules, .favorites { display: grid; gap: 7px; min-height: 170px; }
    .rule, .template { position: relative; display: grid; gap: 8px; padding: 9px; border: 1px solid #e1e7e2; border-radius: 9px; background: #fff; box-shadow: 0 2px 6px #17211b08; cursor: grab; }
    .rule:active, .template:active { cursor: grabbing; }
    .rule[aria-grabbed="true"], .template[aria-grabbed="true"] { opacity: .5; }
    .rule.drop-before { border-top: 2px solid #087c3b; }
    .rule.drop-after { border-bottom: 2px solid #087c3b; }
    .rule-header, .template-header { display: flex; min-width: 0; align-items: flex-start; justify-content: space-between; gap: 6px; }
    .rule-heading, .template-heading { min-width: 0; overflow: hidden; }
    .rule-title, .template-title { overflow: hidden; font-size: 11px; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
    .rule-subtitle, .template-subtitle { overflow: hidden; margin-top: 2px; color: #657168; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
    .rule-top-actions { display: flex; flex: 0 0 auto; align-items: flex-start; gap: 4px; }
    .action-icon { display: inline-grid; width: 20px; height: 20px; place-items: center; border-radius: 6px; background: #f1f3f1; color: #59645d; font-size: 12px; font-weight: 800; }
    .action-icon.buy { background: #e8f4ec; color: #087c3b; }
    .action-icon.sell { background: #fde9e8; color: #a33b2e; }
    .action-icon.auto_limit { background: #e8efff; color: #3156a8; }
    .action-icon.confirm { background: #fff3d8; color: #8a5a00; }
    .more { position: relative; flex: 0 0 auto; }
    .more summary { display: grid; width: 24px; height: 24px; place-items: center; border-radius: 6px; color: #59645d; cursor: pointer; font-size: 18px; font-weight: 800; line-height: 1; list-style: none; }
    .more summary::-webkit-details-marker { display: none; }
    .more[open] summary, .more summary:hover { background: #f1f3f1; }
    .more-popup { position: absolute; z-index: 3; top: 27px; right: 0; display: grid; width: min(250px, calc(100vw - 80px)); max-height: 300px; gap: 8px; overflow: auto; padding: 10px; border: 1px solid #dfe6e0; border-radius: 10px; background: #fff; box-shadow: 0 8px 24px #17211b24; cursor: default; }
    .more-info { display: grid; gap: 4px; color: #59645d; font-size: 10px; overflow-wrap: anywhere; }
    .more-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
    .more-metrics .rule-metric { padding: 6px; }
    .more-actions { display: grid; gap: 5px; }
    .more-actions button { padding: 6px 7px; border: 1px solid #e1e6e2; border-radius: 6px; background: #fff; color: #435047; cursor: pointer; font: inherit; font-size: 10px; font-weight: 650; text-align: left; }
    .more-actions button:disabled { cursor: not-allowed; opacity: .55; }
    .more-actions .delete { color: #a33b2e; }
    .more-actions .use-template { color: #805300; }
    .rule-drag-hint { color: #8a948d; font-size: 9px; }
    .state-chip { flex: 0 0 auto; padding: 4px 8px; border-radius: 999px; background: #eef1ef; color: #566158; font-size: 10px; font-weight: 750; }
    .state-chip.queued { background: #fff3d8; color: #8a5a00; }
    .state-chip.processing { background: #e8efff; color: #3156a8; }
    .state-chip.completed { background: #e4f5ea; color: #087c3b; }
    .state-chip.failed { background: #fde9e8; color: #a33b2e; }
    .rule-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
    .rule-metric { padding: 8px; border-radius: 8px; background: #f5f7f5; }
    .rule-metric span { display: block; color: #78827b; font-size: 9px; }
    .rule-metric strong { display: block; margin-top: 2px; font-size: 11px; }
    .rule-mode { color: #657168; font-size: 10px; line-height: 1.4; }
    .rule-metric { min-width: 0; padding: 6px; overflow: hidden; }
    .rule-metric strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .toast-stack { position: fixed; z-index: 2147483648; top: 16px; right: 16px; display: grid; width: min(380px, calc(100vw - 32px)); gap: 10px; pointer-events: none; color: #18211b; font: 13px/1.45 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .toast { display: grid; grid-template-columns: 32px 1fr auto; gap: 10px; align-items: start; padding: 13px; border: 1px solid #e1e7e2; border-radius: 12px; background: #fff; color: #18211b; box-shadow: 0 10px 32px #0002; pointer-events: auto; animation: toast-in .18s ease-out; }
    @keyframes toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    .toast-icon { display: grid; width: 30px; height: 30px; place-items: center; border-radius: 9px; background: #e8f4ec; color: #087c3b; font-size: 15px; font-weight: 800; }
    .toast.error .toast-icon { background: #fde9e8; color: #a33b2e; }
    .toast.warning .toast-icon { background: #fff3d8; color: #8a5a00; }
    .toast-title { font-size: 12px; font-weight: 750; }
    .toast-message { margin-top: 3px; color: #59645d; font-size: 11px; line-height: 1.4; overflow-wrap: anywhere; }
    .toast-close { padding: 0 2px; border: 0; background: transparent; color: #78827b; cursor: pointer; font: inherit; font-size: 16px; }
    .favorite-dialog-backdrop { position: fixed; z-index: 2147483649; inset: 0; display: grid; place-items: center; padding: 16px; background: #1118; }
    .favorite-dialog-backdrop[hidden] { display: none; }
    .favorite-dialog { display: grid; width: min(360px, 100%); gap: 12px; padding: 20px; border: 1px solid #e1e7e2; border-radius: 14px; background: #fff; box-shadow: 0 16px 48px #0003; }
    .favorite-dialog h2 { margin: 0; font-size: 15px; }
    .favorite-dialog p { margin: 0; color: #657168; font-size: 11px; }
    .favorite-dialog-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .favorite-dialog-actions button { padding: 9px; border: 0; border-radius: 8px; cursor: pointer; font: inherit; font-size: 11px; font-weight: 700; }
    .favorite-dialog-cancel { background: #f1f3f1; color: #435047; }
    .favorite-dialog-save { background: #e58b16; color: #fff; }
    .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .count-chip { padding: 4px 8px; border-radius: 999px; background: #f1f3f1; color: #59645d; font-size: 10px; font-weight: 700; }
    @media (max-width: 700px) {
      .board { grid-template-columns: repeat(3, minmax(220px, 1fr)); overflow-x: auto; padding-bottom: 5px; }
      .view[data-panel="rules"] { padding: 12px; }
    }
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
    </nav>
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
        <label>Ordem de execução<select name="queuePolicy">
          <option value="ordered">Respeitar a fila</option>
          <option value="independent">Executar ao atingir o gatilho, mesmo fora da ordem</option>
        </select></label>
        <div class="save-actions">
          <button class="save-action save" type="submit" name="saveAction" value="save">Salvar regra</button>
          <button class="save-action favorite" type="submit" name="saveAction" value="favorite" aria-label="Salvar e favoritar regra"><span class="star" aria-hidden="true">★</span> Favoritar</button>
        </div>
        <button class="cancel-edit" type="button" hidden>Cancelar edição</button>
      </form>
    </div>
    <div class="view" data-panel="rules" role="tabpanel" hidden>
      <div class="section-heading"><h2>Regras</h2><span class="count-chip rules-count">0</span></div>
      <div class="board" aria-label="Quadro de regras">
        <section class="board-lane" data-lane="ordered" aria-label="Em Fila">
          <h3 class="lane-heading">Em Fila <span class="lane-count">0</span></h3>
          <div class="rules queue-rules"></div>
        </section>
        <section class="board-lane" data-lane="independent" aria-label="Executar Imediato">
          <h3 class="lane-heading">Executar Imediato <span class="lane-count">0</span></h3>
          <div class="rules immediate-rules"></div>
        </section>
        <section class="board-lane" data-lane="favorites" aria-label="Favoritos">
          <h3 class="lane-heading">Favoritos <span class="lane-count">0</span></h3>
          <div class="favorites"></div>
        </section>
      </div>
    </div>
  </section>
  <div class="toast-stack" aria-live="polite" aria-relevant="additions"></div>
  <div class="favorite-dialog-backdrop" hidden>
    <form class="favorite-dialog" role="dialog" aria-modal="true" aria-labelledby="favorite-dialog-title">
      <h2 id="favorite-dialog-title">Nome do favorito</h2>
      <p>Este modelo ficará salvo nos Favoritos e não entrará na fila de execução.</p>
      <label>Nome<input name="favoriteName" maxlength="60" placeholder="Ex.: Comprar Up na abertura" required></label>
      <div class="favorite-dialog-actions">
        <button class="favorite-dialog-cancel" type="button">Cancelar</button>
        <button class="favorite-dialog-save" type="submit">Salvar favorito</button>
      </div>
    </form>
  </div>
`;

const panel = shadow.querySelector(".panel");
const backdrop = shadow.querySelector(".backdrop");
const quoteSelect = shadow.querySelector('[name="quote"]');
const quoteOptions = shadow.querySelector(".market-outcomes");
const queueRulesElement = shadow.querySelector(".queue-rules");
const immediateRulesElement = shadow.querySelector(".immediate-rules");
const favoritesElement = shadow.querySelector(".favorites");
const toastStack = shadow.querySelector(".toast-stack");
const favoriteDialogBackdrop = shadow.querySelector(".favorite-dialog-backdrop");
const favoriteDialog = shadow.querySelector(".favorite-dialog");
const favoriteDialogInput = favoriteDialog.querySelector('[name="favoriteName"]');
const form = shadow.querySelector("form");
const formSubmitButton = form.querySelector('[value="save"]');
const formHeading = shadow.querySelector(".form-heading");
const cancelEditButton = shadow.querySelector(".cancel-edit");
const tradingSideGroups = new WeakSet();
let rules = [];
let favorites = [];
let quotes = [];
let editingRuleId = null;
let pendingFavorite = null;
let renamingFavoriteId = null;
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
let favoritesWrite = Promise.resolve();
let scanTimer;
let mutationScanScheduled = false;

shadow.querySelector(".close").addEventListener("click", togglePanel);
backdrop.addEventListener("click", togglePanel);
shadow.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => selectView(tab.dataset.view));
});
setupRuleBoard();
cancelEditButton.addEventListener("click", () => {
  resetRuleForm();
  selectView("rules");
});
favoriteDialog.querySelector(".favorite-dialog-cancel").addEventListener("click", closeFavoriteDialog);
favoriteDialog.addEventListener("submit", saveFavoriteFromDialog);
favoriteDialogBackdrop.addEventListener("click", (event) => {
  if (event.target === favoriteDialogBackdrop) closeFavoriteDialog();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && panel.classList.contains("open")) {
    if (!favoriteDialogBackdrop.hidden) {
      closeFavoriteDialog();
    } else {
      togglePanel();
    }
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "POLYMAKR_TOGGLE_PANEL") {
    togglePanel();
  }
});

chrome.storage.local.get({ [RULES_KEY]: [], [FAVORITES_KEY]: [] }).then(async (stored) => {
  rules = Array.isArray(stored[RULES_KEY]) ? stored[RULES_KEY] : [];
  favorites = Array.isArray(stored[FAVORITES_KEY]) ? stored[FAVORITES_KEY] : [];
  let migratedFavorites = false;
  rules = rules.map((rule) => {
    if (!rule.favorite) return rule;
    if (!favorites.some((item) => item.sourceRuleId === rule.id)) {
      favorites.push(createFavoriteTemplate(
        rule,
        `${rule.market} · ${rule.outcome} · ${rule.side === "buy" ? "Comprar" : "Vender"}`.slice(0, 60),
        rule.id
      ));
    }
    const cleanRule = { ...rule };
    delete cleanRule.favorite;
    migratedFavorites = true;
    return cleanRule;
  });
  let interrupted = false;
  for (const rule of rules) {
    if (rule.executionStatus === "processing") {
      rule.executionStatus = "failed";
      rule.executionMessage = "Execução interrompida; confira o Polymarket. A regra não será repetida automaticamente.";
      interrupted = true;
    }
  }
  renderRules();
  if (migratedFavorites || interrupted) {
    try {
      await Promise.all([
        persistRules(),
        migratedFavorites ? persistFavorites() : Promise.resolve()
      ]);
    } catch (error) {
      showToast("Falha ao atualizar dados locais", error.message || String(error), "error");
    }
  }
  scan();
}).catch((error) => {
  showToast("Não foi possível carregar as regras", error.message || String(error), "error");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form, event.submitter);
  if (data.get("saveAction") === "favorite") {
    openFavoriteDialog(createRuleDraft(data));
    return;
  }
  await saveRule(data, form, "notify");
});

const observer = new MutationObserver(updateOnMutation);
observer.observe(document.documentElement, {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["aria-label", "title", "data-price"]
});
