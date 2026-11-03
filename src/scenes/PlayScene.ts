import Phaser from 'phaser';
import { DETECTION, FEATURES, GAME, STAGES, VISION_PROFILES } from '../core/config';
import { RunSession, effectivePcRam, pcType } from '../core/session';
import type { EndReason, HouseData, PCData } from '../core/session';
import { Player } from '../game/Player';
import { audio } from '../audio/AudioEngine';
import * as ui from '../ui/interface';
import { street, interior, atticInterior } from '../art/worldArt';
import type { Parallax } from '../art/worldArt';
import { ABILITIES } from '../core/abilities';
import type { AbilityId, Lure } from '../core/abilities';
import { segmentIntersectsAnyRect } from '../core/geometry';
import type { Rect } from '../core/geometry';
import { CombatEffects } from '../game/CombatEffects';
import { EnemySystem } from '../game/EnemySystem';
import { DropSystem } from '../game/DropSystem';
import { HOUSE_TYPES, furnitureOccluderRect } from '../core/houses';
import { HOUSE_EVENT_INFO } from '../core/HouseEventManager';
import type { HouseEventRecord } from '../core/HouseEventManager';

interface PCView { data: PCData; image: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; glow?: Phaser.GameObjects.Graphics }
abstract class BasePlayScene extends Phaser.Scene {
  run!: RunSession; player!: Player; solids!: Phaser.Physics.Arcade.StaticGroup;
  protected enemySystem!: EnemySystem; private dropSystem!: DropSystem;
  paused = false; transitioning = false; protected interactionArmed = false;
  protected insideId?: number; protected inAttic = false; protected ground: number = GAME.streetGround;
  protected occluders: Rect[] = [];
  protected isCollecting = false;
  private hudElapsed = 0; private interactionRequested = false;
  private abilityRequests = new Set<AbilityId>(); private chipKey!: Phaser.Input.Keyboard.Key;
  private projectiles!: Phaser.Physics.Arcade.Group; private effects!: CombatEffects;
  private lureVisual?: Phaser.GameObjects.Image; private messageUntil = 0; private lastWanted = 0;
  private readonly abilityKeyHandler = (event: KeyboardEvent) => {
    if (event.repeat || event.metaKey || event.altKey || this.paused || this.transitioning) return;
    if (event.code === 'F2') {
      FEATURES.debugStealth = !FEATURES.debugStealth;
      this.message(`STEALTH DEBUG: ${FEATURES.debugStealth ? 'ON' : 'OFF'}`);
      return;
    }
    // Left Ctrl is used for crouching; ignore Control key presses themselves here, while allowing Z/X/C/Q even while crouching
    if (event.code === 'ControlLeft' || event.code === 'ControlRight') return;
    const id = ({ KeyZ: 'chip', KeyX: 'hallucination', KeyC: 'investment', KeyQ: 'agi' } as Record<string, AbilityId>)[event.code];
    if (id) this.abilityRequests.add(id);
  };
  private readonly queueInteraction = (event: KeyboardEvent) => { if (!event.repeat) this.interactionRequested = true; };
  private readonly visibilityHandler = () => { if (document.hidden) this.setPaused(true); };
  private readonly blurHandler = () => this.setPaused(true);
  protected get locationId() {
    if (this.insideId === undefined) return 'street';
    return this.inAttic ? `house:${this.insideId}:attic` : `house:${this.insideId}`;
  }
  private get currentLure(): Lure | undefined { return this.run.activeLure?.sceneId === this.locationId ? this.run.activeLure : undefined; }

  protected setup(run: RunSession, width: number, x: number, y: number) {
    this.run = run; this.run.activeSceneId = this.locationId; this.paused = false; this.transitioning = false;
    this.interactionArmed = false; this.interactionRequested = false; this.hudElapsed = 0; this.occluders = [];
    this.isCollecting = false;
    this.abilityRequests.clear(); this.lureVisual = undefined; this.messageUntil = 0; this.lastWanted = run.wanted.level;
    this.run.extraction.reset();
    this.effects = new CombatEffects(this); this.physics.resume(); audio.setMode('play');
    this.physics.world.setBounds(0, 0, width, 720); this.cameras.main.setBounds(0, 0, Math.max(width, GAME.width), 720); this.cameras.main.roundPixels = true;
    this.player = new Player(this, x, y); this.solids = this.physics.add.staticGroup();
    this.addSolid(width / 2, this.ground + 66, width, 132); this.physics.add.collider(this.player, this.solids);
    this.projectiles = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, allowGravity: false, maxSize: 4 });
    this.physics.add.collider(this.projectiles, this.solids, projectile => (projectile as Phaser.Physics.Arcade.Image).disableBody(true, true), (_projectile, block) => !(block as Phaser.GameObjects.Rectangle).getData('chipPass'));
    this.enemySystem = new EnemySystem({ scene: this, run, player: this.player, solids: this.solids, chips: this.projectiles, sceneId: this.locationId, ground: this.ground, width, occluders: this.occluders, effects: this.effects, lure: () => this.currentLure, collecting: () => this.isCollecting, message: text => this.message(text), hitPlayer: source => this.hit(source), enabled: () => !this.paused && !this.transitioning && !this.run.ended });
    this.dropSystem = new DropSystem(this, run, this.locationId, this.player, this.solids, (text, ram) => { this.message(text); if (ram) ui.pulseRam(); ui.updateHUD(run, run.streetPosition.x, this.insideId); });
    this.cameras.main.startFollow(this.player, true, .115, .115).setDeadzone(130, 80); this.cameras.main.fadeIn(160, 24, 49, 51);
    ui.playUI(); ui.updateHUD(run, run.streetPosition.x, this.insideId); ui.button('pause-button', () => this.setPaused(true));
    this.input.keyboard!.on('keydown-ESC', this.togglePause, this); this.input.keyboard!.on('keydown-E', this.queueInteraction); this.input.keyboard!.on('keydown', this.abilityKeyHandler);
    this.chipKey = this.input.keyboard!.addKey('Z');
    for (const id of Object.keys(ABILITIES) as AbilityId[]) ui.button(`ability-${id}`, () => { if (!this.paused && !this.transitioning) this.abilityRequests.add(id); document.getElementById('game-frame')?.focus({ preventScroll: true }); });
    this.input.keyboard!.addCapture(['SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'SHIFT', 'E']);
    document.addEventListener('visibilitychange', this.visibilityHandler); window.addEventListener('blur', this.blurHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', this.visibilityHandler); window.removeEventListener('blur', this.blurHandler);
      this.input.keyboard?.off('keydown-ESC', this.togglePause, this); this.input.keyboard?.off('keydown-E', this.queueInteraction); this.input.keyboard?.off('keydown', this.abilityKeyHandler); audio.setPaused(false);
    });
    document.getElementById('game-frame')?.focus({ preventScroll: true });
  }
  protected addSolid(x: number, y: number, width: number, height: number, oneWay = false) {
    const block = this.add.rectangle(x, y, width, height, 0, 0); this.physics.add.existing(block, true); this.solids.add(block);
    if (oneWay) { const b = block.body as Phaser.Physics.Arcade.StaticBody; b.checkCollision.down = false; b.checkCollision.left = false; b.checkCollision.right = false; }
    return block;
  }
  protected hit(sourceX: number) {
    if (!this.run.damage()) return;
    audio.play('hurt'); this.player.hurt(this.run.elapsedMs, sourceX); this.cameras.main.shake(130, .004); this.cameras.main.flash(80, 229, 143, 113, false);
    ui.updateHUD(this.run, this.run.streetPosition.x, this.insideId); if (this.run.lives <= 0) this.finish('life');
  }
  protected message(text: string, error = false) { this.messageUntil = this.run.elapsedMs + 1900; ui.actionMessage(text, error); }
  private processAbilities() {
    if (this.chipKey.isDown && this.run.cooldowns.remaining('chip', this.run.elapsedMs) === 0) this.abilityRequests.add('chip');
    for (const id of this.abilityRequests) {
      const ability = ABILITIES[id], use = this.run.useAbility(id), now = this.run.elapsedMs;
      if (!use.ok) {
        if (use.reason !== 'ended') {
          const msg = use.reason === 'emp'
            ? `⚡ EMP JAMMED! ${ability.label} が一時使用不能です`
            : use.reason === 'ram'
            ? `${ability.label} / RAMが${ability.cost}GB必要です`
            : `${ability.label} / COOLDOWN`;
          this.message(msg, true);
          audio.play('denied');
        }
        continue;
      }
      this.player.action(now, id === 'chip' || id === 'investment' ? 'attack' : 'cast'); audio.play(id);
      const direction = this.player.flipX ? -1 : 1;
      if (id === 'chip') {
        this.run.emitNoise('attack', this.player.x, this.player.y, this.locationId, 'player');
        const chip = this.projectiles.get(this.player.x + direction * 32, this.player.y - 43, 'ram') as Phaser.Physics.Arcade.Image | null;
        if (chip) { chip.enableBody(true, this.player.x + direction * 32, this.player.y - 43, true, true).setScale(.95).setDepth(5).setTint(0xc5ffac).setVelocity(direction * 850, 0).setData('expiresAt', now + 800); (chip.body as Phaser.Physics.Arcade.Body).setAllowGravity(false); }
      } else if (id === 'investment') {
        const targetX = Phaser.Math.Clamp(this.player.x + direction * 230, 40, this.physics.world.bounds.width - 40);
        this.run.activeLure = { sceneId: this.locationId, fromX: this.player.x, fromY: this.player.y - 45, x: targetX, y: this.ground, landsAt: now + 400, expiresAt: now + 400 + ability.durationMs };
        this.run.emitNoise('special', targetX, this.ground, this.locationId, 'lure');
        this.message('BIG INVESTMENT / 最大4秒の陽動');
      } else {
        this.run.emitNoise('special', this.player.x, this.player.y, this.locationId, 'player');
        const affected = this.enemySystem.applyAbility(id);
        this.effects.burst(this.player.x, this.player.y - 42, ability.radius, id === 'agi' ? 0xb8f7af : 0xd4b4fa, id === 'agi' ? 'AGI / ONLINE' : 'REALITY NOT FOUND', id === 'agi');
        this.message(`${ability.name} / ${affected} TARGETS / −${ability.cost}GB`);
        if (id === 'agi') { this.cameras.main.shake(180, .003); this.cameras.main.flash(150, 164, 230, 188, false); }
      }
    }
    this.abilityRequests.clear();
    for (const child of this.projectiles.getChildren()) {
      const chip = child as Phaser.Physics.Arcade.Image;
      if (chip.active && (this.run.elapsedMs >= chip.getData('expiresAt') || chip.x < 5 || chip.x > this.physics.world.bounds.width - 5)) chip.disableBody(true, true);
      else if (chip.active) chip.setAngle(Math.sin(this.run.elapsedMs / 45) * 12);
    }
    const lure = this.currentLure;
    if (!lure || this.run.elapsedMs >= lure.expiresAt) { this.lureVisual?.destroy(); this.lureVisual = undefined; }
    else {
      if (!this.lureVisual) this.lureVisual = this.add.image(lure.x, lure.y - 5, 'money').setOrigin(.5, 1).setScale(1.8).setDepth(4);
      const p = Phaser.Math.Clamp((this.run.elapsedMs - (lure.landsAt - 400)) / 400, 0, 1);
      this.lureVisual.setPosition(Phaser.Math.Linear(lure.fromX ?? lure.x, lure.x, p), p < 1 ? Phaser.Math.Linear(lure.fromY ?? lure.y, lure.y - 6, p) - Math.sin(p * Math.PI) * 95 : lure.y - 6 - Math.sin(this.run.elapsedMs / 120) * 3).setAngle(p < 1 ? p * 340 : 0);
    }
    if (this.messageUntil && this.run.elapsedMs > this.messageUntil) { ui.actionMessage(''); this.messageUntil = 0; }
  }
  private togglePause() { this.setPaused(!this.paused); }
  protected setPaused(value: boolean) {
    if (this.transitioning || this.run.ended || value === this.paused) return;
    this.paused = value; audio.setPaused(value);
    if (value) {
      this.abilityRequests.clear(); this.interactionRequested = false; this.physics.pause(); this.tweens.pauseAll(); this.player.stopInput();
      ui.pauseUI(() => this.setPaused(false), () => this.scene.start('Street', { run: new RunSession(undefined, this.run.mode, this.run.riskMode) }), () => this.scene.start('Title'));
    } else { this.physics.resume(); this.tweens.resumeAll(); this.input.keyboard?.resetKeys(); ui.closePause(); document.getElementById('game-frame')?.focus({ preventScroll: true }); }
  }
  protected finish(reason: EndReason) {
    if (this.transitioning || this.run.ended) return;
    this.transitioning = true; this.enemySystem.sync(); this.physics.pause(); audio.setPaused(false);
    const result = reason === 'extract' ? this.run.extract() : this.run.finish(reason);
    this.cameras.main.fadeOut(240, 20, 44, 44); this.time.delayedCall(240, () => this.scene.start('Result', { result }));
  }
  protected transition(scene: string, data: object, doorX: number) {
    this.enemySystem.sync(); this.run.leaveArea(this.locationId, doorX); this.transitioning = true; this.physics.pause(); this.player.stopInput(); audio.play('enter');
    this.cameras.main.fadeOut(140, 24, 49, 51); this.time.delayedCall(145, () => this.scene.start(scene, data));
  }
  protected abstract interaction(delta: number, pressed: boolean): boolean;
  protected afterUpdate(_delta: number) {}
  update(_time: number, delta: number) {
    if (this.paused || this.transitioning) return;
    this.run.tick(delta, this.enemySystem.sightings, this.insideId !== undefined, this.enemySystem.pursuing); audio.tick();
    if (this.run.remainingMs <= 0) { this.finish('time'); return; }
    if (!this.player.keys.interact.isDown) this.interactionArmed = true;
    const keyPressed = Phaser.Input.Keyboard.JustDown(this.player.keys.interact), pressed = (keyPressed || this.interactionRequested) && this.interactionArmed; this.interactionRequested = false;
    this.processAbilities(); const collecting = this.interaction(delta, pressed); if (this.transitioning) return;
    this.isCollecting = collecting;
    this.player.updateMovement(
      this.run.elapsedMs,
      collecting,
      this.run.stealth,
      action => this.run.emitNoise(action, this.player.x, this.player.y, this.locationId, 'player')
    );
    this.player.setAlpha(this.run.elapsedMs < this.run.invincibleUntil ? Math.floor(this.run.elapsedMs / 85) % 2 ? .43 : 1 : 1);
    this.enemySystem.update(); this.dropSystem.update(); this.afterUpdate(delta);
    if (this.run.wanted.level > this.lastWanted) { audio.play('alert'); this.message(`WANTED LEVEL ${this.run.wanted.level}`); } this.lastWanted = this.run.wanted.level;
    this.hudElapsed += delta; if (this.hudElapsed > 60) { this.hudElapsed = 0; ui.updateHUD(this.run, this.insideId === undefined ? this.player.x : this.run.streetPosition.x, this.insideId); }
  }
}

export class StreetScene extends BasePlayScene {
  private parallax!: Parallax;
  private houseDoors: number[] = [];
  constructor() { super('Street'); }
  create(data: { run?: RunSession } = {}) {
    this.insideId = undefined; this.inAttic = false; this.ground = GAME.streetGround; const run = data.run ?? new RunSession(); this.parallax = street(this, run.houses);
    this.houseDoors = run.houses.map(h => h.x);
    this.setup(run, GAME.streetWidth, run.streetPosition.x, run.streetPosition.y);
    ui.sceneLabel(`${run.mode.toUpperCase()}${run.riskMode ? ' · RISK MODE' : ''} / ${STAGES[0].name}`);
    for (const h of run.houses) {
      const ev = run.houseEvents.forHouse(h.id);
      const totalPcs = h.pcs.length + (ev?.attic ? 1 : 0);
      const emptied = h.pcs.filter(pc => run.collected.has(pc.id)).length + (ev?.attic && run.collected.has(ev.attic.pc.id) ? 1 : 0);
      this.add.text(h.x, 341, emptied === totalPcs ? '✓ MEMORY ACQUIRED' : `${emptied}/${totalPcs} PCs`, { fontFamily: 'monospace', fontSize: '14px', color: '#375d59', backgroundColor: emptied === totalPcs ? '#b9dc9e' : '#e5e1c0', padding: { x: 10, y: 5 } }).setOrigin(.5).setDepth(-1);
      if (h.id % 2 === 0) { this.add.image(h.x + 309, this.ground, 'fence').setOrigin(.5, 1).setScale(2).setDepth(1); this.addSolid(h.x + 309, this.ground - 23, 100, 46); }
    }
    for (const x of [3750, 7300]) this.enemySystem.add({ id: `street:police:${x}`, kind: 'guard', sceneId: 'street', x, y: this.ground, min: x - 220, max: x + 220, activity: 'patrol', facing: -1 });
    for (const x of [4300, 8150]) this.enemySystem.add({ id: `street:robot:${x}`, kind: 'robot', sceneId: 'street', x, y: this.ground, min: x - 150, max: x + 150, activity: 'patrol' });
  }
  protected interaction(delta: number, pressed: boolean) {
    // 1. House door interaction has priority
    const nearest = this.run.houses.find(h => Math.abs(h.x - this.player.x) < 85 && Math.abs(this.player.y - this.ground) < 55);
    if (nearest) {
      this.run.extraction.reset();
      const ev = this.run.houseEvents.forHouse(nearest.id);
      const totalPcs = nearest.pcs.length + (ev?.attic ? 1 : 0);
      const count = nearest.pcs.filter(pc => this.run.collected.has(pc.id)).length + (ev?.attic && this.run.collected.has(ev.attic.pc.id) ? 1 : 0);
      const evInfo = ev ? HOUSE_EVENT_INFO[ev.type] : undefined;
      const evTag = evInfo ? ` · <strong>${evInfo.badge}</strong>` : '';
      const tierText = nearest.tierLabel ?? nearest.difficulty;
      ui.prompt(`<kbd>E</kbd> HOUSE ${String(nearest.id + 1).padStart(2, '0')} / ${HOUSE_TYPES[nearest.type]}${evTag}<small>${tierText} · ${count === totalPcs ? '回収済み' : `${totalPcs - count} PCs AVAILABLE`}</small>`);
      if (pressed) {
        this.run.streetPosition = { x: this.player.x, y: this.player.y };
        this.run.visit(nearest.id);
        this.transition('Interior', { run: this.run, houseId: nearest.id }, nearest.x);
      }
      return false;
    }

    // 2. Mid-run Extraction Point interaction (Phase 19)
    const extractPoint = this.run.extraction.findPoint(this.player.x, this.player.y, this.ground, this.houseDoors);
    if (extractPoint) {
      if (this.run.extraction.dismissedPointId === extractPoint.id && !pressed && !this.player.keys.interact.isDown) {
        ui.prompt(`<kbd>E</kbd> ${extractPoint.label}<small>Eキー長押しで途中撤退（EXTRACT RAM?）を再表示</small>`);
        return false;
      }
      if (pressed) this.run.extraction.dismissedPointId = '';
      const held = this.player.keys.interact.isDown && this.interactionArmed;
      const { progress, triggered } = this.run.extraction.updateHold(extractPoint, held, delta);
      ui.extractionPrompt(
        extractPoint.label,
        this.run.availableRamGB,
        progress,
        () => {
          audio.play('extract');
          this.finish('extract');
        },
        () => {
          this.run.extraction.dismissedPointId = extractPoint.id;
          this.run.extraction.holdProgressMs = 0;
          this.message('CONTINUE / 探索を続行します');
          document.getElementById('game-frame')?.focus({ preventScroll: true });
        }
      );
      if (triggered) {
        audio.play('extract');
        this.finish('extract');
      }
      return held;
    }
    this.run.extraction.reset();

    // 3. Street End Goal (normal goal + non-conflicting boss resolution support)
    if (this.player.x > 9640) {
      ui.prompt('<kbd>E</kbd> ゴールして AI EMPIRE を建設<small>未消費のRAMが、あなたのデータセンターになります。</small>');
      if (pressed) this.finish('goal');
      return false;
    }

    ui.prompt('');
    return false;
  }
  protected afterUpdate() {
    this.parallax.clouds.tilePositionX = this.cameras.main.scrollX * .065 + this.run.elapsedMs * .0015;
    this.parallax.skyline.tilePositionX = this.cameras.main.scrollX * .2;
  }
}

export class InteriorScene extends BasePlayScene {
  private house!: HouseData;
  private houseEvent?: HouseEventRecord;
  private pcs: PCView[] = [];
  private collectTarget = '';
  private collectProgress = 0;
  private collectNoiseTickMs = 0;
  private cameraGauges = new Map<string, number>();
  private security!: Phaser.GameObjects.Graphics;
  private terminalSprite?: Phaser.GameObjects.Image;
  private terminalLabel?: Phaser.GameObjects.Text;
  private returnX?: number;

  constructor() { super('Interior'); }

  create(data: { run: RunSession; houseId: number; attic?: boolean; returnX?: number }) {
    this.house = data.run.houses.find(h => h.id === data.houseId)!;
    this.insideId = this.house.id;
    this.inAttic = !!data.attic;
    this.returnX = data.returnX;
    this.ground = GAME.interiorGround;
    this.pcs = [];
    this.collectTarget = '';
    this.collectProgress = 0;
    this.collectNoiseTickMs = 0;
    this.cameraGauges.clear();
    this.terminalSprite = undefined;
    this.terminalLabel = undefined;
    this.houseEvent = data.run.houseEvents.forHouse(this.house.id);

    if (this.inAttic && this.houseEvent?.attic) {
      const attic = this.houseEvent.attic;
      atticInterior(this, this.house, attic);
      this.setup(data.run, attic.width, attic.exitLadderX + 60, this.ground);
      ui.sceneLabel(`HOUSE ${String(this.house.id + 1).padStart(2, '0')} / SECRET ATTIC / ${HOUSE_TYPES[this.house.type]}`);
      for (const f of attic.obstacles) {
        if (f.solid) this.addSolid(f.x, f.floorY - f.height / 2, f.width, f.height).setData('chipPass', f.kind === 'desk');
        const occ = furnitureOccluderRect(f);
        if (occ) this.occluders.push(occ);
      }
      for (const p of attic.platforms) this.addSolid(p.x, p.y + p.height / 2, p.width, p.height, true);
      this.spawnPcView(attic.pc);
    } else {
      interior(this, this.house, this.houseEvent?.attic?.hatchX, this.houseEvent?.atticDiscovered);
      const spawnX = data.returnX ?? this.house.spawnX;
      this.setup(data.run, this.house.width, spawnX, this.ground);
      const evBadge = this.houseEvent ? ` · ${HOUSE_EVENT_INFO[this.houseEvent.type].name}` : '';
      const tierLabel = this.house.tierLabel ?? this.house.difficulty;
      ui.sceneLabel(`HOUSE ${String(this.house.id + 1).padStart(2, '0')} / ${tierLabel} / ${HOUSE_TYPES[this.house.type]}${evBadge}`);

      for (const f of this.house.furniture) {
        if (f.solid) this.addSolid(f.x, f.floorY - f.height / 2, f.width, f.height).setData('chipPass', f.kind === 'desk');
        const occ = furnitureOccluderRect(f);
        if (occ) this.occluders.push(occ);
      }
      for (const p of this.house.platforms) this.addSolid(p.x, p.y + p.height / 2, p.width, p.height, true);
      for (const pc of this.house.pcs) this.spawnPcView(pc);

      // Event B: Security Terminal for ALARM_PC
      if (this.houseEvent?.type === 'ALARM_PC' && this.houseEvent.terminalX !== undefined) {
        const tx = this.houseEvent.terminalX;
        const disabled = this.houseEvent.terminalDisabled;
        this.terminalSprite = this.add.image(tx, this.ground, `security-terminal-${disabled ? 'off' : 'on'}`).setOrigin(0.5, 1).setScale(1.75).setDepth(1);
        this.terminalLabel = this.add.text(
          tx,
          this.ground - 102,
          disabled ? '✓ ALARM DISABLED' : '⚠ SECURITY TERMINAL\n[E] DISABLE ALARM',
          {
            fontFamily: 'monospace',
            fontSize: '12px',
            align: 'center',
            color: disabled ? '#7fa38c' : '#ffe1c2',
            backgroundColor: disabled ? '#243c38' : '#6b362e',
            padding: { x: 6, y: 4 }
          }
        ).setOrigin(0.5, 1).setDepth(2);
      }

      for (const r of [...this.house.residents, ...this.house.security]) {
        this.enemySystem.add({
          id: r.id,
          kind: r.kind,
          sceneId: this.locationId,
          x: r.x,
          y: r.y,
          min: Math.max(100, r.x - 170),
          max: Math.min(this.house.width - 100, r.x + 170),
          activity: r.activity,
          facing: r.facing,
          facility: this.house.allowIndoorSecurity
        });
      }
    }
    this.security = this.add.graphics().setDepth(1);
  }

  private spawnPcView(pc: PCData) {
    const emptied = this.run.collected.has(pc.id);
    const totalGb = effectivePcRam(pc);
    const type = pcType(pc.gb);
    let glow: Phaser.GameObjects.Graphics | undefined;
    if (!emptied && (pc.eventTag === 'RAM_JACKPOT' || pc.eventTag === 'ATTIC_ROUTE' || pc.eventTag === 'ALARM_PC')) {
      glow = this.add.graphics({ x: pc.x, y: pc.floorY - 82 }).setDepth(-1);
      const glowColor = pc.eventTag === 'ALARM_PC' ? 0xf29f7e : 0xf7df7c;
      glow.fillStyle(glowColor, 0.24).fillCircle(0, 0, 54);
      glow.lineStyle(2, glowColor, 0.7).strokeCircle(0, 0, 56);
      this.tweens.add({ targets: glow, scale: 1.14, alpha: 0.55, duration: 680, yoyo: true, repeat: -1 });
    }
    const image = this.add.image(pc.x, pc.floorY - 60, `pc-${pc.gb}-${emptied ? 'off' : 'on'}`).setOrigin(.5, 1).setScale(1.65).setDepth(0);
    if (!emptied && (pc.eventTag === 'RAM_JACKPOT' || pc.eventTag === 'ATTIC_ROUTE')) image.setTint(0xfff0a8);
    else if (!emptied && pc.eventTag === 'ALARM_PC' && !this.houseEvent?.terminalDisabled) image.setTint(0xffcdb8);

    const tagPrefix =
      pc.eventTag === 'RAM_JACKPOT' ? '★ JACKPOT ' :
      pc.eventTag === 'ATTIC_ROUTE' ? '🪜 ATTIC ' :
      pc.eventTag === 'ALARM_PC' ? (this.houseEvent?.terminalDisabled ? '✓ SAFE ' : '⚠ ALARM ') : '';
    const label = this.add.text(
      pc.x,
      pc.floorY - 150,
      emptied ? 'NO MEMORY' : `${tagPrefix}${type.short}\n${totalGb} GB`,
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        align: 'center',
        lineSpacing: 4,
        color: emptied ? '#7e8b78' : pc.eventTag === 'ALARM_PC' && !this.houseEvent?.terminalDisabled ? '#752d22' : '#355c51',
        backgroundColor: emptied ? '#d3d0b5' : pc.eventTag === 'RAM_JACKPOT' ? '#f7e594' : pc.eventTag === 'ALARM_PC' && !this.houseEvent?.terminalDisabled ? '#f7c8b6' : '#e8e4c5',
        padding: { x: 8, y: 5 }
      }
    ).setOrigin(.5, 1).setDepth(0);
    this.pcs.push({ data: pc, image, label, glow });
  }

  protected interaction(delta: number, pressed: boolean) {
    // Attic exit ladder
    if (this.inAttic && this.houseEvent?.attic) {
      const lx = this.houseEvent.attic.exitLadderX;
      if (Math.abs(this.player.x - lx) < 78 && Math.abs(this.player.y - this.ground) < 65) {
        this.resetCollection();
        ui.prompt('<kbd>E</kbd> 階下の部屋へ戻る<small>屋根裏から通常の室内へ降ります。</small>');
        if (pressed) {
          this.transition('Interior', { run: this.run, houseId: this.house.id, attic: false, returnX: this.returnX ?? this.houseEvent.attic.hatchX }, lx);
        }
        return false;
      }
    }

    // Main room exit door
    if (!this.inAttic && Math.abs(this.player.x - this.house.doorX) < 86 && Math.abs(this.player.y - this.ground) < 65) {
      this.resetCollection();
      ui.prompt('<kbd>E</kbd> 住宅街へ戻る<small>住民は自宅の外には追ってきません。</small>');
      if (pressed) {
        this.run.exitHouse();
        this.transition('Street', { run: this.run }, this.house.doorX);
      }
      return false;
    }

    // Event B: Security Terminal interaction
    if (!this.inAttic && this.houseEvent?.type === 'ALARM_PC' && this.houseEvent.terminalX !== undefined) {
      if (Math.abs(this.player.x - this.houseEvent.terminalX) < 76 && Math.abs(this.player.y - this.ground) < 65) {
        this.resetCollection();
        if (this.houseEvent.terminalDisabled) {
          ui.prompt('✓ SECURITY TERMINAL DISABLED<small>警報装置は無効化されています。安全にPCを回収できます。</small>');
        } else {
          ui.prompt('<kbd>E</kbd> セキュリティ端末を操作して警報を解除<small>解除すると ALARM PC 回収時のセキュリティ警報を防げます。</small>');
          if (pressed && this.run.disableSecurityTerminal(this.house.id)) {
            audio.play('terminal');
            this.terminalSprite?.setTexture('security-terminal-off');
            this.terminalLabel?.setText('✓ ALARM DISABLED').setColor('#7fa38c').setBackgroundColor('#243c38');
            for (const p of this.pcs) {
              if (p.data.eventTag === 'ALARM_PC' && !this.run.collected.has(p.data.id)) {
                p.image.clearTint();
                p.label.setText(`✓ SAFE ${pcType(p.data.gb).short}\n${effectivePcRam(p.data)} GB`).setColor('#355c51').setBackgroundColor('#e8e4c5');
              }
            }
            this.message('SECURITY ALARM DISABLED / 警報を無効化しました');
          }
        }
        return false;
      }
    }

    // Event C: Secret Attic Hatch interaction
    if (!this.inAttic && this.houseEvent?.type === 'ATTIC_ROUTE' && this.houseEvent.attic) {
      const hx = this.houseEvent.attic.hatchX;
      const nearPc = this.pcs.find(p => !this.run.collected.has(p.data.id) && Math.abs(p.data.x - this.player.x) < 90 && Math.abs(this.player.y - p.data.floorY) < 95);
      if (!nearPc && Math.abs(this.player.x - hx) < 82 && Math.abs(this.player.y - this.ground) < 85) {
        this.resetCollection();
        ui.prompt('<kbd>E</kbd> 屋根裏への秘密通路を登る <strong>🪜 ATTIC ROUTE</strong><small>頭上のハッチから屋根裏の隠し空間へ移動します。</small>');
        if (pressed) {
          const first = this.run.discoverAtticRoute(this.house.id);
          if (first) this.message('SECRET ATTIC DISCOVERED! / 屋根裏通路を発見');
          this.transition('Interior', { run: this.run, houseId: this.house.id, attic: true, returnX: hx }, hx);
        }
        return false;
      }
    }

    // PC RAM Collection (works both standing and crouching!)
    const pc = this.pcs.find(p => Math.abs(p.data.x - this.player.x) < 118 && Math.abs(this.player.y - p.data.floorY) < 95);
    if (!pc) { this.resetCollection(); ui.prompt(''); return false; }
    if (this.run.collected.has(pc.data.id)) { this.resetCollection(); ui.prompt('✓ RAM ACQUIRED<small>このPCは考えるのをやめた。</small>'); return false; }
    if (this.collectTarget !== pc.data.id) { this.resetCollection(); this.collectTarget = pc.data.id; }
    const held = this.player.keys.interact.isDown && this.interactionArmed;
    const totalGb = effectivePcRam(pc.data);
    const duration = GAME.collectMs + (totalGb >= 64 ? 240 : 0);
    this.collectProgress = held ? Math.min(duration, this.collectProgress + delta) : 0;

    // Phase 1.5: Ongoing collection emits periodic extraction noise and raises visual detection risk
    if (held) {
      this.collectNoiseTickMs += delta;
      if (this.collectNoiseTickMs >= 420) {
        this.collectNoiseTickMs = 0;
        this.run.emitNoise('collect', pc.data.x, pc.data.floorY, this.locationId, `pc:${pc.data.id}`);
      }
    } else {
      this.collectNoiseTickMs = 0;
    }

    const alarmWarning = pc.data.eventTag === 'ALARM_PC' && !this.houseEvent?.terminalDisabled;
    const warningText = alarmWarning
      ? '⚠ 警告：セキュリティ警報付きPC（端末未解除で回収すると警報作動！）'
      : pc.data.eventTag === 'RAM_JACKPOT'
      ? `★ JACKPOT PC (${this.houseEvent?.multiplier ?? 1.5}x 容量増設!) · ${held ? 'EXTRACTING MEMORY…' : 'HOLD TO EXTRACT'}`
      : `${pcType(pc.data.gb).name} · ${held ? 'EXTRACTING MEMORY (視認リスク上昇中)…' : 'HOLD TO EXTRACT'}`;

    ui.prompt(`<kbd>E</kbd> 長押しでRAMを回収 <strong>${totalGb} GB</strong><small>${warningText}</small><div class="collect-track"><i id="collect-fill"></i></div>`, this.collectProgress / duration);
    if (this.collectProgress >= duration) {
      const gb = this.run.collect(pc.data.id);
      if (gb) {
        pc.image.clearTint().setTexture(`pc-${pc.data.gb}-blue`);
        pc.label.setText('NO MEMORY').setColor('#7d8675').setBackgroundColor('#d3d0b5');
        pc.glow?.destroy();
        this.time.delayedCall(480, () => { if (pc.image.active) { pc.image.setTexture(`pc-${pc.data.gb}-off`); audio.play('shutdown'); } });
        const isJackpot = pc.data.eventTag === 'RAM_JACKPOT' || pc.data.eventTag === 'ATTIC_ROUTE';
        this.collectionEffect(pc, gb, isJackpot);
        this.player.action(this.run.elapsedMs, 'victory', 480);
        ui.pulseRam();
        ui.updateHUD(this.run, this.run.streetPosition.x, this.insideId);
        this.enemySystem.reactToCollection(pc.data.x, pc.data.floorY, gb);
        if (alarmWarning) {
          audio.play('alert');
          this.cameras.main.flash(220, 240, 140, 110, false);
          this.message('⚠ SECURITY ALARM TRIGGERED! / 警報作動・手配度上昇！', true);
        } else if (isJackpot) {
          this.message(`★ JACKPOT! +${gb} GB RAM ACQUIRED!`);
        }
        if (this.house.alarmX !== undefined) this.run.alarm(this.house.id);
      }
      this.resetCollection();
    }
    return held;
  }
  private resetCollection() { this.collectTarget = ''; this.collectProgress = 0; this.collectNoiseTickMs = 0; }
  private collectionEffect(pc: PCView, gb: number, jackpot = false) {
    audio.play(jackpot ? 'jackpot' : 'collect', gb);
    this.cameras.main.shake(jackpot ? 150 : 80, jackpot ? .0035 : gb >= 64 ? .002 : .001);
    if (jackpot) this.cameras.main.flash(140, 250, 232, 150, false);
    const y = pc.data.floorY - 112, ram = this.add.image(pc.data.x, y, 'ram').setScale(jackpot ? 2.2 : 1.8).setDepth(8);
    if (jackpot) ram.setTint(0xffe98a);
    this.tweens.add({ targets: ram, y: y - 42, duration: 170, ease: 'Cubic.easeOut', onComplete: () => this.tweens.add({ targets: ram, x: this.player.x, y: this.player.y - 45, scale: .4, alpha: 0, duration: 430, ease: 'Back.easeIn', onComplete: () => ram.destroy() }) });
    const count = (jackpot ? 26 : 14) + Math.min(38, Math.floor(gb / 3));
    for (let i = 0; i < count; i++) {
      const p = this.add.image(pc.data.x, y, i % 3 ? 'spark' : 'ram').setScale(i % 3 ? (jackpot ? 1.6 : 1.2) : .42).setDepth(7);
      if (jackpot && i % 2 === 0) p.setTint(0xffdf78);
      const a = i / count * Math.PI * 2, radius = (jackpot ? 65 : 45) + gb * .32;
      this.tweens.add({ targets: p, x: pc.data.x + Math.cos(a) * radius, y: y + Math.sin(a) * radius - 38, alpha: 0, angle: 100, duration: 500 + i * 11, ease: 'Quad.easeOut', onComplete: () => p.destroy() });
    }
    const text = jackpot ? `★ JACKPOT +${gb} GB! ★` : `+${gb} GB RAM!`;
    const popup = this.add.text(pc.data.x, y - 40, text, { fontFamily: 'monospace', fontStyle: 'bold', fontSize: jackpot || gb >= 64 ? '32px' : '26px', color: jackpot ? '#ffe98a' : '#d4ffac', stroke: '#294b41', strokeThickness: 6 }).setOrigin(.5).setDepth(9);
    this.tweens.add({ targets: popup, y: popup.y - 80, alpha: 0, duration: 1300, ease: 'Quad.easeOut', onComplete: () => popup.destroy() });
  }
  protected afterUpdate(delta = 16.6) {
    this.security.clear();
    if (this.inAttic) return;

    // 1. Periodic security laser beam
    const x = this.house.alarmX;
    if (x !== undefined) {
      const active = this.run.elapsedMs % 3200 < 1000;
      this.security.fillStyle(0x486c67).fillRect(x - 14, this.ground - 118, 28, 14).fillStyle(active ? 0xefb57c : 0xa6e19d).fillRect(x - 4, this.ground - 113, 8, 5);
      if (active) {
        this.security.fillStyle(0xeaaf7e, .42).fillRect(x - 4, this.ground - 104, 8, 104);
        this.security.fillStyle(0xffddb1, .8).fillRect(x - 1, this.ground - 104, 2, 104);
        if (Math.abs(this.player.x - x) < 21 && this.player.y > this.ground - 88) {
          this.run.alarm(this.house.id);
          this.hit(x);
        }
      }
    }

    // 2. Surveillance Cameras (Houses 8-14, Vision Profile: 90 deg, 370px, speedMul 1.85)
    const cameras = this.house.cameras ?? [];
    const terminalDisabled = !!this.houseEvent?.terminalDisabled;
    const camProfile = VISION_PROFILES.camera;

    for (const cam of cameras) {
      this.security.fillStyle(0x3a4f59).fillRect(cam.x - 14, cam.y - 10, 28, 16);
      this.security.fillStyle(terminalDisabled ? 0x7fa38c : 0xf27d66).fillCircle(cam.x + cam.facing * 8, cam.y - 2, 4);
      if (terminalDisabled) continue;

      const sweepCycle = Math.sin(this.run.elapsedMs / 1350);
      const activeFacing = sweepCycle >= -0.35 ? cam.facing : (-cam.facing as -1 | 1);
      const range = this.run.stealth.effectiveSightDistance(cam.range || camProfile.range);
      const coneTopY = cam.y - 10;
      const coneBottomY = this.ground;
      const farX = cam.x + activeFacing * range;

      const prevGauge = this.cameraGauges.get(cam.id) ?? 0;
      const coneColor = prevGauge >= 40 ? 0xf27d66 : prevGauge > 0 ? 0xf5d76e : 0xa6e19d;
      this.security.fillStyle(coneColor, prevGauge >= 40 ? 0.22 : 0.12);
      this.security.beginPath();
      this.security.moveTo(cam.x, cam.y);
      this.security.lineTo(farX, coneTopY + 35);
      this.security.lineTo(farX, coneBottomY);
      this.security.closePath();
      this.security.fillPath();

      // Check if player is inside camera vision cone and not occluded by furniture
      const dx = (this.player.x - cam.x) * activeFacing;
      const dy = Math.abs((this.player.y - 36) - cam.y);
      const inRange = dx >= -16 && dx <= range && dy <= camProfile.verticalRange;
      const eyeY = this.run.stealth.crouching ? this.player.y - 24 : this.player.y - 44;
      const occluded = inRange && segmentIntersectsAnyRect({ x: cam.x, y: cam.y }, { x: this.player.x, y: eyeY }, this.occluders);
      const seen = inRange && !occluded;

      let nextGauge = prevGauge;
      if (seen) {
        const baseRate = dx <= DETECTION.closeDistance ? DETECTION.closeRate : dx <= DETECTION.midDistance ? DETECTION.midRate : DETECTION.farRate;
        const rate = baseRate * camProfile.speedMul * (this.run.stealth.crouching ? DETECTION.crouchMultiplier : 1) * (this.isCollecting ? DETECTION.collectMultiplier : 1);
        nextGauge = Math.min(100, prevGauge + (rate * delta) / 1000);
      } else {
        nextGauge = Math.max(0, prevGauge - (DETECTION.decayRate * delta) / 1000);
      }

      if (nextGauge >= 100) {
        nextGauge = 60;
        this.run.alarm(this.house.id);
        this.run.notifyNearbyResidents(this.locationId, cam.x, this.player.x);
        audio.play('alert');
        this.message('📹 SECURITY CAMERA SPOTTED YOU! / 監視カメラが警報を作動！', true);
      }
      this.cameraGauges.set(cam.id, nextGauge);

      if (nextGauge > 0) {
        const bw = 38;
        const bx = cam.x - bw / 2;
        const by = cam.y - 22;
        this.security.fillStyle(0x1f3330, 0.88).fillRect(bx - 1, by - 1, bw + 2, 6);
        this.security.fillStyle(nextGauge >= 40 ? 0xf27d66 : 0xf5d76e, 0.95).fillRect(bx, by, (bw * nextGauge) / 100, 4);
      }
    }
  }
}
