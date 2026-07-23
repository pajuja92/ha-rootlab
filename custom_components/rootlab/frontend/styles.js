export const CSS = `
:host {
  --rl-green:   #3B7D3F;
  --rl-soil:    #7A5C43;
  --rl-water:   #0277BD;
  --rl-harvest: #A66300;
  --rl-ai:      #6A4FA3;
  --rl-crisis:  #C62828;
  --rl-green-bg:   color-mix(in srgb, var(--rl-green) 12%, transparent);
  --rl-water-bg:   color-mix(in srgb, var(--rl-water) 12%, transparent);
  --rl-harvest-bg: color-mix(in srgb, var(--rl-harvest) 12%, transparent);
  --rl-ai-bg:      color-mix(in srgb, var(--rl-ai) 10%, transparent);
  --rl-crisis-bg:  color-mix(in srgb, var(--rl-crisis) 12%, transparent);
  --rl-radius: var(--ha-card-border-radius, 12px);
  --rl-gap: 16px;
  display: block;
  height: 100%;
  overflow-y: auto;
  background: var(--primary-background-color);
  color: var(--primary-text-color);
  font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
}
:host([dark]) {
  --rl-green:   #8BC98F;
  --rl-soil:    #B99C82;
  --rl-water:   #5BC4F0;
  --rl-harvest: #F0B860;
  --rl-ai:      #B9A6E3;
  --rl-crisis:  #EF8A80;
}
.appbar {
  display: flex; align-items: center; gap: 4px; padding: 0 8px; height: 56px;
  background: var(--app-header-background-color, var(--primary-color));
  color: var(--app-header-text-color, #fff);
  position: sticky; top: 0; z-index: 10;
}
.appbar .title { font-size: 20px; margin: 0 12px 0 4px; white-space: nowrap; }
.appbar .title b { font-weight: 600; }
.tabs { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; }
.tab {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px;
  border: none; border-radius: 999px; background: transparent; color: inherit;
  opacity: 0.75; font: inherit; font-size: 14px; cursor: pointer; white-space: nowrap;
}
.tab[data-active] { opacity: 1; background: color-mix(in srgb, currentColor 15%, transparent); font-weight: 500; }
.tab ha-icon { --mdc-icon-size: 18px; }
.content { max-width: 1400px; margin: 0 auto; padding: var(--rl-gap); padding-bottom: 96px; }
.section-title {
  font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase;
  color: var(--secondary-text-color); margin: 24px 0 8px;
  display: flex; align-items: center; gap: 8px;
}
.section-title:first-child { margin-top: 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--rl-gap); }
.card {
  position: relative; background: var(--card-background-color);
  border: 1px solid var(--divider-color); border-radius: var(--rl-radius);
  padding: var(--rl-gap); overflow: hidden;
}
.card.plant::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--rl-green); }
.card .header { display: flex; align-items: center; gap: 8px; }
.card .header h3 { margin: 0; font-size: 16px; font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.card .species { font-size: 13px; color: var(--secondary-text-color); margin: 2px 0 0 32px; }
.emoji { font-size: 22px; line-height: 1; }
.chip { font-size: 12px; padding: 2px 10px; border-radius: 999px; background: var(--rl-green-bg); color: var(--rl-green); white-space: nowrap; }
.chip.harvest { background: var(--rl-harvest-bg); color: var(--rl-harvest); }
.chip.crisis { background: var(--rl-crisis-bg); color: var(--rl-crisis); }
.chip.ai { background: var(--rl-ai-bg); color: var(--rl-ai); }
.chip.water { background: var(--rl-water-bg); color: var(--rl-water); }
.sensors { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.sensor-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
  border-radius: 999px; background: var(--rl-water-bg); color: var(--primary-text-color);
  font-size: 13px; cursor: pointer; border: none; font-family: inherit;
}
.sensor-chip ha-icon { --mdc-icon-size: 16px; color: var(--rl-water); }
.sensor-chip.unavailable { background: transparent; border: 1px dashed var(--divider-color); color: var(--secondary-text-color); }
.sensor-chip.unavailable ha-icon { color: var(--secondary-text-color); }
.ai-hint {
  display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 8px 12px;
  border-left: 3px solid var(--rl-ai); border-radius: 4px;
  background: var(--rl-ai-bg); color: var(--secondary-text-color); font-size: 13px;
}
.ai-hint ha-icon { color: var(--rl-ai); --mdc-icon-size: 16px; flex-shrink: 0; }
.warn-hint {
  display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 8px 12px;
  border-left: 3px solid var(--rl-harvest); border-radius: 4px;
  background: var(--rl-harvest-bg); color: var(--primary-text-color); font-size: 13px;
}
.warn-hint ha-icon { color: var(--rl-harvest); --mdc-icon-size: 16px; flex-shrink: 0; }
.actions { display: flex; justify-content: flex-end; gap: 4px; margin-top: 12px; align-items: center; flex-wrap: wrap; }
.icon-btn {
  border: none; background: transparent; color: var(--secondary-text-color);
  cursor: pointer; padding: 6px; border-radius: 50%; display: inline-flex;
}
.icon-btn:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
.icon-btn ha-icon { --mdc-icon-size: 18px; }
.btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
  border-radius: 999px; border: none; background: var(--rl-green); color: #fff;
  font: inherit; font-size: 14px; font-weight: 500; cursor: pointer;
}
:host([dark]) .btn:not(.ghost):not(.plain) { color: #1A1A1A; }
.btn.ghost {
  background: color-mix(in srgb, var(--rl-green) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--rl-green) 80%, transparent);
  color: var(--primary-text-color);
  font-weight: 500;
}
.btn.plain { color: var(--primary-text-color); }
.icon-btn { color: var(--primary-text-color); opacity: 0.72; }
.icon-btn:hover { opacity: 1; }
.btn.plain { background: transparent; color: var(--primary-text-color); font-weight: 400; }
.btn.ai { background: var(--rl-ai); }
.btn.small { padding: 4px 12px; font-size: 13px; }
.btn:disabled { opacity: 0.5; cursor: default; }
.btn ha-icon { --mdc-icon-size: 18px; }
.toolbar { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: var(--rl-gap); flex-wrap: wrap; align-items: center; }
.toolbar .spacer { flex: 1; }
.empty { text-align: center; padding: 48px 16px; color: var(--secondary-text-color); }
.empty ha-icon { --mdc-icon-size: 48px; color: var(--rl-green); }
.empty p { max-width: 460px; margin: 12px auto 20px; }
.zone-stat { display: flex; align-items: baseline; gap: 8px; margin-top: 8px; }
.zone-stat .num { font-size: 28px; font-weight: 300; color: var(--rl-green); }
.zone-stat .lbl { font-size: 13px; color: var(--secondary-text-color); }
dialog {
  border: none; border-radius: var(--rl-radius);
  background: var(--card-background-color); color: var(--primary-text-color);
  padding: 24px; width: min(480px, calc(100vw - 32px)); box-sizing: border-box;
}
dialog::backdrop { background: rgba(0, 0, 0, 0.4); }
dialog h2 { margin: 0 0 16px; font-size: 18px; font-weight: 500; }
dialog label { display: block; font-size: 13px; color: var(--secondary-text-color); margin: 12px 0 4px; }
dialog input, dialog select, dialog textarea {
  width: 100%; box-sizing: border-box; padding: 10px 12px;
  border: 1px solid var(--divider-color); border-radius: 8px;
  background: var(--primary-background-color); color: var(--primary-text-color);
  font: inherit; font-size: 14px;
}
dialog textarea { min-height: 72px; resize: vertical; }
dialog input:focus, dialog select:focus, dialog textarea:focus { outline: 2px solid var(--rl-green); border-color: transparent; }
dialog .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
.day-picker { display: flex; gap: 4px; flex-wrap: wrap; }
.day-picker label {
  margin: 0; display: inline-flex; align-items: center; gap: 4px;
  border: 1px solid var(--divider-color); border-radius: 999px; padding: 6px 10px;
  cursor: pointer; font-size: 13px; color: var(--primary-text-color); user-select: none;
}
.day-picker label:has(input:checked) { background: var(--rl-water-bg); border-color: var(--rl-water); color: var(--rl-water); }
.day-picker input { display: none; }
/* Nawadnianie */
.timeline { position: relative; height: 26px; margin: 12px 0 4px; background: color-mix(in srgb, var(--divider-color) 40%, transparent); border-radius: 6px; overflow: hidden; }
.timeline .block { position: absolute; top: 0; bottom: 0; background: var(--rl-water-bg); border-inline: 1px solid var(--rl-water); }
.timeline .block.active { background: var(--rl-water); animation: rl-pulse 2s ease-in-out infinite; }
.timeline .now { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--rl-crisis); }
.timeline-scale { display: flex; justify-content: space-between; font-size: 11px; color: var(--secondary-text-color); margin-bottom: 12px; }
@keyframes rl-pulse { 50% { opacity: 0.6; } }
.section-row { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-top: 1px solid var(--divider-color); flex-wrap: wrap; }
.section-row .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--divider-color); flex-shrink: 0; }
.section-row.active .dot { background: var(--rl-water); animation: rl-pulse 1.2s ease-in-out infinite; }
.section-row .info { flex: 1; min-width: 180px; }
.section-row .info .name { font-weight: 500; }
.section-row .info .sched { font-size: 13px; color: var(--secondary-text-color); margin-top: 2px; }
.section-row .countdown { font-size: 13px; color: var(--rl-water); font-variant-numeric: tabular-nums; }
.banner {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px; margin-bottom: var(--rl-gap);
  border-radius: var(--rl-radius); background: var(--rl-harvest-bg); color: var(--primary-text-color); font-size: 14px;
}
.banner ha-icon { color: var(--rl-harvest); }
.banner .spacer { flex: 1; }
/* Zadania */
.task-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-top: 1px solid var(--divider-color); }
.task-row input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--rl-green); margin-top: 2px; cursor: pointer; }
.task-row .body { flex: 1; min-width: 0; }
.task-row .title { font-size: 14px; }
.task-row.done .title { text-decoration: line-through; color: var(--secondary-text-color); }
.task-row .meta { font-size: 12px; color: var(--secondary-text-color); margin-top: 2px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.task-row .meta .overdue { color: var(--rl-crisis); }
/* FAB kryzysowy */
.fab {
  position: fixed; right: 24px; bottom: 24px; z-index: 20;
  width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
  background: var(--rl-crisis); color: #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.fab ha-icon { --mdc-icon-size: 26px; }
/* Kryzys */
.dropzone {
  border: 2px dashed var(--divider-color); border-radius: var(--rl-radius);
  padding: 24px; text-align: center; color: var(--secondary-text-color); cursor: pointer; margin-top: 4px;
}
.dropzone.hasimg { padding: 8px; }
.dropzone img { max-width: 100%; max-height: 220px; border-radius: 8px; display: block; margin: 0 auto; }
.dropzone ha-icon { --mdc-icon-size: 36px; color: var(--rl-crisis); }
.diagnosis { border-left: 3px solid var(--rl-ai); background: var(--rl-ai-bg); border-radius: 4px; padding: 12px; margin-top: 16px; }
.diagnosis h3 { margin: 0 0 6px; font-size: 15px; }
.diagnosis ol { margin: 8px 0 0; padding-left: 20px; font-size: 14px; }
.diagnosis .desc { font-size: 14px; }
.history-item { border-top: 1px solid var(--divider-color); padding: 8px 0; font-size: 13px; color: var(--secondary-text-color); }
/* Edytor */
.editor-wrap { background: var(--card-background-color); border: 1px solid var(--divider-color); border-radius: var(--rl-radius); padding: 8px; }
.editor-svg { width: 100%; height: auto; display: block; touch-action: none; background: color-mix(in srgb, var(--rl-green) 5%, var(--card-background-color)); border-radius: 8px; }
.editor-svg .grid-line { stroke: color-mix(in srgb, var(--divider-color) 60%, transparent); stroke-width: 0.02; }
.editor-svg .item { cursor: grab; }
.editor-svg .item.selected circle { stroke: var(--rl-ai); stroke-width: 0.12; }
.editor-svg .shadow { fill: rgba(0, 0, 0, 0.18); pointer-events: none; }
.editor-svg .shadow-line { stroke: rgba(0, 0, 0, 0.22); fill: none; stroke-linecap: round; pointer-events: none; }
.editor-svg text { font-size: 0.45px; fill: var(--primary-text-color); text-anchor: middle; pointer-events: none; }
.editor-hint { font-size: 13px; color: var(--secondary-text-color); margin: 8px 4px; }
.month-slider { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--secondary-text-color); }
.month-slider input { accent-color: var(--rl-harvest); }
select.inline, .toolbar select {
  padding: 8px 12px; border-radius: 999px; border: 1px solid var(--divider-color);
  background: var(--card-background-color); color: var(--primary-text-color); font: inherit; font-size: 14px;
}
/* Dialog: przycisk zamknięcia + szeroki wariant (karta rośliny) */
dialog { position: relative; }
dialog .dialog-x {
  position: absolute; top: 12px; right: 12px;
  border: none; background: transparent; color: var(--secondary-text-color);
  cursor: pointer; padding: 6px; border-radius: 50%; display: inline-flex;
}
dialog .dialog-x:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
dialog.wide { width: min(680px, calc(100vw - 32px)); max-height: calc(100vh - 64px); overflow-y: auto; }
/* Combobox z wyszukiwaniem */
.combo { position: relative; }
.combo-caret { position: absolute; right: 8px; top: 10px; color: var(--secondary-text-color); pointer-events: none; }
.combo-list {
  position: absolute; z-index: 30; left: 0; right: 0; top: 100%;
  max-height: 260px; overflow-y: auto;
  background: var(--card-background-color);
  border: 1px solid var(--divider-color); border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.35);
}
.combo-opt { padding: 8px 12px; cursor: pointer; display: flex; flex-direction: column; gap: 1px; }
.combo-opt:hover { background: color-mix(in srgb, var(--rl-green) 12%, transparent); }
.combo-opt.selected { background: var(--rl-green-bg); }
.combo-opt span { font-size: 14px; color: var(--primary-text-color); }
.combo-opt small { font-size: 11px; color: var(--secondary-text-color); }
.combo-empty { padding: 10px 12px; font-size: 13px; color: var(--secondary-text-color); }
/* Mikrofon (dyktowanie) */
.mic-btn { position: absolute; right: 6px; bottom: 6px; }
.mic-wrap { position: relative; }
.mic-btn.recording { color: var(--rl-crisis); animation: rl-pulse 1s ease-in-out infinite; }
/* Wykresy prognozy */
.chart-tabs { display: flex; gap: 6px; margin-bottom: 8px; }
.chart-svg { width: 100%; height: auto; display: block; }
.chart-svg text { font-size: 10px; fill: var(--secondary-text-color); }
.chart-svg .temp-line { fill: none; stroke: var(--rl-harvest); stroke-width: 2; }
.chart-svg .temp-line.min { stroke: var(--rl-water); }
.chart-svg .rain-bar { fill: var(--rl-water); opacity: 0.55; }
.chart-svg .gridline { stroke: var(--divider-color); stroke-width: 0.5; opacity: 0.6; }
/* Galeria zdjęć rośliny */
.photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; margin-top: 8px; }
.photo-grid .ph { position: relative; border-radius: 8px; overflow: hidden; aspect-ratio: 1; }
.photo-grid img { width: 100%; height: 100%; object-fit: cover; display: block; }
.photo-grid .ph .del {
  position: absolute; top: 2px; right: 2px; border: none; cursor: pointer;
  background: rgba(0,0,0,0.55); color: #fff; border-radius: 50%; width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
}
.note-row { display: flex; gap: 8px; align-items: flex-start; padding: 6px 0; border-top: 1px solid var(--divider-color); font-size: 13px; }
.note-row .date { color: var(--secondary-text-color); white-space: nowrap; }
.note-row .txt { flex: 1; }
/* Baza wiedzy */
.kn-search { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--divider-color); border-radius: 999px; background: var(--card-background-color); color: var(--primary-text-color); font: inherit; margin-bottom: var(--rl-gap); }
.kn-item h3 { margin: 0 0 4px; font-size: 15px; font-weight: 500; }
.kn-item .meta { font-size: 12px; color: var(--secondary-text-color); margin-bottom: 6px; display: flex; gap: 8px; align-items: center; }
.kn-item .body { font-size: 14px; white-space: pre-wrap; }
.kn-item .body.clamp { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
/* Edytor v2 */
.editor-svg .area { stroke-width: 0.08; cursor: grab; }
.editor-svg .area.greenhouse { fill: color-mix(in srgb, var(--rl-water) 18%, transparent); stroke: var(--rl-water); }
.editor-svg .area.bed { fill: color-mix(in srgb, var(--rl-soil) 30%, transparent); stroke: var(--rl-soil); }
.editor-svg .area.lawn { fill: color-mix(in srgb, var(--rl-green) 18%, transparent); stroke: color-mix(in srgb, var(--rl-green) 60%, transparent); }
.editor-svg .area.selected, .editor-svg .item.selected circle { stroke: var(--rl-ai); stroke-width: 0.14; }
.editor-svg .resize-handle { fill: var(--rl-ai); cursor: nwse-resize; }
.editor-svg.view-mode .item, .editor-svg.view-mode .area { cursor: pointer; }
.editor-svg .compass text { font-size: 0.9px; font-weight: 600; fill: var(--rl-crisis); }
.editor-svg .draw-preview { fill: color-mix(in srgb, var(--rl-ai) 15%, transparent); stroke: var(--rl-ai); stroke-dasharray: 0.3 0.2; stroke-width: 0.08; }
.mode-toggle { display: inline-flex; border: 1px solid var(--divider-color); border-radius: 999px; overflow: hidden; }
.mode-toggle button { border: none; background: transparent; color: var(--secondary-text-color); padding: 8px 14px; font: inherit; font-size: 14px; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
.mode-toggle button.on { background: var(--rl-green); color: #fff; }
:host([dark]) .mode-toggle button.on { color: #1A1A1A; }
/* Podkład satelitarny + mapa lokalizacji */
.sat-wrap { position: absolute; inset: 0; overflow: hidden; }
#sat-under { position: absolute; left: 50%; top: 50%; transform-origin: center; }
.editor-svg { position: relative; }
.editor-svg.sat-on { background: transparent; }
.editor-svg.sat-on .grid-line { stroke: rgba(255,255,255,0.35); }
.editor-svg.sat-on text { fill: #fff; paint-order: stroke; stroke: rgba(0,0,0,0.7); stroke-width: 0.06; }
.sat-attr {
  position: absolute; right: 4px; bottom: 2px; z-index: 3;
  font-size: 10px; color: #fff; text-shadow: 0 0 3px #000; pointer-events: none;
}
#map-view {
  position: relative; width: 100%; height: 360px; overflow: hidden;
  border-radius: 8px; background: #0a0a0a; touch-action: none; cursor: grab;
}
#map-tiles { position: absolute; inset: 0; }
.map-cross {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  color: var(--rl-crisis); --mdc-icon-size: 32px; pointer-events: none;
  filter: drop-shadow(0 0 2px #000);
}
.map-zoom { position: absolute; right: 8px; top: 8px; display: flex; flex-direction: column; gap: 4px; }
.map-zoom button {
  width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--divider-color);
  background: var(--card-background-color); color: var(--primary-text-color);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.compass .needle, .compass circle { cursor: grab; }
#toast {
  position: fixed; bottom: 28px; left: 50%; transform: translate(-50%, 12px);
  background: var(--card-background-color); border: 1px solid var(--rl-green);
  color: var(--primary-text-color); padding: 10px 20px; border-radius: 999px;
  font-size: 14px; opacity: 0; transition: opacity .25s, transform .25s;
  z-index: 60; pointer-events: none; box-shadow: 0 4px 14px rgba(0,0,0,0.35);
}
#toast.show { opacity: 1; transform: translate(-50%, 0); }
#toast.error { border-color: var(--rl-crisis); }
/* Modal generowania zadań */
.gen-zone { margin: 6px 0; }
.gen-zone-head { display: flex; gap: 8px; align-items: center; margin: 0; font-size: 14px; }
.gen-plant { display: flex; gap: 8px; align-items: center; margin: 4px 0 4px 24px; font-size: 14px; color: var(--primary-text-color); }
.gen-plant small { font-size: 12px; }
dialog input[type=checkbox], dialog input[type=radio] { width: auto; accent-color: var(--rl-green); }
.diff-add > span:first-of-type { color: var(--rl-green); font-weight: 700; }
.diff-del > span:first-of-type { color: var(--rl-crisis); font-weight: 700; }
.diff-add, .diff-del { margin-left: 0; flex-wrap: wrap; }
/* Kalendarz zadań */
.cal-head { display: flex; align-items: center; gap: 8px; margin: 4px 0 8px; }
.cal-head b { flex: 1; text-align: center; font-size: 15px; text-transform: capitalize; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.cal-dow { font-size: 11px; color: var(--secondary-text-color); text-align: center; padding: 2px 0; }
.cal-cell {
  min-height: 86px; border: 1px solid var(--divider-color); border-radius: 8px;
  padding: 4px; background: var(--card-background-color); overflow: hidden;
}
.cal-cell.other { opacity: 0.35; }
.cal-cell.today { border-color: var(--rl-green); box-shadow: inset 0 0 0 1px var(--rl-green); }
.cal-cell .d { font-size: 11px; color: var(--secondary-text-color); margin-bottom: 2px; }
.cal-chip {
  display: block; width: 100%; text-align: left; border: none; cursor: pointer;
  font-size: 11px; line-height: 1.3; padding: 2px 6px; margin-bottom: 2px;
  border-radius: 6px; background: var(--rl-green-bg); color: var(--primary-text-color);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: inherit;
}
.cal-chip.protection { background: var(--rl-harvest-bg); }
.cal-chip.crisis { background: var(--rl-crisis-bg); }
.cal-chip.manual { background: color-mix(in srgb, var(--secondary-text-color) 15%, transparent); }
.cal-chip.overdue { outline: 1px solid var(--rl-crisis); }
.cal-more { font-size: 10px; color: var(--secondary-text-color); }
.filter-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: var(--rl-gap); align-items: center; }
.filter-bar .combo { min-width: 170px; flex: 1; max-width: 240px; }
.filter-bar select { padding: 8px 12px; border-radius: 999px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); font: inherit; font-size: 13px; }
.combo-input {
  width: 100%; box-sizing: border-box; padding: 8px 30px 8px 12px;
  border: 1px solid var(--divider-color); border-radius: 8px;
  background: var(--primary-background-color); color: var(--primary-text-color);
  font: inherit; font-size: 14px;
}
/* Mapa: pasek narzędzi, punkty obrysu, hint zooma */
.map-toolbar { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
.map-toolbar .dims { font-size: 13px; color: var(--secondary-text-color); }
#map-hint {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.45); color: #fff; font-size: 14px; z-index: 5;
  opacity: 0; pointer-events: none; transition: opacity 0.25s; text-align: center; padding: 12px;
}
#map-hint.show { opacity: 1; }
.map-pt { position: absolute; width: 14px; height: 14px; border-radius: 50%;
  background: var(--rl-harvest); border: 2px solid #fff; transform: translate(-50%,-50%);
  box-shadow: 0 0 3px #000; cursor: grab; }
.map-pt:active { cursor: grabbing; }
#map-poly { position: absolute; inset: 0; pointer-events: none; }
#map-poly polyline, #map-poly polygon { fill: color-mix(in srgb, var(--rl-harvest) 25%, transparent); stroke: var(--rl-harvest); stroke-width: 2; }

@media (max-width: 600px) {
  :host { --rl-gap: 12px; }
  .appbar .title span { display: none; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;
