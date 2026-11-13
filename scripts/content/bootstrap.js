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
    .tabs { display: grid; flex: 0 0 auto; grid-template-columns: repeat(4, 1fr); gap: 6px; padding: 10px 16px; border-bottom: 1px solid #edf0ed; }
    .tab { padding: 8px; border: 0; border-radius: 8px; background: transparent; color: #657168; cursor: pointer; font: inherit; font-size: 12px; font-weight: 650; }
    .tab[aria-selected="true"] { background: #e8f4ec; color: #087c3b; }
    .view { display: none; flex: 1 1 auto; min-height: 0; overflow: auto; padding: 18px;
      scrollbar-width: thin; scrollbar-color: #c5d0c8 transparent; }
    [data-panel="create"] form { max-width: 560px; margin: 0 auto; }
    .view.active { display: block; }
    .view[data-panel="rules"].active { display: flex; flex-direction: column; }
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
    .simulation-wallet-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: end; margin: 0 0 14px; padding: 12px; border: 1px solid #e6ebe7; border-radius: 10px; background: #f8faf8; }
    .simulation-wallet-form button { min-height: 34px; padding: 6px 10px; border: 0; border-radius: 7px; background: #a33b2e; color: #fff; cursor: pointer; font: inherit; font-size: 10px; font-weight: 700; }
    .simulation-wallet-form button:disabled { cursor: wait; opacity: .6; }
    .simulation-wallet-help { grid-column: 1 / -1; margin: 0; color: #78827b; font-size: 10px; }
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
    .simulation-actions { display: inline-flex; align-items: center; gap: 8px; }
    .simulation-cancel { padding: 4px 7px; border: 1px solid #f0d7d4; border-radius: 6px; background: #fff; color: #a33b2e; cursor: pointer; font: inherit; font-size: 9px; font-weight: 650; }
    .simulation-delete-history { padding: 4px 7px; border: 1px solid #f0d7d4; border-radius: 6px; background: #fff; color: #a33b2e; cursor: pointer; font: inherit; font-size: 9px; font-weight: 650; }
    .simulation-clear-history { min-height: 28px; padding: 5px 8px; border: 1px solid #f0d7d4; border-radius: 6px; background: #fff; color: #a33b2e; cursor: pointer; font: inherit; font-size: 10px; font-weight: 700; }
    .simulation-clear-history:disabled { cursor: not-allowed; opacity: .5; }
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
    .archive-delete-backdrop { position: fixed; z-index: 2147483650; inset: 0; display: grid; place-items: center; padding: 16px; background: #1118; }
    .archive-delete-backdrop[hidden] { display: none; }
    .archive-delete-dialog { display: grid; width: min(360px, 100%); gap: 12px; padding: 20px; border: 1px solid #e1e7e2; border-radius: 14px; background: #fff; box-shadow: 0 16px 48px #0003; }
    .archive-delete-dialog h2 { margin: 0; font-size: 15px; }
    .archive-delete-dialog p { margin: 0; color: #657168; font-size: 11px; }
    .archive-delete-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .archive-delete-actions button { padding: 9px; border: 0; border-radius: 8px; cursor: pointer; font: inherit; font-size: 11px; font-weight: 700; }
    .archive-delete-cancel { background: #f1f3f1; color: #435047; }
    .archive-delete-confirm { background: #a33b2e; color: #fff; }
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
      <button class="tab" type="button" role="tab" data-view="archive" aria-selected="false">Registro</button>
      <button class="tab" type="button" role="tab" data-view="simulation" aria-selected="false">Simulação</button>
    </nav>
    <div class="view active" data-panel="create" role="tabpanel">
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
          <div class="favorite-filters" role="group" aria-label="Filtrar favoritos por resultado">
            <button class="favorite-filter" type="button" data-outcome-filter="all" aria-pressed="true">Todos <span class="favorite-filter-count">0</span></button>
            <button class="favorite-filter" type="button" data-outcome-filter="Up" aria-pressed="false">UP <span class="favorite-filter-count">0</span></button>
            <button class="favorite-filter" type="button" data-outcome-filter="Down" aria-pressed="false">DOWN <span class="favorite-filter-count">0</span></button>
          </div>
          <div class="favorites"></div>
        </section>
      </div>
    </div>
    <div class="view" data-panel="archive" role="tabpanel" hidden>
      <div class="section-heading"><h2>Registro de regras</h2><span class="count-chip archive-count">0</span></div>
      <form class="wallet-settings">
        <label>Carteira pública (proxy wallet)<input name="walletAddress" type="text" maxlength="42" placeholder="0x..." autocomplete="off"></label>
        <button type="submit">Salvar carteira</button>
        <p class="wallet-help">Use o endereço público/proxy exibido na conta do Polymarket. Não informe chave privada nem credenciais.</p>
      </form>
      <div class="archive-actions">
        <label class="archive-select-all"><input class="archive-select-all-input" type="checkbox"> Selecionar todos</label>
        <button class="archive-delete-selected danger" type="button" disabled>Excluir selecionados (0)</button>
        <button class="archive-clear-all danger" type="button" disabled>Limpar tudo</button>
      </div>
      <div class="archive-list"></div>
    </div>
    <div class="view" data-panel="simulation" role="tabpanel" hidden>
      <div class="section-heading"><h2>Simulação ao vivo</h2><span class="count-chip">Carteira virtual</span></div>
      <p class="simulation-note">Carteira virtual · ordens sem envio real · livro atualizado enquanto o mercado estiver aberto.</p>
      <form class="simulation-wallet-form">
        <label>Saldo inicial da nova carteira (US$)<input class="simulation-initial-cash" type="number" min="0.01" max="1000000000" step="0.01" value="1000" required></label>
        <button class="simulation-reset-wallet" type="submit">Resetar e criar carteira</button>
        <p class="simulation-wallet-help">A ação apaga posições, ordens e fills da simulação atual. Regras e registros permanecem.</p>
      </form>
      <div class="simulation-overview">
        <div class="simulation-equity"></div>
        <div class="simulation-metrics"></div>
      </div>
      <p class="simulation-status empty" role="status"></p>
      <section class="simulation-section">
        <div class="simulation-section-heading"><h3>Posições</h3><span class="simulation-positions-count simulation-section-count">0</span></div>
        <div class="simulation-positions"></div>
      </section>
      <section class="simulation-section">
        <div class="simulation-section-heading"><h3>Ordens abertas</h3><span class="simulation-orders-count simulation-section-count">0</span></div>
        <div class="simulation-orders"></div>
      </section>
      <section class="simulation-section">
        <div class="simulation-section-heading">
          <div class="simulation-section-heading"><h3>Histórico de ordens</h3><span class="simulation-order-history-count simulation-section-count">0</span></div>
          <button class="simulation-clear-history" type="button" disabled>Limpar histórico</button>
        </div>
        <p class="simulation-history-note">Apagar registros não altera o saldo, as posições ou os preenchimentos.</p>
        <div class="simulation-order-history"></div>
      </section>
      <section class="simulation-section">
        <div class="simulation-section-heading"><h3>Atividade recente</h3><span class="simulation-fills-count simulation-section-count">0</span></div>
        <div class="simulation-fills"></div>
      </section>
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
const simulationWalletForm = shadow.querySelector(".simulation-wallet-form");
const simulationInitialCashInput = shadow.querySelector(".simulation-initial-cash");
const simulationResetWalletButton = shadow.querySelector(".simulation-reset-wallet");
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
simulationClearHistoryButton.addEventListener("click", clearSimulationOrderHistory);
simulationWalletForm.addEventListener("submit", resetSimulationWallet);
backdrop.addEventListener("click", togglePanel);
shadow.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => selectView(tab.dataset.view));
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
    if (!archiveDeleteBackdrop.hidden) {
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
