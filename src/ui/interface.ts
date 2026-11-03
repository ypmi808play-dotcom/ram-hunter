import { GAME, GAME_TITLE, RUN_MODES } from '../core/config';
import type { RunMode } from '../core/config';
import { formatTime } from '../core/session';
import type { RunSession, RunResult } from '../core/session';
import type { DataCenterPlan } from '../core/empire';
import { ABILITIES } from '../core/abilities';
import type { AbilityId } from '../core/abilities';
import { WANTED, WANTED_LABELS } from '../core/wanted';
import { DROPS } from '../core/balance';
import { EXTRACTION_STATUS_LABELS } from '../core/ExtractionSystem';
import { HOUSE_EVENT_INFO } from '../core/HouseEventManager';

const root = () => document.querySelector<HTMLDivElement>('#ui')!;
export function mount(html: string) { root().innerHTML = html; }
export function button(id: string, handler: () => void) { document.getElementById(id)?.addEventListener('click', handler); }
export function sceneLabel(value: string) { document.getElementById('scene-label')!.textContent = value; }
export function hasModal() { return !!document.querySelector('.modal-shade'); }

export function titleUI(
  start: () => void,
  lab: () => void,
  mode: RunMode = 'normal',
  onMode: (mode: RunMode) => void = () => {},
  riskMode = false,
  onRiskMode: (risk: boolean) => void = () => {}
) {
  sceneLabel('READY WHEN YOU ARE');
  mount(`<div class="title-screen"><div class="title-copy"><p class="eyebrow"><i></i> ${GAME_TITLE.brand} · STEALTH &amp; COMBAT OVERHAUL</p><h1 class="title-english"><span>FOR THE GREATER</span><br>COMPUTE<span class="title-period">.</span></h1><p class="title-sub">${GAME_TITLE.subtitle}</p><p class="title-description">街のメモリを静かに、あるいは大胆に集めて、<br>途方もないAIデータセンター帝国を建設しよう。</p><div class="mode-selector" aria-label="ゲーム設定"><button id="mode-normal" aria-pressed="true">NORMAL <b>04:30</b></button><button id="mode-classic" aria-pressed="false">CLASSIC <b>03:00</b></button><button id="toggle-risk-mode" class="risk-toggle" aria-pressed="${String(riskMode)}">RISK MODE <b id="risk-state">${riskMode ? 'ON' : 'OFF'}</b></button></div><div class="title-actions"><button class="primary" id="start-game">START GAME <span>↗</span></button><button class="text-button" id="how-to">HOW TO PLAY <span>?</span></button></div><p class="start-hint">PRESS ENTER TO CHASE THE NEXT GIGABYTE · LEFT CTRL TO CROUCH</p></div><div class="edition-stamp"><span>100% FICTION</span><b>∞</b><span>0% RESTRAINT</span></div><div class="title-caption"><span class="pixel-star">✦</span> ${GAME_TITLE.english.toUpperCase()}</div><div class="title-facts"><div><b id="title-duration">04:30</b><span>MINUTES OF CHAOS</span></div><div><b>14</b><span>UNSUSPECTING HOMES</span></div><div><b>∞</b><span>COMPUTATIONAL AMBITION</span></div><button class="lab-link" id="empire-lab">DATA CENTER LAB <span>↗</span></button></div></div>`);
  button('start-game', start); button('empire-lab', lab); button('how-to', showHelp);
  const selectMode = (chosen: RunMode) => {
    onMode(chosen);
    for (const id of ['normal', 'classic']) document.getElementById('mode-' + id)?.setAttribute('aria-pressed', String(chosen === id));
    document.getElementById('title-duration')!.textContent = formatTime(RUN_MODES[chosen].durationMs);
  };
  let currentRisk = riskMode;
  const updateRiskUI = (val: boolean) => {
    currentRisk = val;
    onRiskMode(val);
    const btn = document.getElementById('toggle-risk-mode');
    const st = document.getElementById('risk-state');
    btn?.setAttribute('aria-pressed', String(val));
    if (st) st.textContent = val ? 'ON' : 'OFF';
  };
  button('mode-normal', () => selectMode('normal'));
  button('mode-classic', () => selectMode('classic'));
  button('toggle-risk-mode', () => updateRiskUI(!currentRisk));
  selectMode(mode);
}

export function showHelp() {
  if (hasModal()) return;
  const panel = document.createElement('div'); panel.className = 'modal-shade';
  panel.innerHTML = `<section class="modal help" role="dialog" aria-modal="true" aria-labelledby="help-title"><p class="eyebrow">${GAME_TITLE.english.toUpperCase()} / FIELD GUIDE</p><h2 id="help-title">${GAME_TITLE.subtitle}</h2><ol><li><b>視野角と発見ゲージ（0〜100）</b><span>敵の視界に入ると頭上の発見ゲージが上昇（1〜39「？」不審 → 40〜99「！」警戒確認 → 100で追跡開始）。<kbd>Left Ctrl</kbd> でしゃがみ移動、または家具の陰に隠れると視線を遮断できます（至近距離の正面ではしゃがんでも発見されます）。</span></li><li><b>室内敵と特殊攻撃の予備動作</b><span>後半の住宅には警戒住民（通報）、民間警備員（警棒突進）、エリート警備員（正面ダメージ半減・背面弱点）、警備ロボット（EMPパルスで特殊能力3秒封印・撃破で8〜32GBドロップ）、戦闘ドローン（3連バースト・撃破で16〜32GBドロップ）が登場します。</span></li><li><b>5段階の住宅難易度と監視カメラ</b><span>住宅1〜3（EASY）から住宅14（EXTREME / AI Mega-Server Villa・最大512GB）まで危険度と報酬が段階的に上昇。後半住宅の監視カメラやレーザーに注意！</span></li><li><b>途中撤退とRISK MODE</b><span>街の撤退バンで <b>EXTRACT RAM?</b> から安全にRAMを持ち帰れます。RISK MODE有効時はライフ0（-20%）や時間切れ（-10%）で未消費RAMの一部を失います。</span></li></ol><div class="help-attacks"><b>Z</b><span>チップ投げ / 無料 / 10ダメージ / 長押し連射</span><b>X</b><span>ハルシネーション / 8GB / 3秒混乱</span><b>C</b><span>巨額投資 / 無料 / 最大4秒陽動</span><b>Q</b><span>AGI覚醒 / 32GB / 5秒スタン</span></div><p class="help-tip">特殊攻撃は建設用RAMを消費。5秒未発見で警戒が低下。市民は自宅だけ、屋外警官は屋外だけで行動します。F2キーでステルス視界デバッグ表示を切替可能。</p><button class="primary" id="close-help">GOT IT. LET'S GO. <span>→</span></button><small>すべて架空の風刺表現です。現実の行為を推奨するものではありません。</small></section>`;
  root().append(panel);
  const close = () => { panel.remove(); document.getElementById('how-to')?.focus(); window.removeEventListener('keydown', key); };
  const key = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.stopPropagation(); close(); } };
  window.addEventListener('keydown', key);
  button('close-help', close); document.getElementById('close-help')?.focus();
}

export function playUI() {
  mount(`<div class="play-hud"><div class="vital-panel"><span class="hud-label">SAM / VITALS</span><div id="hearts" class="hearts" aria-label="ライフ3">♥ ♥ ♥</div><small id="stealth-status" class="stealth-badge">STANDING · NORMAL NOISE</small></div><div class="stage-panel"><span id="stage-name">01 / MAPLEWOOD SUBURBS</span><b id="timer">03:00</b><div class="time-track"><i id="time-fill"></i></div></div><div class="ram-panel"><span class="hud-label">AVAILABLE RAM / 建設用</span><div><b id="ram-value">0</b><span>GB</span><img alt="" src="./favicon.svg"></div><small id="ram-ledger">累計 0 GB / 消費 0 GB</small><small id="pc-count">00 COMPUTERS EMPTIED</small><small id="ko-count">KO 00 / DRONE RAM 0/64 GB</small></div></div>
  <div class="route-hud"><span id="house-count">00 / 14 HOUSES</span><div class="route-track"><i id="route-position"></i><span id="route-visited"></span></div><span id="risk-badge">STANDARD</span></div>
  <div class="wanted-panel"><div><span>WANTED</span><b id="wanted-level">LV.0</b></div><div id="wanted-stars">☆ ☆ ☆ ☆ ☆</div><small id="wanted-label">通常状態</small><div id="wanted-track" class="wanted-track"><i id="wanted-fill"></i></div><small id="wanted-sight">KEEP A LOW PROFILE</small></div>
  <div id="interaction" class="interaction hidden"></div><div class="mission-tip" id="mission-tip"><span>THE PLAN / STEALTH OR CHAOS</span><b>Ctrlでしゃがみ移動。E長押しで回収。撤退バンで途中撤退も可能！</b></div><div class="inside-badge hidden" id="inside-badge"></div>
  <div id="action-message" class="action-message hidden" role="status" aria-live="polite"></div>
  <div class="ability-bar" aria-label="攻撃とクールダウン">${(Object.entries(ABILITIES) as [AbilityId, typeof ABILITIES[AbilityId]][]).map(([id, a]) => `<button id="ability-${id}" class="ability" aria-label="${a.key}：${a.label}、${a.cost ? `${a.cost}GB消費` : 'RAM消費なし'}"><kbd>${a.key}</kbd><div><b>${a.name}</b><span>${a.cost ? `${a.cost} GB` : 'FREE'} <em id="cooldown-${id}">READY</em></span></div><div class="ability-track"><i id="cooldown-fill-${id}"></i></div></button>`).join('')}</div><button id="pause-button" class="pause-button" aria-label="ポーズ">Ⅱ</button>`);
}

function change(id: string, text: string) { const el = document.getElementById(id); if (el && el.textContent !== text) el.textContent = text; }
export function updateHUD(run: RunSession, position: number, interiorId?: number) {
  change('hearts', '♥ '.repeat(run.lives) + '♡ '.repeat(GAME.lives - run.lives));
  document.getElementById('hearts')?.setAttribute('aria-label', `ライフ${run.lives}`);
  const empJammed = run.isEmpJammed;
  change('stealth-status', empJammed ? '⚡ EMP JAMMED · ABILITIES LOCKED' : run.stealth.crouching ? '🕵 CROUCHING · STEALTH (55%)' : 'STANDING · NORMAL');
  document.getElementById('stealth-status')?.classList.toggle('crouching', run.stealth.crouching);
  change('ram-value', run.availableRamGB.toLocaleString());
  change('ram-ledger', `累計 ${run.totalCollectedRamGB} GB / 消費 ${run.spentRamGB} GB`);
  change('pc-count', `${String(run.collected.size).padStart(2, '0')} COMPUTERS EMPTIED`);
  change('ko-count', 'KO ' + String(run.stats.enemiesDefeated).padStart(2, '0') + ' / DRONE RAM ' + run.stats.ramFromDrones + '/' + DROPS.droneRunCapGB + ' GB');
  change('timer', formatTime(run.remainingMs));
  document.getElementById('timer')?.classList.toggle('urgent', run.remainingMs < 30_000);
  document.getElementById('time-fill')!.style.width = `${run.remainingMs / run.durationMs * 100}%`;
  change('house-count', `${String(run.visited.size).padStart(2, '0')} / 14 HOUSES`);
  change('risk-badge', run.riskMode ? '⚠ RISK MODE' : 'AI EMPIRE →');
  document.getElementById('route-position')!.style.left = `${Math.min(100, position / GAME.streetWidth * 100)}%`;
  document.getElementById('route-visited')!.style.width = `${run.visited.size / GAME.houseCount * 100}%`;
  const badge = document.getElementById('inside-badge')!;
  badge.classList.toggle('hidden', interiorId === undefined);
  if (interiorId !== undefined) {
    const ev = run.houseEvents.forHouse(interiorId);
    const evLabel = ev ? ` · ${HOUSE_EVENT_INFO[ev.type].badge}` : '';
    change('inside-badge', `HOUSE ${String(interiorId + 1).padStart(2, '0')}${evLabel} / ドアに戻って E で退出`);
  }
  if (run.elapsedMs > 11_000) document.getElementById('mission-tip')?.classList.add('hidden');
  change('wanted-level', `LV.${run.wanted.level}`);
  change('wanted-stars', '★ '.repeat(run.wanted.level) + '☆ '.repeat(5 - run.wanted.level));
  change('wanted-label', WANTED_LABELS[run.wanted.level]);
  change('wanted-sight', run.wanted.spotted || run.wanted.pursuing ? 'SPOTTED / 追跡中' : run.wanted.heat === 0 ? 'KEEP A LOW PROFILE' : run.wanted.unseenMs < WANTED.unseenGraceMs ? `未発見 ${(Math.max(0, WANTED.unseenGraceMs - run.wanted.unseenMs) / 1000).toFixed(1)}sで低下` : 'COOLING DOWN / 警戒低下中');
  document.getElementById('wanted-fill')!.style.width = `${run.wanted.heat / WANTED.maxHeat * 100}%`;
  document.querySelector('.wanted-panel')?.classList.toggle('maximum', run.wanted.level === 5);
  for (const id of (Object.keys(ABILITIES) as AbilityId[])) {
    const a = ABILITIES[id], remaining = run.cooldowns.remaining(id, run.elapsedMs), affordable = run.availableRamGB >= a.cost;
    const jammed = empJammed && id !== 'chip';
    const btn = document.getElementById(`ability-${id}`) as HTMLButtonElement;
    btn.disabled = remaining > 0 || !affordable || jammed;
    btn.classList.toggle('unaffordable', !affordable || jammed);
    change(`cooldown-${id}`, jammed ? 'EMP JAM' : remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : affordable ? 'READY' : 'RAM不足');
    document.getElementById(`cooldown-fill-${id}`)!.style.width = `${(1 - remaining / a.cooldownMs) * 100}%`;
  }
}
export function actionMessage(text: string, error = false) {
  const el = document.getElementById('action-message');
  if (el) { el.textContent = text; el.classList.toggle('hidden', !text); el.classList.toggle('error', error); }
}

let previousPrompt = '';
export function prompt(html = '', progress?: number) {
  const el = document.getElementById('interaction');
  if (!el) return;
  el.classList.toggle('hidden', !html);
  if (el.innerHTML !== html && (html !== previousPrompt || !el.innerHTML)) { el.innerHTML = html; previousPrompt = html; }
  const bar = document.getElementById('collect-fill');
  if (bar && progress !== undefined) bar.style.width = `${progress * 100}%`;
}

export function extractionPrompt(
  label: string,
  availableRamGB: number,
  progress: number,
  onExtract: () => void,
  onContinue: () => void
) {
  const el = document.getElementById('interaction');
  if (!el) return;
  el.classList.remove('hidden');
  const marker = `extract-ui:${label}:${availableRamGB}`;
  if (previousPrompt !== marker) {
    previousPrompt = marker;
    el.innerHTML = `<div class="extract-dialog"><strong>EXTRACT RAM?</strong> <span>(${label})</span><small>現在確保可能なRAM: <b>${availableRamGB} GB</b> · <kbd>E</kbd> 長押し または ボタンで選択</small><div class="extract-actions"><button id="btn-extract-confirm" class="extract-btn confirm">EXTRACT / RAMを持ち帰る</button><button id="btn-extract-continue" class="extract-btn cancel">CONTINUE / 探索を続ける</button></div><div class="collect-track"><i id="collect-fill"></i></div></div>`;
    document.getElementById('btn-extract-confirm')?.addEventListener('click', onExtract);
    document.getElementById('btn-extract-continue')?.addEventListener('click', onContinue);
  }
  const bar = document.getElementById('collect-fill');
  if (bar) bar.style.width = `${progress * 100}%`;
}

export function pulseRam() {
  const el = document.querySelector('.ram-panel')!;
  el.classList.remove('ram-pop'); void (el as HTMLElement).offsetWidth; el.classList.add('ram-pop');
}

export function pauseUI(resume: () => void, restart: () => void, title: () => void) {
  prompt('');
  const el = document.createElement('div'); el.id = 'pause-overlay'; el.className = 'modal-shade';
  el.innerHTML = `<section class="modal pause-modal" role="dialog" aria-modal="true" aria-labelledby="pause-title"><p class="eyebrow">EVEN AMBITION NEEDS A BREAK</p><h2 id="pause-title">RAM ON HOLD.</h2><p>タイマーは停止中。街のPCも、ひと休み。</p><button class="primary" id="resume">RESUME <span>→</span></button><button class="secondary" id="restart">RESTART RUN</button><button class="text-button" id="return-title">BACK TO TITLE</button><small>Escキーでも再開できます。</small></section>`;
  root().append(el); button('resume', resume); button('restart', restart); button('return-title', title); document.getElementById('resume')?.focus();
}
export function closePause() { document.getElementById('pause-overlay')?.remove(); }

export function resultUI(result: RunResult, plan: DataCenterPlan, preview: boolean, best: number) {
  sceneLabel(preview ? 'DATA CENTER LAB / PREVIEW' : 'RUN COMPLETE / EMPIRE BUILT');
  const statusInfo = EXTRACTION_STATUS_LABELS[result.reason] ?? EXTRACTION_STATUS_LABELS.goal;
  const securedRam = result.securedRamGB ?? result.availableRamGB;
  const lostRam = result.lostRamGB ?? 0;
  const extractionBadge = result.extractionStatus ?? statusInfo.badge;
  const combatStats = [
    ['EXTRACTION STATUS', extractionBadge],
    ['ENEMIES DEFEATED', result.enemiesDefeated],
    ['CIVILIANS DEFEATED', result.civiliansDefeated],
    ['POLICE DEFEATED', result.policeDefeated],
    ['DRONES DEFEATED', result.dronesDefeated],
    ['RAM FROM DRONES', result.ramFromDrones + ' GB'],
    ['HIGHEST WANTED LEVEL', result.highestWantedLevel]
  ];
  mount(`<div class="result-screen ${preview ? 'preview-result' : 'run-result'}">
    <header class="result-heading"><p class="eyebrow">${preview ? 'DATA CENTER LAB · 成長プレビュー' : `${statusInfo.title} · ${RUN_MODES[result.mode].label}${result.riskMode ? ' · RISK MODE' : ''}`}</p><h1>YOUR AI <em>EMPIRE.</em></h1><p id="empire-quote">${plan.quote}</p></header>
    <div class="empire-name"><span id="empire-level">LEVEL ${plan.level} / ${plan.name}</span><small id="empire-kind">${plan.label}</small></div>
    <div class="build-status"><i id="build-light"></i><span id="build-status">BREAKING GROUND…</span><button id="skip-build" class="text-button">SKIP ↗</button></div>
    <div class="empire-meter"><span>RAM → INFRASTRUCTURE</span><div><i id="build-meter"></i></div><b id="build-percent">0%</b></div>
    <div class="result-stats"><div class="total"><span>RAM SECURED / 最終確保RAM</span><b id="result-available">${securedRam.toLocaleString()}<small> GB</small></b><small class="ram-breakdown"><span>TOTAL RAM COLLECTED <b id="result-collected">${result.totalCollectedRamGB}</b> GB</span><span>RAM SPENT <b id="result-spent">${result.spentRamGB}</b> GB</span><span>RAM LOST <b id="result-lost">${lostRam}</b> GB</span><span>RAM SECURED <b id="result-secured">${securedRam}</b> GB</span></small></div>
      <div><span>COMPUTERS EMPTIED</span><b>${String(result.computersEmptied).padStart(2, '0')}</b></div><div><span>HOUSES VISITED</span><b>${String(result.housesVisited).padStart(2, '0')}</b></div>
      <div><span>DATA CENTER LEVEL</span><b id="result-level">${String(plan.level).padStart(2, '0')}<small> / 06</small></b></div><div class="score"><span>TOTAL SCORE</span><b>${result.score.toString().padStart(6, '0')}</b><small>${preview ? 'PREVIEW / スコア記録なし' : `BEST ${best.toLocaleString()}${result.riskMode ? ' (RISK)' : ''}`}</small></div></div>
    ${preview ? `<div class="lab-controls"><label for="lab-ram">RAM <b id="lab-value">${securedRam}</b> GB</label><input type="range" min="0" max="4096" step="4" value="${securedRam}" id="lab-ram" aria-label="プレビューするRAM量"><div>${[16,64,192,384,768,1536].map((gb,i) => `<button data-ram="${gb}">LV.${i+1}</button>`).join('')}</div></div>` : `<div class="combat-result-stats">${combatStats.map(([name,value]) => `<div><span>${name}</span><b id="${name === 'EXTRACTION STATUS' ? 'result-extraction-status' : ''}">${value}</b></div>`).join('')}</div>`}
    <div class="result-actions"><button class="primary" id="play-again">${preview ? 'START GAME' : 'PLAY AGAIN'} <span>↗</span></button><button class="secondary" id="back-title">BACK TO TITLE</button><p>${preview ? 'RAM量を変えて、建設規模を見比べよう。' : `${extractionBadge} / TIME BONUS +${result.timeBonus} / ${GAME_TITLE.subtitle}`}</p></div>
  </div>`);
}
