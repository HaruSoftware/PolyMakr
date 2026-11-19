const HOST_ID = "polymakr-extension-root";
const RULES_KEY = "polymakr.rules";
const FAVORITES_KEY = "polymakr.favorites";
const ARCHIVE_KEY = "polymakr.archive";
const WALLET_KEY = "polymakr.walletAddress";
const EXECUTION_STATE_PREFIX = "polymakr.execution.";
const EXECUTION_SCHEMA_KEY = "polymakr.executionSchema";
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
      display: none; flex-direction: column; width: min(1040px, calc(100vw - 28px));
      height: min(760px, calc(100vh - 32px)); max-height: calc(100vh - 32px);
      overflow: hidden; border: 1px solid #dfe6e0; border-radius: 18px;
      background: #fff; color: #18211b; box-shadow: 0 12px 40px #0003;
      font: 13px/1.45 Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .panel.open { display: flex; }
    .top { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between;
      flex: 0 0 auto; align-items: center; padding: 14px 16px; border-bottom: 1px solid #edf0ed; background: #fff; }
    .top strong { font-size: 15px; }
    .top small { display: block; color: #78827b; font-size: 11px; }
    .close { border: 0; background: transparent; color: #59645d; cursor: pointer; font-size: 20px; }
    .panel-body { display: flex; flex: 1 1 auto; min-height: 0; overflow: hidden; }
    .tabs { display: flex; width: 194px; flex: 0 0 194px; flex-direction: column; gap: 5px;
      padding: 14px 10px; border-right: 1px solid #edf0ed; background: #f8faf8; }
    .tab { display: flex; width: 100%; min-height: 42px; align-items: center; gap: 10px; padding: 9px 11px;
      border: 1px solid transparent; border-radius: 9px; background: transparent; color: #657168;
      cursor: pointer; font: inherit; font-size: 12px; font-weight: 650; text-align: left; transition: background .15s, color .15s; }
    .tab:hover { background: #eef3ef; color: #435047; }
    .tab[aria-selected="true"] { border-color: #d8ebde; background: #e8f4ec; color: #087c3b; }
    .tab:focus-visible { outline: 2px solid #63a879; outline-offset: 2px; }
    .tab svg { width: 18px; height: 18px; flex: 0 0 18px; fill: none; stroke: currentColor;
      stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
    .views { display: flex; flex: 1 1 auto; min-width: 0; min-height: 0; }
    .view { display: none; flex: 1 1 auto; min-width: 0; min-height: 0; overflow: auto; padding: 18px;
      scrollbar-width: thin; scrollbar-color: #c5d0c8 transparent; }
    [data-panel="create"] form { max-width: 560px; margin: 0 auto; }
    .view.active { display: block; }
    .view[data-panel="rules"].active { display: flex; flex-direction: column; }
    .view h2 { margin: 0 0 14px; font-size: 15px; }
    .empty { color: #758078; font-size: 12px; }
    .analysis-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .analysis-heading h2 { margin-bottom: 4px; }
    .analysis-market-title { margin: 0; color: #78827b; font-size: 11px; }
    .analysis-refresh { flex: 0 0 auto; padding: 8px 11px; border: 1px solid #dfe6e0; border-radius: 8px; background: #fff; color: #435047; cursor: pointer; font: inherit; font-size: 11px; font-weight: 700; }
    .analysis-refresh:disabled { cursor: wait; opacity: .6; }
    .analysis-status { min-height: 16px; margin: 10px 0; color: #657168; font-size: 10px; }
    .analysis-status.error { color: #a33b2e; }
    .analysis-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .analysis-metric { min-width: 0; padding: 11px; border: 1px solid #e6ebe7; border-radius: 10px; background: #f8faf8; }
    .analysis-metric span { display: block; color: #78827b; font-size: 10px; }
    .analysis-metric strong { display: block; margin-top: 5px; overflow: hidden; font-size: 16px; text-overflow: ellipsis; white-space: nowrap; letter-spacing: -.01em; }
    .analysis-metric small { display: block; margin-top: 4px; color: #78827b; font-size: 9px; line-height: 1.4; }
    .analysis-up { color: #087c3b; }
    .analysis-down { color: #a33b2e; }
    .analysis-section { margin-top: 14px; padding: 12px; border: 1px solid #e6ebe7; border-radius: 10px; background: #fff; }
    .analysis-section h3 { margin: 0 0 8px; font-size: 12px; }
    .analysis-chart { display: block; width: 100%; height: auto; min-height: 130px; overflow: visible; }
    .analysis-chart-grid { stroke: #edf0ed; stroke-width: 1; }
    .analysis-chart-up, .analysis-chart-down { fill: none; stroke-width: 2; vector-effect: non-scaling-stroke; }
    .analysis-chart-up { stroke: #07833b; }
    .analysis-chart-down { stroke: #c4312b; }
    .analysis-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; color: #657168; font-size: 10px; }
    .analysis-legend span { display: inline-flex; align-items: center; gap: 5px; }
    .analysis-legend i { width: 9px; height: 9px; border-radius: 50%; background: #07833b; }
    .analysis-legend .down-dot { background: #c4312b; }
    .analysis-book-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .analysis-book-card { min-width: 0; padding: 10px; border-radius: 8px; background: #f8faf8; }
    .analysis-book-card h4 { margin: 0 0 7px; font-size: 11px; }
    .analysis-book-card p { display: flex; justify-content: space-between; gap: 8px; margin: 4px 0 0; color: #657168; font-size: 10px; }
    .analysis-book-card strong { color: #18211b; text-align: right; }
    .analysis-note { margin: 9px 0 0; color: #78827b; font-size: 9px; line-height: 1.45; }
    form { display: grid; gap: 9px; }
    label { display: grid; gap: 4px; color: #59645d; font-size: 11px; }
    input, select {
      width: 100%; min-width: 0; padding: 8px 32px 8px 9px; border: 1px solid #d9e0db;
      border-radius: 8px; background: #fff; color: #17211b; font: inherit; font-size: 12px;
      appearance: auto;
    }
    select {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2359645d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
      background-size: 15px;
      appearance: none;
      -webkit-appearance: none;
      padding-right: 30px;
    }
    input { padding: 8px 9px; }
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
    .board { display: grid; flex: 1 1 auto; min-height: 0; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; align-items: stretch; }
    .board-lane { display: flex; min-width: 0; min-height: 0; height: 100%; flex-direction: column; overflow: hidden; padding: 9px; border: 1px solid #e6ebe7; border-radius: 12px; background: #f7f9f7; transition: background .15s, border-color .15s; }
    .board-lane.drag-over { border-color: #087c3b; background: #e8f4ec; }
    .lane-heading { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 5px; margin: 0 0 9px; font-size: 12px; font-weight: 750; }
    .lane-count { flex: 0 0 auto; padding: 2px 6px; border-radius: 999px; background: #e9eeea; color: #59645d; font-size: 9px; }
    .rules, .favorites { display: grid; flex: 1 1 auto; align-content: start; gap: 6px; min-height: 0; overflow-y: auto;
      overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #c5d0c8 transparent; }
    .favorite-filters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; margin-bottom: 7px; }
    .favorite-filter { display: flex; min-width: 0; align-items: center; justify-content: center; gap: 4px; padding: 5px 3px; border: 1px solid #e1e7e2; border-radius: 6px; background: #fff; color: #59645d; cursor: pointer; font: inherit; font-size: 9px; font-weight: 750; }
    .favorite-filter[aria-pressed="true"] { border-color: #b8cdbd; background: #e8f4ec; color: #087c3b; }
    .favorite-filter[data-outcome-filter="Up"][aria-pressed="true"] { border-color: #a7d6b7; background: #e4f5ea; color: #087c3b; }
    .favorite-filter[data-outcome-filter="Down"][aria-pressed="true"] { border-color: #e5b7b3; background: #fde9e8; color: #a33b2e; }
    .favorite-filter-count { color: #78827b; font-size: 8px; }
    .execution-parameters-heading { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; }
    .execution-parameters-heading h2 { margin: 0; font-size: 12px; }
    .execution-parameter-create { padding: 5px 8px; border: 1px solid #dfe6e0; border-radius: 6px; background: #fff; color: #087c3b; cursor: pointer; font: inherit; font-size: 10px; font-weight: 700; }
    .execution-parameters-board { display: grid; flex: 0 0 128px; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; min-height: 0; margin-top: 6px; }
    .execution-parameter-lane { display: flex; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; padding: 8px; border: 1px solid #e6ebe7; border-radius: 10px; background: #f7f9f7; }
    .execution-parameter-lane .lane-heading { margin-bottom: 6px; }
    .execution-parameter-status { display: none; }
    .execution-parameter-status.error { color: #a33b2e; }
    .execution-parameters-active, .execution-parameters-favorites { display: grid; flex: 1 1 auto; grid-template-columns: minmax(0, 1fr); grid-auto-rows: 32px; align-content: start; gap: 5px; min-height: 0; overflow: auto; }
    .execution-parameters-active.drag-over { border-radius: 7px; background: #e8f4ec; }
    .execution-parameter-card { display: flex; width: 100%; min-width: 0; max-width: 100%; height: 32px; align-items: center; gap: 6px; padding: 4px 6px; border: 1px solid #e1e7e2; border-radius: 7px; background: #fff; cursor: grab; }
    .execution-parameter-card[aria-grabbed="true"] { opacity: .5; }
    .execution-parameter-identity { display: flex; flex: 1 1 auto; min-width: 0; align-items: center; gap: 6px; }
    .execution-parameter-name { display: block; min-width: 0; overflow: hidden; color: #435047; font-size: 10px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
    .execution-parameter-type-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; margin: 0 0 12px; }
    .execution-parameter-type-option { display: flex; min-width: 0; align-items: center; gap: 9px; padding: 10px; border: 1px solid #dfe6e0; border-radius: 9px; background: #fff; color: #435047; cursor: pointer; font: inherit; text-align: left; }
    .execution-parameter-type-option[aria-pressed="true"] { border-color: #087c3b; background: #e8f4ec; }
    .execution-parameter-type-option:disabled { cursor: default; opacity: .7; }
    .execution-parameter-type-copy { display: grid; min-width: 0; gap: 3px; }
    .execution-parameter-type-copy strong { font-size: 11px; }
    .execution-parameter-type-copy small { color: #78827b; font-size: 9px; line-height: 1.35; }
    .execution-parameter-type-icon { display: inline-grid; width: 22px; height: 22px; flex: 0 0 22px; place-items: center; border: 1px solid #dfe6e0; border-radius: 5px; background: #f1f3f1; color: #59645d; font-size: 13px; font-weight: 800; }
    .execution-parameter-type-icon svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.5; }
    .execution-parameter-type-option[aria-pressed="true"] .execution-parameter-type-icon { border-color: #b8cdbd; background: #fff; color: #087c3b; }
    .execution-parameter-dot { width: 9px; height: 9px; flex: 0 0 9px; border-radius: 50%; background: #087c3b; }
    .execution-parameter-dot.blocking { background: #c4312b; }
    .execution-parameter-dot.unknown { background: #d78a13; }
    .execution-parameter-dot.favorite { background: #aab4ac; }
    .execution-parameter-effect-badge { flex: 0 0 auto; }
    .execution-parameter-effect-icon { width: 18px; height: 18px; flex: 0 0 18px; }
    .execution-parameter-effect-icon svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.5; }
    .execution-parameter-effect-icon.block-buy { background: #e8efff; color: #3156a8; }
    .execution-parameter-effect-icon.block-sell { background: #fde9e8; color: #a33b2e; }
    .execution-parameter-effect-icon.block-both { background: #fff3d8; color: #8a5a00; }
    .execution-parameter-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 3px; }
    .execution-parameter-actions button { display: grid; width: 20px; height: 20px; flex: 0 0 20px; place-items: center; padding: 0; border: 1px solid #e1e6e2; border-radius: 5px; background: #fff; color: #435047; cursor: pointer; font: inherit; font-size: 11px; font-weight: 650; }
    .execution-parameter-actions button.danger { border-color: #f0d7d4; color: #a33b2e; }
    .execution-parameter-empty { align-self: flex-start; margin: 2px; font-size: 10px; }
    .execution-parameter-form { max-width: 560px; margin: 0 auto; }
    .execution-parameter-expression { display: flex; flex-wrap: wrap; align-items: end; gap: 8px; }
    .execution-parameter-expression > span, .execution-parameter-expression > strong { padding-bottom: 8px; color: #59645d; font-size: 11px; font-weight: 700; }
    .execution-parameter-expression label { flex: 1 1 115px; min-width: 100px; }
    .execution-parameter-effect { margin-top: 10px; }
    .execution-parameter-checkbox { display: flex; grid-template-columns: auto 1fr; align-items: center; gap: 7px; }
    .execution-parameter-checkbox input { width: auto; margin: 0; }
    .execution-parameter-form [type="submit"] { min-height: 40px; }
    .execution-parameter-builder { display: grid; width: min(900px, 100%); min-height: 460px; grid-template-columns: minmax(230px, .82fr) minmax(0, 1.18fr); margin: 0 auto; overflow: hidden; border: 1px solid #e1e8e2; border-radius: 16px; background: #fff; box-shadow: 0 8px 24px #17211b0a; }
    .execution-parameter-flow { display: flex; min-width: 0; flex-direction: column; padding: 22px 18px; background: linear-gradient(155deg, #f3f8f4, #f8faf8 62%, #eef5f0); }
    .execution-parameter-flow-kicker { display: inline-flex; align-items: center; gap: 7px; color: #78827b; font-size: 9px; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; }
    .execution-parameter-flow-kicker::before { width: 7px; height: 7px; border-radius: 50%; background: #087c3b; box-shadow: 0 0 0 3px #087c3b18; content: ""; }
    .execution-parameter-flow h2 { margin: 13px 0 5px; font-size: 20px; letter-spacing: -.025em; }
    .execution-parameter-flow-intro { max-width: 300px; margin: 0; color: #78827b; font-size: 11px; line-height: 1.55; }
    .execution-parameter-flow-track { display: grid; gap: 0; margin-top: 22px; }
    .execution-parameter-flow-node { position: relative; z-index: 1; display: flex; min-width: 0; align-items: center; gap: 10px; padding: 10px; border: 1px solid #e0e8e2; border-radius: 11px; background: #fff; box-shadow: 0 3px 8px #17211b08; }
    .execution-parameter-flow-index { display: grid; width: 27px; height: 27px; flex: 0 0 27px; place-items: center; border: 1px solid #dfe6e0; border-radius: 8px; background: #f7f9f7; color: #657168; font-size: 9px; font-weight: 800; }
    .execution-parameter-flow-copy { display: grid; min-width: 0; gap: 2px; }
    .execution-parameter-flow-copy small { color: #78827b; font-size: 8px; font-weight: 800; letter-spacing: .1em; }
    .execution-parameter-flow-copy strong { color: #26332a; font-size: 11px; }
    .execution-parameter-flow-connector { position: relative; height: 19px; margin-left: 22px; border-left: 1px solid #cbd9ce; }
    .execution-parameter-flow-connector::after { position: absolute; bottom: -1px; left: -3px; width: 5px; height: 5px; border-right: 1px solid #aebdb2; border-bottom: 1px solid #aebdb2; transform: rotate(45deg); content: ""; }
    .execution-parameter-type-panel { padding: 10px; border: 1px solid #dfe8e1; border-radius: 11px; background: #fff; box-shadow: 0 3px 8px #17211b08; }
    .execution-parameter-type-panel-heading { margin: 0 2px 6px; color: #435047; font-size: 10px; font-weight: 750; }
    .execution-parameter-builder .execution-parameter-type-options { display: grid; grid-template-columns: minmax(0, 1fr); gap: 3px; margin: 0; }
    .execution-parameter-builder .execution-parameter-type-option { padding: 8px; border-color: transparent; border-radius: 8px; background: transparent; }
    .execution-parameter-builder .execution-parameter-type-option:hover:not(:disabled) { border-color: #e2ebe4; background: #f8fbf8; }
    .execution-parameter-builder .execution-parameter-type-option[aria-pressed="true"] { border-color: #b7d6c1; background: #edf7f0; box-shadow: inset 3px 0 #087c3b; }
    .execution-parameter-builder .execution-parameter-type-copy strong { font-size: 10px; }
    .execution-parameter-builder .execution-parameter-type-copy small { font-size: 9px; }
    .execution-parameter-flow-explanation { display: grid; grid-template-columns: 27px minmax(0, 1fr); align-items: start; gap: 8px 9px; padding: 10px; border: 1px solid #e0e8e2; border-radius: 10px; background: #ffffffc7; }
    .execution-parameter-flow-explanation-copy { min-width: 0; }
    .execution-parameter-flow-explanation p { margin: 3px 0 0; color: #78827b; font-size: 9px; line-height: 1.45; }
    .execution-parameter-flow-note-icon { display: grid; width: 16px; height: 16px; justify-self: center; place-items: center; border-radius: 50%; background: #e8f4ec; color: #087c3b; font-size: 10px; font-weight: 800; }
    .execution-parameter-flow-note-text { min-width: 0; padding-top: 8px; border-top: 1px solid #e7ede8; color: #78827b; font-size: 9px; line-height: 1.5; }
    .execution-parameter-editor { display: flex; min-width: 0; flex-direction: column; padding: 22px; }
    .execution-parameter-editor-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
    .execution-parameter-editor-heading small { display: block; margin-bottom: 4px; color: #78827b; font-size: 8px; font-weight: 800; letter-spacing: .12em; }
    .execution-parameter-editor-heading h2 { margin: 0; font-size: 16px; }
    .execution-parameter-editor-badge { flex: 0 0 auto; padding: 5px 8px; border: 1px solid #e1e8e2; border-radius: 999px; background: #f7f9f7; color: #657168; font-size: 9px; font-weight: 700; }
    .execution-parameter-form { width: 100%; max-width: none; margin: 0; gap: 13px; }
    .execution-parameter-form > label:not(.execution-parameter-effect) { gap: 6px; color: #435047; font-size: 10px; font-weight: 700; }
    .execution-parameter-form input, .execution-parameter-form select { min-height: 38px; border-color: #dfe6e0; border-radius: 8px; background: #fbfcfb; font-size: 11px; padding-right: 30px; }
    .execution-parameter-form input:focus, .execution-parameter-form select:focus { border-color: #75ad86; outline: 3px solid #087c3b16; }
    .execution-parameter-condition { padding: 12px; border: 1px solid #e6ebe7; border-radius: 11px; background: #fafcfa; }
    .execution-parameter-editor-section-heading { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; color: #435047; font-size: 10px; font-weight: 750; }
    .execution-parameter-editor-section-heading span { display: grid; width: 19px; height: 19px; place-items: center; border-radius: 6px; background: #e8f4ec; color: #087c3b; font-size: 8px; font-weight: 800; }
    .execution-parameter-expression { align-items: end; gap: 8px; }
    .execution-parameter-expression > span, .execution-parameter-expression > strong { align-self: end; padding: 0 0 9px; color: #657168; font-size: 10px; }
    .execution-parameter-expression > strong { color: #26332a; }
    .execution-parameter-expression label { flex: 1 1 90px; min-width: 82px; gap: 5px; color: #78827b; font-size: 9px; font-weight: 650; }
    .execution-parameter-effect { margin: 0; gap: 6px; color: #435047; font-size: 10px; font-weight: 700; }
    .execution-parameter-form .save-actions { gap: 7px; margin-top: 2px; }
    .execution-parameter-form .save-action { min-height: 40px; padding: 8px; font-size: 10px; }
    .execution-parameter-form .save-action.favorite { border: 1px solid #f1dfc7; background: #fff9f0; color: #a96108; }
    .execution-parameter-form .save-action.favorite:hover { background: #fff2df; }
    .execution-parameter-form .execution-parameter-cancel { padding: 7px; border: 1px solid #e1e6e2; border-radius: 7px; background: #fff; color: #59645d; cursor: pointer; font: inherit; font-size: 10px; font-weight: 700; }
    .execution-parameter-form [hidden] { display: none; }
    @media (max-width: 700px) {
      .execution-parameter-builder { grid-template-columns: minmax(0, 1fr); }
      .execution-parameter-flow { padding: 17px; }
      .execution-parameter-flow h2 { margin-top: 8px; font-size: 17px; }
      .execution-parameter-flow-track { margin-top: 14px; }
      .execution-parameter-flow-note { margin-top: 0; }
      .execution-parameter-editor { padding: 17px; }
    }
    .rule, .template { position: relative; display: grid; height: 64px; min-height: 64px; grid-template-rows: minmax(0, 1fr) auto; gap: 5px; padding: 6px 7px; border: 1px solid #e1e7e2; border-radius: 8px; background: #fff; box-shadow: 0 1px 3px #17211b08; cursor: grab; }
    .rule:active, .template:active { cursor: grabbing; }
    .rule[aria-grabbed="true"], .template[aria-grabbed="true"] { opacity: .5; }
    .rule.drop-before { border-top: 2px solid #087c3b; }
    .rule.drop-after { border-bottom: 2px solid #087c3b; }
    .rule-header, .template-header { display: flex; width: 100%; min-width: 0; align-items: center; justify-content: space-between; gap: 6px; }
    .rule-heading, .template-heading { display: flex; min-width: 0; align-items: center; gap: 6px; overflow: hidden; }
    .rule-title, .template-title { overflow: hidden; color: #435047; font-size: 11px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
    .template-title { flex: 1 1 auto; min-width: 0; }
    .rule-top-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 4px; }
    .rule-market { min-width: 0; overflow: hidden; color: #435047; font-size: 11px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
    .card-meta { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 6px; }
    .card-market { flex: 1 1 auto; min-width: 0; overflow: hidden; color: #78827b; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
    .card-trigger { display: flex; min-width: 0; align-items: baseline; gap: 4px; color: #657168; font-size: 10px; }
    .card-trigger.compact { flex: 0 0 auto; }
    .card-trigger strong { color: #18211b; font-size: 12px; font-weight: 750; }
    .card-remove { flex: 0 0 auto; padding: 3px 7px; border: 1px solid #f0d7d4; border-radius: 6px; background: #fff; color: #a33b2e; cursor: pointer; font: inherit; font-size: 10px; font-weight: 650; line-height: 1.3; }
    .card-remove:hover { border-color: #d7aaa5; background: #fff7f6; }
    .action-icon { display: inline-grid; width: 16px; height: 16px; place-items: center; border-radius: 4px; background: #f1f3f1; color: #59645d; font-size: 10px; font-weight: 800; }
    .trade-badge { display: inline-flex; height: 17px; flex: 0 0 auto; overflow: hidden; align-items: center; border-radius: 4px; font-size: 8px; font-weight: 800; line-height: 1; }
    .trade-badge span { display: grid; height: 100%; place-items: center; padding: 0 4px; }
    .trade-side.buy { background: #087c3b; color: #fff; }
    .trade-side.sell { background: #a33b2e; color: #fff; }
    .trade-outcome.up { background: #e4f5ea; color: #087c3b; }
    .trade-outcome.down { background: #fde9e8; color: #a33b2e; }
    .action-icon.auto_limit { background: #e8efff; color: #3156a8; }
    .action-icon.paper { background: #e8f4ec; color: #087c3b; }
    .action-icon.confirm { background: #fff3d8; color: #8a5a00; }
    .action-icon.favorite-simulation { background: #fff0dc; color: #b86a00; }
    .more { position: relative; flex: 0 0 auto; }
    .more summary { display: grid; width: 20px; height: 20px; place-items: center; border-radius: 5px; color: #59645d; cursor: pointer; font-size: 16px; font-weight: 800; line-height: 1; list-style: none; }
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
    .settings-section { display: grid; gap: 10px; max-width: 640px; margin: 0 0 16px; padding: 14px; border: 1px solid #e6ebe7; border-radius: 11px; background: #f8faf8; }
    .settings-section h3 { margin: 0; font-size: 13px; }
    .settings-section p { margin: 0; color: #657168; font-size: 11px; }
    .settings-section .wallet-settings { margin-top: 0; }
    .simulation-reset-wallet { justify-self: start; min-height: 34px; padding: 7px 10px; border: 1px solid #f0d7d4; border-radius: 7px; background: #fff; color: #a33b2e; cursor: pointer; font: inherit; font-size: 11px; font-weight: 700; }
    .simulation-reset-wallet:hover { border-color: #d7aaa5; background: #fff7f6; }
    .simulation-reset-wallet:disabled { cursor: wait; opacity: .6; }
    .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .count-chip { padding: 4px 8px; border-radius: 999px; background: #f1f3f1; color: #59645d; font-size: 10px; font-weight: 700; }
    .archive-list { display: grid; gap: 8px; margin-top: 12px; }
    .archive-card { display: grid; gap: 4px; padding: 10px 12px; border: 1px solid #e1e7e2; border-radius: 8px; background: #fff; color: #435047; font-size: 11px; overflow-wrap: anywhere; }
    .archive-card p { margin: 0; }
    .archive-status { color: #087c3b; font-weight: 750; }
    .archive-error { color: #a33b2e; }
    .wallet-settings { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: end; margin-top: 12px; }
    .wallet-settings button { min-height: 36px; padding: 7px 10px; border: 0; border-radius: 7px; background: #087c3b; color: #fff; cursor: pointer; font: inherit; font-size: 11px; font-weight: 700; }
    .wallet-help { grid-column: 1 / -1; margin: -4px 0 0; color: #78827b; font-size: 10px; }
    .simulation-overview { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 2fr); gap: 10px; }
    .simulation-equity, .simulation-metric { min-width: 0; padding: 14px; border: 1px solid #e6ebe7; border-radius: 11px; background: #f8faf8; }
    .simulation-equity-label, .simulation-metric span { display: block; color: #78827b; font-size: 10px; }
    .simulation-equity-value { display: block; margin-top: 4px; font-size: 23px; letter-spacing: -.5px; }
    .simulation-equity-change { display: inline-flex; margin-top: 8px; padding: 3px 7px; border-radius: 999px; font-size: 10px; font-weight: 750; }
    .simulation-positive { color: #087c3b !important; }
    .simulation-negative { color: #b42318 !important; }
    .simulation-neutral { color: #59645d !important; }
    .simulation-positive-bg { background: #e4f5ea; }
    .simulation-negative-bg { background: #fde9e8; }
    .simulation-neutral-bg { background: #eef1ef; }
    .simulation-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .simulation-metric { display: flex; flex-direction: column; justify-content: center; gap: 5px; padding: 11px; }
    .simulation-metric strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
    .simulation-note { margin: 9px 0 16px; color: #78827b; font-size: 10px; }
    .simulation-status { margin: 8px 0 0; font-size: 10px; }
    .simulation-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; margin-top: 16px; padding: 4px; border: 1px solid #e3e9e4; border-radius: 10px; background: #f4f7f4; }
    .simulation-tab { display: flex; min-width: 0; align-items: center; justify-content: center; gap: 6px; padding: 9px 7px; border: 0; border-radius: 7px; background: transparent; color: #657168; cursor: pointer; font: inherit; font-size: 11px; font-weight: 700; }
    .simulation-tab[aria-selected="true"] { background: #fff; color: #087c3b; box-shadow: 0 1px 3px #17211b12; }
    .simulation-tab-count { flex: 0 0 auto; min-width: 18px; padding: 2px 5px; border-radius: 999px; background: #e9eeea; color: #59645d; font-size: 9px; font-weight: 700; text-align: center; }
    .simulation-tab[aria-selected="true"] .simulation-tab-count { background: #e4f5ea; color: #087c3b; }
    .simulation-window { display: grid; gap: 14px; margin-top: 12px; }
    .simulation-window[hidden] { display: none; }
    .simulation-window > .simulation-section { margin-top: 0; }
    .simulation-section { display: grid; gap: 8px; margin-top: 18px; }
    .simulation-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .simulation-section h3 { margin: 0; font-size: 13px; }
    .simulation-section-count { padding: 2px 7px; border-radius: 999px; background: #f1f3f1; color: #59645d; font-size: 10px; font-weight: 700; }
    .simulation-table-wrap { overflow-x: auto; border: 1px solid #e6ebe7; border-radius: 10px; background: #fff; }
    .view::-webkit-scrollbar, .rules::-webkit-scrollbar, .favorites::-webkit-scrollbar { width: 7px; height: 7px; }
    .view::-webkit-scrollbar-thumb, .rules::-webkit-scrollbar-thumb, .favorites::-webkit-scrollbar-thumb { border-radius: 8px; background: #c5d0c8; }
    .simulation-table { width: 100%; border-collapse: collapse; font-size: 10px; text-align: left; }
    .simulation-table th { padding: 9px 10px; background: #f8faf8; color: #78827b; font-size: 9px; font-weight: 650; white-space: nowrap; }
    .simulation-table td { padding: 10px; border-top: 1px solid #edf0ed; color: #435047; white-space: nowrap; }
    .simulation-table td:first-child { max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
    .simulation-table .simulation-numeric { text-align: right; font-variant-numeric: tabular-nums; }
    .simulation-outcome { display: inline-flex; align-items: center; gap: 5px; font-weight: 750; }
    .simulation-outcome::before { width: 7px; height: 7px; border-radius: 50%; background: #087c3b; content: ""; }
    .simulation-outcome.down::before { background: #c4312b; }
    .simulation-side { font-weight: 750; }
    .simulation-side.buy { color: #087c3b; }
    .simulation-side.sell { color: #a33b2e; }
    .simulation-state { display: inline-flex; padding: 3px 7px; border-radius: 999px; background: #eef1ef; color: #59645d; font-size: 9px; font-weight: 700; }
    .simulation-state.open, .simulation-state.partially_filled { background: #fff3d8; color: #8a5a00; }
    .simulation-state.filled { background: #e4f5ea; color: #087c3b; }
    .simulation-state.cancelled { background: #f1f3f1; color: #657168; }
    .simulation-state.failed { background: #fbe9e7; color: #a33b2e; }
    .simulation-state.expired, .simulation-state.awaiting_position { background: #e8efff; color: #3156a8; }
    .simulation-actions { display: inline-flex; align-items: center; gap: 8px; }
    .simulation-cancel { padding: 4px 7px; border: 1px solid #f0d7d4; border-radius: 6px; background: #fff; color: #a33b2e; cursor: pointer; font: inherit; font-size: 9px; font-weight: 650; }
    .simulation-delete-history { padding: 4px 7px; border: 1px solid #f0d7d4; border-radius: 6px; background: #fff; color: #a33b2e; cursor: pointer; font: inherit; font-size: 9px; font-weight: 650; }
    .simulation-clear-history, .simulation-clear-activity { min-height: 28px; padding: 5px 8px; border: 1px solid #f0d7d4; border-radius: 6px; background: #fff; color: #a33b2e; cursor: pointer; font: inherit; font-size: 10px; font-weight: 700; }
    .simulation-clear-history:disabled, .simulation-clear-activity:disabled { cursor: not-allowed; opacity: .5; }
    .simulation-history-note { margin: 0; color: #78827b; font-size: 10px; }
    .simulation-empty-cell { padding: 20px !important; color: #78827b !important; text-align: center; white-space: normal !important; }
    @media (max-width: 700px) {
      .simulation-overview { grid-template-columns: 1fr; }
      .simulation-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .simulation-metric { padding: 9px; }
      .simulation-table { min-width: 650px; }
    }
    .archive-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
    .archive-select-all { display: flex; flex: 1 1 auto; align-items: center; gap: 6px; color: #59645d; font-size: 11px; }
    .archive-select-all input, .archive-card-select input { width: auto; margin: 0; }
    .archive-actions button { min-height: 32px; padding: 6px 9px; border: 1px solid #e1e6e2; border-radius: 7px; background: #fff; color: #435047; cursor: pointer; font: inherit; font-size: 10px; font-weight: 700; }
    .archive-actions button.danger { border-color: #f0d7d4; color: #a33b2e; }
    .archive-actions button:disabled { cursor: not-allowed; opacity: .5; }
    .archive-card-heading { display: flex; align-items: flex-start; gap: 7px; }
    .archive-card-select { display: flex; flex: 0 0 auto; align-items: center; padding-top: 2px; }
    .archive-card-heading .archive-status { flex: 1 1 auto; }
    .archive-delete-backdrop, .simulation-reset-backdrop { position: fixed; z-index: 2147483650; inset: 0; display: grid; place-items: center; padding: 16px; background: #1118; }
    .archive-delete-backdrop[hidden], .simulation-reset-backdrop[hidden] { display: none; }
    .archive-delete-dialog, .simulation-reset-dialog { display: grid; width: min(360px, 100%); gap: 12px; padding: 20px; border: 1px solid #e1e7e2; border-radius: 14px; background: #fff; box-shadow: 0 16px 48px #0003; }
    .archive-delete-dialog h2, .simulation-reset-dialog h2 { margin: 0; font-size: 15px; }
    .archive-delete-dialog p, .simulation-reset-dialog p { margin: 0; color: #657168; font-size: 11px; }
    .archive-delete-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .archive-delete-actions button { padding: 9px; border: 0; border-radius: 8px; cursor: pointer; font: inherit; font-size: 11px; font-weight: 700; }
    .archive-delete-actions button:disabled { cursor: wait; opacity: .6; }
    .archive-delete-cancel { background: #f1f3f1; color: #435047; }
    .archive-delete-confirm { background: #a33b2e; color: #fff; }
    @media (max-width: 700px) {
      .board { grid-template-columns: repeat(3, minmax(220px, 1fr)); overflow-x: auto; padding-bottom: 5px; }
      .execution-parameters-board { flex-basis: 196px; grid-template-columns: 1fr; }
      .execution-parameter-expression { grid-template-columns: auto minmax(80px, 1fr); align-items: center; }
      .execution-parameter-expression > span { padding-bottom: 0; }
      .view[data-panel="rules"] { padding: 12px; }
      .panel-body { flex-direction: column; }
      .tabs { order: 2; width: 100%; flex: 0 0 auto; flex-direction: row; gap: 4px; overflow-x: auto;
        padding: 7px 8px; border-top: 1px solid #edf0ed; border-right: 0; }
      .tab { width: auto; min-width: 58px; min-height: 52px; flex: 1 0 58px; flex-direction: column;
        justify-content: center; gap: 3px; padding: 5px 4px; font-size: 9px; text-align: center; }
      .tab svg { width: 17px; height: 17px; flex-basis: 17px; }
      .views { order: 1; }
      .analysis-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
  <div class="backdrop"></div>
  <section class="panel" role="dialog" aria-modal="true" aria-label="Painel PolyMakr">
    <header class="top">
      <div><strong>PolyMakr</strong><small>Regras de preço</small></div>
      <button class="close" type="button" aria-label="Fechar painel">×</button>
    </header>
    <div class="panel-body">
      <nav class="tabs" role="tablist" aria-label="Seções do PolyMakr">
        <button id="simulation-tab-main" class="tab" type="button" role="tab" data-view="simulation" aria-controls="panel-simulation" aria-label="Simulação" aria-selected="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/><path d="M16 6h4v4"/></svg><span>Simulação</span>
        </button>
        <button id="create-tab" class="tab" type="button" role="tab" data-view="create" aria-controls="panel-create" aria-label="Criar" aria-selected="true">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Criar</span>
        </button>
        <button id="execution-parameters-tab" class="tab" type="button" role="tab" data-view="parameters" aria-controls="panel-parameters" aria-label="Parâmetros de Execução" aria-selected="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/></svg><span>Parâmetros</span>
        </button>
        <button id="rules-tab" class="tab" type="button" role="tab" data-view="rules" aria-controls="panel-rules" aria-label="Regras" aria-selected="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg><span>Regras</span>
        </button>
        <button id="analysis-tab" class="tab" type="button" role="tab" data-view="analysis" aria-controls="panel-analysis" aria-label="Análise" aria-selected="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M4 19h16"/><path d="m7 15 4-5 3 3 5-7"/></svg><span>Análise</span>
        </button>
        <button id="archive-tab" class="tab" type="button" role="tab" data-view="archive" aria-controls="panel-archive" aria-label="Registro" aria-selected="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v4H4zM6 9v10h12V9M10 13h4"/></svg><span>Registro</span>
        </button>
        <button id="settings-tab" class="tab" type="button" role="tab" data-view="settings" aria-controls="panel-settings" aria-label="Configurações" aria-selected="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.7Z"/></svg><span>Configurações</span>
        </button>
      </nav>
      <main class="views">
    <div id="panel-create" class="view active" data-panel="create" role="tabpanel" aria-labelledby="create-tab">
      <h2 class="form-heading">Criar regra</h2>
      <form>
        <label>Resultado no mercado ativo</label>
        <div class="market-outcomes" role="group" aria-label="Resultado no mercado ativo"></div>
        <select name="quote" aria-hidden="true" tabindex="-1" hidden></select>
        <div class="row">
          <label>Lado da ordem<select name="side" required><option value="" selected disabled>Selecione</option><option value="buy">Comprar</option><option value="sell">Vender</option></select></label>
          <label>Condição<select name="trigger"><option value="reaches">Atingir o preço</option><option value="rises">Subir até o preço</option><option value="falls">Cair até o preço</option></select></label>
        </div>
        <div class="row">
          <label>Disparar quando chegar a (¢)<input name="triggerCents" type="number" min="0.1" max="99.9" step="0.1" placeholder="ex.: 50" required></label>
          <label>Preço da ordem limite (¢)<input name="orderLimitCents" type="number" min="0.1" max="99.9" step="0.1" placeholder="ex.: 50" required></label>
        </div>
        <div class="row">
          <label>Quantidade (shares)<input name="shares" type="number" min="1" step="1" placeholder="ex.: 5" required></label>
          <label>Expiração<select name="expiration"><option value="never">Never</option></select></label>
        </div>
        <label>Quando disparar<select name="mode">
          <option value="notify">Somente notificar</option>
          <option value="confirm">Avisar e pedir confirmação</option>
          <option value="paper">Simular ordem (carteira virtual)</option>
          <option value="auto_limit">Enviar ordem real (automação no Polymarket)</option>
        </select></label>
        <label>Ordem de execução<select name="queuePolicy">
          <option value="ordered">Respeitar a fila</option>
          <option value="independent">Executar ao atingir o gatilho, mesmo fora da ordem</option>
        </select></label>
        <label class="execution-parameter-checkbox"><input name="honorExecutionParameters" type="checkbox" checked> Respeitar Parâmetros de Execução</label>
        <div class="save-actions">
          <button class="save-action save" type="submit" name="saveAction" value="save">Salvar regra</button>
          <button class="save-action favorite" type="submit" name="saveAction" value="favorite" aria-label="Salvar e favoritar regra"><span class="star" aria-hidden="true">★</span> Favoritar</button>
        </div>
        <button class="cancel-edit" type="button" hidden>Cancelar edição</button>
      </form>
    </div>
    <div id="panel-parameters" class="view" data-panel="parameters" role="tabpanel" aria-labelledby="execution-parameters-tab" hidden>
      <div class="execution-parameter-builder">
        <section class="execution-parameter-flow" aria-label="Fluxo do parâmetro">
          <div class="execution-parameter-flow-kicker">Construtor de automação</div>
          <h2>Parâmetros de Execução</h2>
          <p class="execution-parameter-flow-intro">Monte uma condição para controlar quando suas regras podem ser executadas.</p>
          <div class="execution-parameter-flow-track">
            <div class="execution-parameter-flow-node">
              <span class="execution-parameter-flow-index">01</span>
              <span class="execution-parameter-flow-copy"><small>SE</small><strong>Escolha uma condição</strong></span>
            </div>
            <div class="execution-parameter-flow-connector" aria-hidden="true"></div>
            <div class="execution-parameter-type-panel">
              <div class="execution-parameter-type-panel-heading">Tipo de parâmetro</div>
              <div class="execution-parameter-type-options" role="group" aria-label="Tipo de parâmetro"></div>
            </div>
            <div class="execution-parameter-flow-connector" aria-hidden="true"></div>
            <div class="execution-parameter-flow-explanation">
              <span class="execution-parameter-flow-index">02</span>
              <div class="execution-parameter-flow-copy execution-parameter-flow-explanation-copy"><strong>Defina a ação à direita</strong><p>Escolha se esta condição deve bloquear as regras ou não interferir na execução.</p></div>
              <span class="execution-parameter-flow-note-icon" aria-hidden="true">i</span>
              <div class="execution-parameter-flow-note-text">A condição é verificada no mercado ativo. O efeito escolhido vale enquanto ela for satisfeita.</div>
            </div>
          </div>
        </section>
        <section class="execution-parameter-editor" aria-label="Configuração do parâmetro">
          <div class="execution-parameter-editor-heading">
            <div><small>CONFIGURAÇÃO</small><h2 class="execution-parameter-form-heading">Criar parâmetro</h2></div>
            <span class="execution-parameter-editor-badge">SE / ENTÃO</span>
          </div>
          <form class="execution-parameter-form">
            <input name="type" type="hidden" value="market_time">
            <label>Nome (opcional)<input name="name" maxlength="60" placeholder="Ex.: Evitar os últimos 30 segundos"></label>
            <div class="execution-parameter-condition">
              <div class="execution-parameter-editor-section-heading"><span>01</span>Defina a condição</div>
              <div class="execution-parameter-type-fields"></div>
            </div>
            <div class="execution-parameter-condition">
              <div class="execution-parameter-editor-section-heading"><span>02</span>O que acontece?</div>
              <label class="execution-parameter-effect">Ação<select name="effect"><option value="block_both">🔒 Bloquear Compras e Vendas</option><option value="block_buy">🔒↑ Bloquear apenas Compras</option><option value="block_sell">🔒↓ Bloquear apenas Vendas</option></select></label>
            </div>
            <div class="save-actions">
              <button class="save-action save" type="submit" name="parameterAction" value="active">Adicionar aos parâmetros</button>
              <button class="save-action favorite" type="submit" name="parameterAction" value="favorite"><span class="star" aria-hidden="true">★</span> Salvar como favorito</button>
            </div>
            <button class="execution-parameter-cancel" type="button" hidden>Cancelar edição</button>
          </form>
        </section>
      </div>
    </div>
    <div id="panel-rules" class="view" data-panel="rules" role="tabpanel" aria-labelledby="rules-tab" hidden>
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
          <div class="favorite-filters" role="group" aria-label="Filtrar favoritos por resultado">
            <button class="favorite-filter" type="button" data-outcome-filter="all" aria-pressed="true">Todos <span class="favorite-filter-count">0</span></button>
            <button class="favorite-filter" type="button" data-outcome-filter="Up" aria-pressed="false">UP <span class="favorite-filter-count">0</span></button>
            <button class="favorite-filter" type="button" data-outcome-filter="Down" aria-pressed="false">DOWN <span class="favorite-filter-count">0</span></button>
          </div>
          <div class="favorites"></div>
        </section>
      </div>
      <div class="execution-parameters-heading">
        <h2>Parâmetros de Execução</h2>
        <button class="execution-parameter-create" type="button">Criar parâmetro</button>
      </div>
      <div class="execution-parameters-board" aria-label="Parâmetros de execução e favoritos">
        <section class="execution-parameter-lane">
          <h3 class="lane-heading">Em Parâmetros <span class="lane-count execution-parameters-active-count">0</span><span class="execution-parameter-status">Abra um mercado</span></h3>
          <div class="execution-parameters-active"></div>
        </section>
        <section class="execution-parameter-lane">
          <h3 class="lane-heading">Favoritos <span class="lane-count execution-parameters-favorites-count">0</span></h3>
          <div class="execution-parameters-favorites"></div>
        </section>
      </div>
    </div>
    <div id="panel-analysis" class="view" data-panel="analysis" role="tabpanel" aria-labelledby="analysis-tab" hidden>
      <div class="analysis-heading">
        <div><h2>Análise do mercado</h2><p class="analysis-market-title">Abra um mercado com resultados Up/Down.</p></div>
        <button class="analysis-refresh" type="button">Atualizar</button>
      </div>
      <p class="analysis-status" role="status" aria-live="polite">Aguardando dados do mercado.</p>
      <div class="analysis-metrics">
        <article class="analysis-metric"><span>Medo · preço de Down</span><strong data-analysis-value="fear">—</strong><small>Probabilidade implícita pelo preço do resultado Down.</small></article>
        <article class="analysis-metric"><span>Movimento Up · janela observada</span><strong data-analysis-value="movement">—</strong><small data-analysis-detail="movement">Variação da cotação observada.</small></article>
        <article class="analysis-metric"><span>Tendência Up · janela observada</span><strong data-analysis-value="trend">—</strong><small data-analysis-detail="trend">Calculada pelas cotações observadas nesta página.</small></article>
        <article class="analysis-metric"><span>Amplitude Up · janela observada</span><strong data-analysis-value="range">—</strong><small>Máxima menos mínima observadas na janela.</small></article>
      </div>
      <section class="analysis-section">
        <h3>Cotações observadas</h3>
        <svg class="analysis-chart" viewBox="0 0 600 180" role="img" aria-label="Histórico de cotações Up e Down observado nesta sessão">
          <path class="analysis-chart-grid" d="M40 20H590M40 85H590M40 150H590"/>
          <path class="analysis-chart-up"></path><path class="analysis-chart-down"></path>
        </svg>
        <div class="analysis-legend"><span><i></i>Up</span><span><i class="down-dot"></i>Down</span><span class="analysis-sample-count">0 observações</span></div>
        <p class="analysis-note">O gráfico usa apenas observações feitas enquanto esta página está aberta; não representa histórico anterior nem previsão.</p>
      </section>
      <section class="analysis-section">
        <h3>Livro de ofertas deste mercado</h3>
        <div class="analysis-book-grid">
          <article class="analysis-book-card" data-analysis-book="Up"><h4>Up</h4><p><span>Melhor bid / ask</span><strong data-book-value="quotes">—</strong></p><p><span>Spread</span><strong data-book-value="spread">—</strong></p><p><span>Profundidade (5 níveis)</span><strong data-book-value="depth">—</strong></p><p><span>Desequilíbrio de bids</span><strong data-book-value="imbalance">—</strong></p></article>
          <article class="analysis-book-card" data-analysis-book="Down"><h4>Down</h4><p><span>Melhor bid / ask</span><strong data-book-value="quotes">—</strong></p><p><span>Spread</span><strong data-book-value="spread">—</strong></p><p><span>Profundidade (5 níveis)</span><strong data-book-value="depth">—</strong></p><p><span>Desequilíbrio de bids</span><strong data-book-value="imbalance">—</strong></p></article>
        </div>
        <p class="analysis-note">Spread e profundidade vêm do livro público do CLOB; o desequilíbrio compara o valor em bids e asks nos cinco primeiros níveis.</p>
      </section>
    </div>
    <div id="panel-archive" class="view" data-panel="archive" role="tabpanel" aria-labelledby="archive-tab" hidden>
      <div class="section-heading"><h2>Registro de regras</h2><span class="count-chip archive-count">0</span></div>
      <div class="archive-actions">
        <label class="archive-select-all"><input class="archive-select-all-input" type="checkbox"> Selecionar todos</label>
        <button class="archive-delete-selected danger" type="button" disabled>Excluir selecionados (0)</button>
        <button class="archive-clear-all danger" type="button" disabled>Limpar tudo</button>
      </div>
      <div class="archive-list"></div>
    </div>
    <div id="panel-simulation" class="view" data-panel="simulation" role="tabpanel" aria-labelledby="simulation-tab-main" hidden>
      <div class="section-heading"><h2>Simulação ao vivo</h2><span class="count-chip">Carteira virtual</span></div>
      <p class="simulation-note">Ordem aberta não significa compra ou venda: só um fill altera shares e caixa. Compras abertas reservam saldo; o débito ocorre conforme os fills. Use Fechar posição para vender ao melhor bid e realizar lucro ou prejuízo.</p>
      <div class="simulation-overview">
        <div class="simulation-equity"></div>
        <div class="simulation-metrics"></div>
      </div>
      <p class="simulation-status empty" role="status"></p>
      <div class="simulation-tabs" role="tablist" aria-label="Visões da carteira virtual">
        <button id="simulation-tab-orders" class="simulation-tab" type="button" role="tab" data-simulation-tab="orders" aria-controls="simulation-window-orders" aria-selected="true" tabindex="0">
          Ordens abertas <span class="simulation-tab-count simulation-orders-count">0</span>
        </button>
        <button id="simulation-tab-positions" class="simulation-tab" type="button" role="tab" data-simulation-tab="positions" aria-controls="simulation-window-positions" aria-selected="false" tabindex="-1">
          Posições <span class="simulation-tab-count simulation-positions-count">0</span>
        </button>
        <button id="simulation-tab-history" class="simulation-tab" type="button" role="tab" data-simulation-tab="history" aria-controls="simulation-window-history" aria-selected="false" tabindex="-1">
          Histórico <span class="simulation-tab-count simulation-history-count">0</span>
        </button>
      </div>
      <section id="simulation-window-orders" class="simulation-window" role="tabpanel" aria-labelledby="simulation-tab-orders" data-simulation-window="orders" tabindex="0">
        <div class="simulation-section-heading"><h3>Ordens abertas</h3></div>
        <div class="simulation-orders"></div>
      </section>
      <section id="simulation-window-positions" class="simulation-window" role="tabpanel" aria-labelledby="simulation-tab-positions" data-simulation-window="positions" tabindex="0" hidden>
        <div class="simulation-section-heading"><h3>Posições</h3></div>
        <div class="simulation-positions"></div>
      </section>
      <section id="simulation-window-history" class="simulation-window" role="tabpanel" aria-labelledby="simulation-tab-history" data-simulation-window="history" tabindex="0" hidden>
        <section class="simulation-section">
          <div class="simulation-section-heading">
            <h3>Histórico de ordens</h3>
            <button class="simulation-clear-history" type="button" disabled>Limpar histórico</button>
          </div>
          <p class="simulation-history-note">Apagar registros não altera o saldo, as posições ou os preenchimentos.</p>
          <div class="simulation-order-history"></div>
        </section>
        <section class="simulation-section">
          <div class="simulation-section-heading">
            <h3>Atividade recente</h3>
            <span class="simulation-section-count simulation-fills-count">0</span>
            <button class="simulation-clear-activity" type="button" disabled>Limpar atividade</button>
          </div>
          <div class="simulation-fills"></div>
        </section>
      </section>
    </div>
    <div id="panel-settings" class="view" data-panel="settings" role="tabpanel" aria-labelledby="settings-tab" hidden>
      <h2>Configurações</h2>
      <section class="settings-section">
        <h3>Acompanhamento de carteira</h3>
        <p>Informe o endereço público/proxy exibido na conta Polymarket. Nunca informe chave privada nem credenciais.</p>
        <form class="wallet-settings">
          <label>Carteira pública (proxy wallet)<input name="walletAddress" type="text" maxlength="42" placeholder="0x..." autocomplete="off"></label>
          <button type="submit">Salvar carteira</button>
          <p class="wallet-help">Usado para acompanhar fills públicos das ordens automatizadas.</p>
        </form>
      </section>
      <section class="settings-section">
        <h3>Carteira de ativos</h3>
        <p>Crie uma nova carteira virtual com outro saldo inicial. O reset apaga o saldo, as posições, as ordens e os fills atuais; regras e registros são mantidos.</p>
        <button class="simulation-reset-wallet" type="button">Resetar carteira de ativos</button>
      </section>
    </div>
      </main>
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
  <div class="archive-delete-backdrop" hidden>
    <section class="archive-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="archive-delete-title">
      <h2 id="archive-delete-title">Apagar registros?</h2>
      <p class="archive-delete-message"></p>
      <div class="archive-delete-actions">
        <button class="archive-delete-cancel" type="button">Cancelar</button>
        <button class="archive-delete-confirm" type="button">Apagar</button>
      </div>
    </section>
  </div>
  <div class="simulation-reset-backdrop" hidden>
    <form class="simulation-reset-dialog" role="dialog" aria-modal="true" aria-labelledby="simulation-reset-title">
      <h2 id="simulation-reset-title">Criar nova carteira de ativos?</h2>
      <p>O saldo, as posições, as ordens e os fills atuais serão apagados. Regras e registros serão mantidos.</p>
      <label>Novo saldo inicial (US$)<input class="simulation-reset-initial-cash" type="number" min="0.01" max="1000000000" step="0.01" placeholder="Informe o novo saldo" required></label>
      <div class="archive-delete-actions">
        <button class="archive-delete-cancel simulation-reset-cancel" type="button">Cancelar</button>
        <button class="archive-delete-confirm" type="submit">Criar nova carteira</button>
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
const archiveElement = shadow.querySelector(".archive-list");
const simulationEquityElement = shadow.querySelector(".simulation-equity");
const simulationMetricsElement = shadow.querySelector(".simulation-metrics");
const simulationStatusElement = shadow.querySelector(".simulation-status");
const simulationPositionsElement = shadow.querySelector(".simulation-positions");
const simulationOrdersElement = shadow.querySelector(".simulation-orders");
const simulationOrderHistoryElement = shadow.querySelector(".simulation-order-history");
const simulationFillsElement = shadow.querySelector(".simulation-fills");
const simulationClearHistoryButton = shadow.querySelector(".simulation-clear-history");
const simulationClearActivityButton = shadow.querySelector(".simulation-clear-activity");
const simulationResetWalletButton = shadow.querySelector(".simulation-reset-wallet");
const simulationResetBackdrop = shadow.querySelector(".simulation-reset-backdrop");
const simulationResetForm = shadow.querySelector(".simulation-reset-dialog");
const simulationResetInitialCashInput = shadow.querySelector(".simulation-reset-initial-cash");
const simulationResetConfirmButton = simulationResetForm.querySelector('[type="submit"]');
const simulationResetCancelButton = simulationResetForm.querySelector(".simulation-reset-cancel");
const archiveSelectAllInput = shadow.querySelector(".archive-select-all-input");
const archiveDeleteSelectedButton = shadow.querySelector(".archive-delete-selected");
const archiveClearAllButton = shadow.querySelector(".archive-clear-all");
const archiveDeleteBackdrop = shadow.querySelector(".archive-delete-backdrop");
const archiveDeleteTitle = shadow.querySelector("#archive-delete-title");
const archiveDeleteMessage = shadow.querySelector(".archive-delete-message");
const archiveDeleteConfirmButton = shadow.querySelector(".archive-delete-confirm");
const walletForm = shadow.querySelector(".wallet-settings");
const walletInput = walletForm.querySelector('[name="walletAddress"]');
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
let favoriteOutcomeFilter = "all";
let archivedRules = [];
let selectedArchiveIds = new Set();
let pendingArchiveDeleteIds = [];
let walletAddress = "";
let quotes = [];
let activeMarketKey = "";
let executionStates = {};
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
shadow.querySelector(".analysis-refresh").addEventListener("click", refreshMarketAnalysisBook);
simulationClearHistoryButton.addEventListener("click", clearSimulationOrderHistory);
simulationClearActivityButton.addEventListener("click", clearSimulationActivity);
simulationResetWalletButton.addEventListener("click", openSimulationResetDialog);
simulationResetForm.addEventListener("submit", resetSimulationWallet);
simulationResetCancelButton.addEventListener("click", closeSimulationResetDialog);
simulationResetBackdrop.addEventListener("click", (event) => {
  if (event.target === simulationResetBackdrop) closeSimulationResetDialog();
});
backdrop.addEventListener("click", togglePanel);
shadow.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => selectView(tab.dataset.view));
});
setupExecutionParameterUI();
shadow.querySelector(".execution-parameter-create").addEventListener("click", () => {
  resetExecutionParameterForm();
  selectView("parameters");
});
shadow.querySelectorAll(".simulation-tab").forEach((tab, index, tabs) => {
  tab.addEventListener("click", () => selectSimulationWindow(tab.dataset.simulationTab));
  tab.addEventListener("keydown", (event) => {
    const keyDirections = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const target = event.key === "Home" ? tabs[0] : tabs[tabs.length - 1];
      selectSimulationWindow(target.dataset.simulationTab);
      target.focus();
      return;
    }
    if (!keyDirections[event.key]) return;
    event.preventDefault();
    const nextIndex = (index + keyDirections[event.key] + tabs.length) % tabs.length;
    selectSimulationWindow(tabs[nextIndex].dataset.simulationTab);
    tabs[nextIndex].focus();
  });
});
setupRuleBoard();
shadow.querySelectorAll(".favorite-filter").forEach((button) => {
  button.addEventListener("click", () => {
    const selectedFilter = button.dataset.outcomeFilter;
    favoriteOutcomeFilter = favoriteOutcomeFilter === selectedFilter ? "all" : selectedFilter;
    renderFavorites();
  });
});
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
    if (!simulationResetBackdrop.hidden) {
      closeSimulationResetDialog();
    } else if (!archiveDeleteBackdrop.hidden) {
      closeArchiveDeleteDialog();
    } else if (!favoriteDialogBackdrop.hidden) {
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

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes[RULES_KEY]?.newValue) {
    rules = changes[RULES_KEY].newValue;
    renderRules();
  }
  if (changes[FAVORITES_KEY]?.newValue) {
    favorites = changes[FAVORITES_KEY].newValue;
    renderRules();
  }
  if (changes[ARCHIVE_KEY]?.newValue) {
    archivedRules = Array.isArray(changes[ARCHIVE_KEY].newValue) ? changes[ARCHIVE_KEY].newValue : [];
    const archiveIds = new Set(archivedRules.map((entry) => entry.id));
    selectedArchiveIds = new Set([...selectedArchiveIds].filter((id) => archiveIds.has(id)));
    renderArchive();
  }
  if (changes[WALLET_KEY]?.newValue !== undefined) {
    walletAddress = changes[WALLET_KEY].newValue || "";
    walletInput.value = walletAddress;
  }
  if (changes[EXECUTION_PARAMETERS_KEY]) {
    executionParameters = normalizeExecutionParameters(changes[EXECUTION_PARAMETERS_KEY].newValue);
    renderExecutionParameters();
  }
  if (changes[EXECUTION_PARAMETER_FAVORITES_KEY]) {
    executionParameterFavorites = normalizeExecutionParameters(changes[EXECUTION_PARAMETER_FAVORITES_KEY].newValue);
    renderExecutionParameters();
  }
  if ([SIMULATION_ACCOUNT_KEY, SIMULATION_ORDERS_KEY, SIMULATION_LEDGER_KEY]
    .some((key) => changes[key])) {
    refreshSimulation().catch((error) => {
      simulationStatus = `Falha ao carregar simulação: ${error.message || error}`;
      renderSimulation();
    });
  }
  const stateKey = activeMarketKey && executionStorageKey(activeMarketKey);
  if (stateKey && changes[stateKey]?.newValue) {
    executionStates = changes[stateKey].newValue;
    renderRules();
  }
});

migrateMarketAgnosticStorage().then(async (stored) => {
  rules = Array.isArray(stored[RULES_KEY]) ? stored[RULES_KEY] : [];
  favorites = Array.isArray(stored[FAVORITES_KEY]) ? stored[FAVORITES_KEY] : [];
  archivedRules = Array.isArray(stored[ARCHIVE_KEY]) ? stored[ARCHIVE_KEY] : [];
  walletAddress = typeof stored[WALLET_KEY] === "string" ? stored[WALLET_KEY] : "";
  executionParameters = normalizeExecutionParameters(stored[EXECUTION_PARAMETERS_KEY]);
  executionParameterFavorites = normalizeExecutionParameters(stored[EXECUTION_PARAMETER_FAVORITES_KEY]);
  walletInput.value = walletAddress;
  let migratedFavorites = false;
  rules = rules.map((rule) => {
    if (!rule.favorite) return rule;
    if (!favorites.some((item) => item.sourceRuleId === rule.id)) {
      favorites.push(createFavoriteTemplate(
        rule,
        `${rule.outcome} · ${rule.side === "buy" ? "Comprar" : "Vender"}`.slice(0, 60),
        rule.id
      ));
    }
    const cleanRule = { ...rule };
    delete cleanRule.favorite;
    migratedFavorites = true;
    return cleanRule;
  });
  renderRules();
  renderArchive();
  try {
    await initializeSimulation();
  } catch (error) {
    showToast("Não foi possível iniciar a simulação", error.message || String(error), "error");
  }
  if (migratedFavorites) {
    try {
      await navigator.locks.request("polymakr-rules-storage", async () => {
        const stored = await chrome.storage.local.get(RULES_KEY);
        const storedRules = Array.isArray(stored[RULES_KEY]) ? stored[RULES_KEY] : [];
        const cleanedRules = storedRules.map((rule) => {
          if (!rule.favorite) return rule;
          const cleanRule = { ...rule };
          delete cleanRule.favorite;
          return cleanRule;
        });

        await chrome.storage.local.set({ [RULES_KEY]: cleanedRules });
        rules = cleanedRules;
      });
      await persistFavorites();
    } catch (error) {
      showToast("Falha ao atualizar dados locais", error.message || String(error), "error");
    }
  }
  scan();
}).catch((error) => {
  showToast("Não foi possível carregar as regras", error.message || String(error), "error");
});

walletForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = walletInput.value.trim();
  if (value && !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    walletInput.setCustomValidity("Informe um endereço público EVM válido (0x seguido de 40 caracteres hexadecimais).");
    walletInput.reportValidity();
    return;
  }
  walletInput.setCustomValidity("");
  try {
    walletAddress = value.toLowerCase();
    await chrome.storage.local.set({ [WALLET_KEY]: walletAddress });
    showToast("Carteira salva", "O endereço público será associado às novas regras automatizadas.", "success");
  } catch (error) {
    showToast("Não foi possível salvar a carteira", error.message || String(error), "error");
  }
});
walletInput.addEventListener("input", () => walletInput.setCustomValidity(""));
archiveSelectAllInput.addEventListener("change", () => {
  selectedArchiveIds = archiveSelectAllInput.checked
    ? new Set(archivedRules.map((entry) => entry.id))
    : new Set();
  renderArchive();
});
archiveDeleteSelectedButton.addEventListener("click", () => {
  openArchiveDeleteDialog([...selectedArchiveIds], false);
});
archiveClearAllButton.addEventListener("click", () => {
  openArchiveDeleteDialog(archivedRules.map((entry) => entry.id), true);
});
archiveDeleteBackdrop.addEventListener("click", (event) => {
  if (event.target === archiveDeleteBackdrop) closeArchiveDeleteDialog();
});
archiveDeleteBackdrop.querySelector(".archive-delete-cancel").addEventListener("click", closeArchiveDeleteDialog);
archiveDeleteConfirmButton.addEventListener("click", deleteConfirmedArchiveEntries);

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
