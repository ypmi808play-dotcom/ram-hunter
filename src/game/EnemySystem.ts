import Phaser from 'phaser';
import { RunSession } from '../core/session';
import { EnemyMemory, decideEnemy, seesPlayer } from '../core/enemies';
import type { EnemySpawn, EnemyContext, EnemyDecision } from '../core/enemies';
import type { Rect } from '../core/geometry';
import type { Lure, AbilityId } from '../core/abilities';
import { ABILITIES, withinAbilityRadius } from '../core/abilities';
import { activeEnemyIds, reinforcementRequests, WANTED } from '../core/wanted';
import type { Sighting } from '../core/wanted';
import { AI, COMBAT } from '../core/balance';
import { FEATURES, STEALTH, VISION_PROFILES } from '../core/config';
import { audio } from '../audio/AudioEngine';
import { CombatEffects } from './CombatEffects';
import { Player } from './Player';
import { projectileMember } from '../core/collisions';

export interface EnemyActor { memory: EnemyMemory; sprite: Phaser.Physics.Arcade.Sprite; bubble: Phaser.GameObjects.Text; hpBar: Phaser.GameObjects.Graphics; removing: boolean; decision?: EnemyDecision }
interface Options {
  scene: Phaser.Scene; run: RunSession; player: Player; solids: Phaser.Physics.Arcade.StaticGroup;
  chips: Phaser.Physics.Arcade.Group; sceneId: string; ground: number; width: number;
  occluders: Rect[]; effects: CombatEffects; lure: () => Lure | undefined;
  collecting?: () => boolean;
  message: (text: string) => void; hitPlayer: (x: number) => void; enabled: () => boolean;
}
export class EnemySystem {
  readonly actors: EnemyActor[] = [];
  private o: Options;
  private bolts: Phaser.Physics.Arcade.Group;
  private stealthLayer: Phaser.GameObjects.Graphics;
  sightings: Sighting[] = [];
  pursuing = false;
  constructor(options: Options) {
    this.o = options;
    this.stealthLayer = options.scene.add.graphics().setDepth(5);
    this.bolts = options.scene.physics.add.group({ classType: Phaser.Physics.Arcade.Image, allowGravity: false, maxSize: 8 });
    options.scene.physics.add.collider(this.bolts, options.solids, bolt => (bolt as Phaser.Physics.Arcade.Image).disableBody(true, true), (_bolt, block) => !(block as Phaser.GameObjects.Rectangle).getData('chipPass'));
    options.scene.physics.add.overlap(this.bolts, options.player, (first, second) => {
      const image = projectileMember(first, second, object => this.bolts.contains(object as Phaser.GameObjects.GameObject)) as Phaser.Physics.Arcade.Image | undefined;
      if (!image) return;
      if (!image.active || !this.o.enabled()) return;
      image.disableBody(true, true); this.o.hitPlayer(image.x);
    });
  }
  private context(): EnemyContext {
    return {
      now: this.o.run.elapsedMs,
      sceneId: this.o.sceneId,
      playerX: this.o.player.x,
      playerY: this.o.player.y,
      wantedLevel: this.o.run.wanted.level,
      occluders: this.o.occluders,
      lure: this.o.lure(),
      reacquireAt: this.o.sceneId === 'street' ? this.o.run.outdoorAcquireAt : 0,
      playerCrouching: this.o.run.stealth.crouching,
      playerCollecting: this.o.collecting ? this.o.collecting() : false
    };
  }
  add(spawn: EnemySpawn) {
    const o = this.o;
    if (this.actors.some(a => a.memory.spawn.id === spawn.id) || this.actors.filter(a => !a.memory.defeated).length >= WANTED.maxEnemies) return;
    const memory = o.run.enemyFor(spawn);
    if (!memory || memory.defeated) return;
    const kind = spawn.kind, flying = memory.config.flying;
    const texture =
      kind === 'robot' ? 'robot' :
      flying ? (kind === 'combatDrone' ? 'combat-drone' : kind === 'enhancedDrone' ? 'enhanced-drone' : 'drone') :
      `${kind}-0`;
    const sprite = o.scene.physics.add.sprite(memory.x, memory.y, texture).setOrigin(.5, 1).setScale(2).setDepth(2).setCollideWorldBounds(true);
    if (flying) { sprite.setSize(26, 15).setOffset(6, 8); (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false); }
    else if (kind === 'robot') sprite.setSize(24, 12).setOffset(2, 3);
    else sprite.setSize(14, 29).setOffset(9, 11).play(`${kind}-run`);
    if (!flying) o.scene.physics.add.collider(sprite, o.solids);
    const bubble = o.scene.add.text(memory.x, memory.y - 84, '', { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#e9eed3', backgroundColor: '#35584e', padding: { x: 6, y: 4 } }).setOrigin(.5, 1).setDepth(6).setVisible(false);
    const actor: EnemyActor = { memory, sprite, bubble, hpBar: o.scene.add.graphics().setDepth(7), removing: false };
    this.actors.push(actor);
    o.scene.physics.add.overlap(o.player, sprite, () => {
      if (o.enabled() && !memory.defeated && actor.decision?.harmful && o.run.elapsedMs >= memory.hurtUntil && memory.control.mode(o.run.elapsedMs, sprite.x, sprite.y, o.lure()) === 'normal') o.hitPlayer(sprite.x);
    });
    o.scene.physics.add.overlap(o.chips, sprite, (first, second) => {
      const chip = projectileMember(first, second, object => o.chips.contains(object as Phaser.GameObjects.GameObject)) as Phaser.Physics.Arcade.Image | undefined;
      if (!chip) return;
      if (!chip.active || !o.enabled() || memory.defeated) return;
      const direction = Math.sign((chip.body as Phaser.Physics.Arcade.Body).velocity.x) || 1;
      chip.disableBody(true, true);
      const witnessed = this.actors.some(other => other !== actor && !other.memory.defeated && seesPlayer(other.memory, this.context()));
      const hit = o.run.damageEnemy(spawn.id, COMBAT.chipDamage, direction, witnessed);
      if (!hit.hit) return;
      o.run.emitNoise('attack', sprite.x, sprite.y, o.sceneId, `hit:${spawn.id}`);
      o.effects.hit(sprite.x, sprite.y - 35); audio.play('hit');
      const popupText = hit.shielded ? `🛡 −${hit.damage}` : `−${hit.damage}`;
      this.popup(sprite.x, sprite.y - 80, popupText, hit.shielded ? '#9de6dc' : '#fff0bd', 18);
      o.message(hit.killed ? `${memory.config.label} / K.O.!` : `${memory.config.label}${hit.shielded ? ' [SHIELD 50%]' : ''} / ${memory.hp}/${memory.config.hp} HP`);
      if (hit.killed) this.knockout(actor);
    });
    return actor;
  }
  private popup(x: number, y: number, text: string, color: string, size = 20) {
    const label = this.o.scene.add.text(x, y, text, { fontFamily: 'monospace', fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#24463d', strokeThickness: 4 }).setOrigin(.5).setDepth(9);
    this.o.scene.tweens.add({ targets: label, y: y - 45, alpha: 0, duration: 700, onComplete: () => label.destroy() });
  }
  private knockout(actor: EnemyActor) {
    if (actor.removing) return;
    actor.removing = true; const { sprite, memory } = actor; sprite.disableBody(false, false); sprite.anims.pause(); actor.hpBar.clear(); actor.bubble.setVisible(false);
    for (const child of this.bolts.getChildren()) { const bolt = child as Phaser.Physics.Arcade.Image; if (bolt.getData('source') === memory.spawn.id) bolt.disableBody(true, true); }
    audio.play('knockout'); this.popup(sprite.x, sprite.y - 60, 'K.O.!', '#f4d195', 24);
    this.o.effects.hit(sprite.x, sprite.y - 38);
    this.o.scene.tweens.add({ targets: sprite, angle: sprite.flipX ? -90 : 90, y: sprite.y + 6, scaleY: 1.1, duration: 220, ease: 'Back.easeOut', onComplete: () => {
      this.o.scene.tweens.add({ targets: sprite, alpha: 0, delay: 520, duration: 400, onComplete: () => { sprite.destroy(); actor.hpBar.destroy(); actor.bubble.destroy(); } });
    } });
  }
  applyAbility(id: AbilityId) {
    let affected = 0; const o = this.o;
    for (const actor of this.actors) {
      const m = actor.memory;
      if (m.defeated || !withinAbilityRadius(id, o.player.x, o.player.y, actor.sprite.x, actor.sprite.y)) continue;
      if (id === 'agi') m.control.stun(o.run.elapsedMs, ABILITIES[id].durationMs);
      else if (id === 'hallucination') m.control.confuse(o.run.elapsedMs, Math.sign((actor.sprite.body as Phaser.Physics.Arcade.Body).velocity.x) || Math.sign(o.player.x - m.x) || m.facing);
      actor.sprite.setVelocityX(0); affected++;
    }
    return affected;
  }
  reactToCollection(pcX: number, pcY: number, gb: number) {
    this.o.run.emitNoise('collect', pcX, pcY, this.o.sceneId, `collect:${pcX}`, {
      radius: gb >= 64 ? 210 : STEALTH.noiseLevels.collect.radius
    });
  }
  sync() { for (const a of this.actors) if (!a.memory.defeated && a.sprite.active) { a.memory.x = a.sprite.x; a.memory.y = a.sprite.y; } }
  private reinforce() {
    const o = this.o;
    for (const r of reinforcementRequests(o.sceneId, o.run.wanted.level, [...o.run.enemies.keys()], o.sceneId !== 'street', o.run.elapsedMs, o.run.nextReinforcementAt)) {
      const direction = o.player.flipX ? -1 : 1;
      let x = Phaser.Math.Clamp(o.player.x + direction * 550, 100, o.width - 100);
      if (Math.abs(x - o.player.x) < 300) x = Phaser.Math.Clamp(o.player.x - direction * 550, 100, o.width - 100);
      this.add({ id: r.id, kind: r.kind, sceneId: 'street', x, y: r.kind === 'drone' ? o.ground - 150 : o.ground, min: x - 220, max: x + 220, activity: 'patrol', facing: -direction });
      o.run.nextReinforcementAt = o.run.elapsedMs + AI.reinforcementIntervalMs;
    }
  }
  update() {
    const o = this.o, now = o.run.elapsedMs;
    this.reinforce(); this.sync(); this.sightings = []; this.pursuing = false;
    this.stealthLayer.clear();

    for (const ev of o.run.noise.activeEvents(o.sceneId, now, 420)) {
      const p = Phaser.Math.Clamp((now - ev.createdAt) / 420, 0, 1);
      const radius = Math.min(340, ev.radius) * (0.25 + p * 0.75);
      const color = ev.volume >= 45 ? 0xf2a88c : ev.volume <= 10 ? 0x9ce6cf : 0xd2e8a7;
      this.stealthLayer.lineStyle(ev.volume >= 45 ? 2 : 1, color, (1 - p) * (FEATURES.debugStealth ? 0.65 : 0.28));
      this.stealthLayer.strokeCircle(ev.x, ev.y - 16, radius);
    }

    const active = activeEnemyIds(this.actors.filter(a => !a.memory.defeated).map(a => ({ id: a.memory.spawn.id, x: a.sprite.x })), o.player.x);
    for (const actor of this.actors) {
      const m = actor.memory, s = actor.sprite;
      if (m.defeated) { this.knockout(actor); continue; }
      if (!s.active) continue;
      const body = s.body as Phaser.Physics.Arcade.Body, enabled = active.has(m.spawn.id);
      body.enable = enabled; s.setVisible(enabled); actor.bubble.setVisible(false); actor.hpBar.clear();
      if (!enabled) continue;
      if (m.config.role === 'utility' && (body.blocked.left || body.blocked.right)) m.facing = body.blocked.left ? 1 : -1;

      const previousStage = m.detectionStage;
      const previousSpecial = m.specialState;
      const previousState = m.state;
      const decision = decideEnemy(m, this.context());
      actor.decision = decision;

      if (previousStage !== 'confirmed' && decision.detectionStage === 'confirmed') {
        audio.play('spotted');
      } else if (previousStage === 'unaware' && (decision.detectionStage === 'suspicious' || decision.detectionStage === 'alert')) {
        audio.play('suspicious');
      }
      if (previousSpecial !== 'windup' && m.specialState === 'windup') {
        audio.play('windup');
      }

      // Special attack triggers: Alert Call & EMP Pulse
      if (decision.alertCall) {
        o.run.notifyNearbyResidents(o.sceneId, s.x, o.player.x);
        o.effects.burst(s.x, s.y - 45, 160, 0xf2b86b, 'ALERT CALL!', false);
        o.message('⚠ 警戒住民が周囲の住民へ警告を発信！', true);
      }
      if (decision.empPulse) {
        audio.play('emp');
        o.effects.burst(s.x, s.y - 36, AI.empRadius, 0x8cf5e0, '⚡ EMP PULSE', false);
        if (Math.hypot(o.player.x - s.x, o.player.y - s.y) <= AI.empRadius) {
          o.run.applyEmpJam(COMBAT.empJamDurationMs);
          o.message('⚡ EMP HIT! 3秒間特殊能力(X/C/Q)が使用不能！', true);
        }
      }

      if (previousState === 'SEARCH' && decision.state !== 'SEARCH') o.run.nextReinforcementAt = Math.max(o.run.nextReinforcementAt, now + AI.reinforcementRecoveryMs);
      if (decision.seen && decision.detectionStage === 'confirmed') {
        this.sightings.push({ id: m.spawn.id, kind: m.spawn.kind });
      }
      this.pursuing ||= decision.pursuing;
      s.setVelocityX(decision.velocityX); if (decision.direction) s.setFlipX(decision.direction < 0);

      if (m.config.flying) {
        const vertAmp = m.spawn.kind === 'combatDrone' ? 22 : 7;
        const vertFreq = m.spawn.kind === 'combatDrone' ? 155 : 280;
        s.setVelocityY(decision.state === 'STUNNED' ? 0 : Phaser.Math.Clamp((m.spawn.y + Math.sin(now / vertFreq) * vertAmp - s.y) * 3, -95, 95));
        s.setAngle(decision.state === 'STUNNED' ? 12 : Math.sin(now / 50) * 3);
      } else if (m.spawn.kind !== 'robot') {
        if (Math.abs(decision.velocityX) < 2) {
          s.anims.pause();
          const sleepingPose = m.spawn.activity === 'sleep' && !m.alarmed && !m.wokenUp;
          if (decision.state === 'IDLE') {
            const idleTex = m.spawn.kind === 'securityRobot' ? 'securityRobot-idle' : `${m.spawn.kind}-${sleepingPose ? 'sleep' : m.spawn.activity === 'computer' ? 'work' : 'idle'}`;
            s.setTexture(idleTex);
          }
        } else if (s.anims.isPaused) s.play(`${m.spawn.kind}-run`);
        else if (!s.anims.isPlaying) s.play(`${m.spawn.kind}-run`);
        if (decision.state !== 'STUNNED' && decision.state !== 'HURT' && (body.blocked.left || body.blocked.right) && body.blocked.down) s.setVelocityY(-510);
      }

      if (now < m.invincibleUntil) s.setTint(Math.floor(now / 45) % 2 ? 0xffffff : 0xf2bfa1);
      else if (decision.mode === 'stunned') s.setTint(0xf2d298);
      else if (decision.mode === 'confused') s.setTint(0xc7a7ee);
      else if (decision.mode === 'distracted') s.setTint(0xb8e5a4);
      else if (m.specialState === 'windup') s.setTint(Math.floor(now / 70) % 2 ? 0xffd296 : 0xff9478);
      else s.clearTint();

      // Render special attack windup telegraphs & Elite Guard frontal shield
      if (m.specialState === 'windup') {
        const sp = m.config.special;
        if (sp === 'empPulse') {
          this.stealthLayer.lineStyle(2, 0x8cf5e0, 0.75).strokeCircle(s.x, s.y - 30, AI.empRadius);
          this.stealthLayer.fillStyle(0x8cf5e0, 0.12).fillCircle(s.x, s.y - 30, AI.empRadius);
        } else if (sp === 'dashStrike' || sp === 'batonSwing') {
          const reach = sp === 'dashStrike' ? 160 : AI.batonRange;
          const x1 = s.x, x2 = s.x + m.specialDirection * reach, wy = s.y - 28;
          this.stealthLayer.lineStyle(3, 0xff9478, 0.85).lineBetween(x1, wy, x2, wy);
          this.stealthLayer.fillStyle(0xff9478, 0.25).fillRect(Math.min(x1, x2), wy - 14, Math.abs(x2 - x1), 28);
        } else if (sp === 'alertCall') {
          this.stealthLayer.lineStyle(2, 0xf2b86b, 0.65).strokeCircle(s.x, s.y - 48, 85);
        }
      }
      if (decision.shielding) {
        const sx = s.x + m.facing * 20;
        this.stealthLayer.lineStyle(3, 0x8de8d6, 0.9).lineBetween(sx, s.y - 56, sx, s.y - 8);
      }

      const sleepingNow = m.spawn.activity === 'sleep' && !m.alarmed && !m.wokenUp;
      const activity = { computer: 'PC…', sleep: 'zzz', tv: 'TV TIME', patrol: '', chat: '…hello!', rest: 'TAKING A BREAK' }[m.spawn.activity ?? 'patrol'];
      const label =
        decision.mode === 'stunned' ? `* STUN ${((m.control.stunnedUntil - now) / 1000).toFixed(1)}s *` :
        decision.mode === 'confused' ? '?! CONFUSED' :
        decision.mode === 'distracted' ? '$ INVESTMENT! $' :
        decision.specialWarning ? decision.specialWarning :
        decision.state === 'ATTACK' && m.config.flying ? '！ CHARGING' :
        decision.state === 'CHASE' || decision.state === 'ATTACK' ? (m.config.role === 'civilian' ? '！ MY RAM!' : decision.shielding ? '！ [SHIELD]' : '！ STOP!') :
        decision.state === 'SUSPICIOUS' || decision.detectionStage === 'suspicious' || decision.detectionStage === 'alert' ? `？ ${decision.detectionGauge}%` :
        decision.state === 'SEARCH' ? '…' :
        sleepingNow ? 'zzz' : activity;

      const bgColor =
        decision.icon === '!' ? '#7b3532' :
        decision.icon === '?' ? '#6e5c2b' :
        decision.icon === '…' ? '#2d575b' : '#35584e';
      actor.bubble
        .setText(label)
        .setBackgroundColor(bgColor)
        .setPosition(s.x, s.y - (m.config.flying ? 60 : m.spawn.kind === 'robot' ? 38 : 90))
        .setVisible(!!label);

      // Draw detection gauge bar when enemy is building suspicion (1..99)
      if (decision.detectionGauge > 0 && decision.detectionGauge < 100 && !m.defeated) {
        const gw = 38, gy = s.y - (m.config.flying ? 76 : 108), g = actor.hpBar;
        g.fillStyle(0x1f3532).fillRect(s.x - gw / 2 - 1, gy - 1, gw + 2, 6);
        g.fillStyle(decision.detectionGauge >= 40 ? 0xf29f6b : 0xf2dc7e).fillRect(s.x - gw / 2, gy, (gw * decision.detectionGauge) / 100, 4);
      }

      if (FEATURES.debugStealth && m.config.role !== 'utility' && !sleepingNow) {
        const profile = VISION_PROFILES[m.spawn.kind] ?? VISION_PROFILES.resident;
        const range = o.run.stealth.crouching ? profile.range * STEALTH.crouchVisionRatio : profile.range;
        const eyeY = s.y - (m.config.flying ? 24 : 52);
        this.stealthLayer.lineStyle(1, decision.seen ? 0xff9d87 : 0xa5e89c, 0.45);
        this.stealthLayer.strokeRect(m.facing > 0 ? s.x - 35 : s.x - range, eyeY - 35, range + 35, 70);
      }

      if (now < m.hpVisibleUntil) {
        const w = m.config.role === 'civilian' ? 36 : m.config.role === 'heavy' || m.spawn.kind === 'eliteGuard' ? 68 : m.config.flying ? 50 : 54;
        const y = s.y - (m.config.flying ? 45 : 80), g = actor.hpBar;
        g.fillStyle(0x244b46).fillRect(s.x - w / 2 - 2, y - 2, w + 4, 9);
        g.fillStyle(m.config.flying ? 0x9bdcd0 : 0xe9c490).fillRect(s.x - w / 2, y, (w * m.hp) / m.config.hp, 5);
        if (m.config.flying) for (let i = 1; i < 5; i++) g.fillStyle(0x244b46).fillRect(s.x - w / 2 + (i * w) / 5, y, 1, 5);
      }
      if (decision.fire) this.fire(actor);
    }
    for (const child of this.bolts.getChildren()) {
      const bolt = child as Phaser.Physics.Arcade.Image;
      if (bolt.active && now >= bolt.getData('expiresAt')) bolt.disableBody(true, true);
    }
  }
  private fire(actor: EnemyActor) {
    const o = this.o, s = actor.sprite;
    const bolt = this.bolts.get(s.x, s.y - 24, 'security-bolt') as Phaser.Physics.Arcade.Image | null;
    if (!bolt) return;
    const direction = new Phaser.Math.Vector2(o.player.x - s.x, o.player.y - 38 - (s.y - 24)).normalize().scale(285);
    bolt.enableBody(true, s.x, s.y - 24, true, true).setScale(1.5).setDepth(5).setVelocity(direction.x, direction.y).setData('expiresAt', o.run.elapsedMs + 1900).setData('source', actor.memory.spawn.id);
    (bolt.body as Phaser.Physics.Arcade.Body).setAllowGravity(false); audio.play('drone');
  }
}
