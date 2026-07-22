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
:host([dark]) .btn { color: #1A1A1A; }
.btn.ghost { background: transparent; border: 1px dashed var(--divider-color); color: var(--secondary-text-color); font-weight: 400; }
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
.editor-svg text { font-size: 0.45px; fill: var(--primary-text-color); text-anchor: middle; pointer-events: none; }
.editor-hint { font-size: 13px; color: var(--secondary-text-color); margin: 8px 4px; }
.month-slider { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--secondary-text-color); }
.month-slider input { accent-color: var(--rl-harvest); }
select.inline, .toolbar select {
  padding: 8px 12px; border-radius: 999px; border: 1px solid var(--divider-color);
  background: var(--card-background-color); color: var(--primary-text-color); font: inherit; font-size: 14px;
}
@media (max-width: 600px) {
  :host { --rl-gap: 12px; }
  .appbar .title span { display: none; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;
