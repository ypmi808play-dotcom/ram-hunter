import Phaser from 'phaser';
import { FEATURES, GAME } from '../core/config';
import type { NoiseAction } from '../core/config';
import type { StealthController } from '../core/StealthController';
import { audio } from '../audio/AudioEngine';
import { SAM_ART } from '../art/sam';

export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly keys: Record<string, Phaser.Input.Keyboard.Key>;
  private lastGrounded = -1000;
  private jumpBufferedUntil = -1000;
  private wasGrounded = true;
  private hurtUntil = 0;
  private lastStep = 0;
  private actionUntil = 0;
  private actionAnimation = 'sam-attack';
  private leftCtrlDown = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'sam-idle-0');
    scene.add.existing(this); scene.physics.add.existing(this);
    this.setScale(SAM_ART.scale).setOrigin(0.5, 1).setDepth(3);
    const bw = SAM_ART.bodyWidth / SAM_ART.scale, bh = SAM_ART.bodyHeight / SAM_ART.scale;
    this.setSize(bw, bh).setOffset((SAM_ART.width - bw) / 2, SAM_ART.height - bh).setCollideWorldBounds(true);
    this.setDragX(2800).setMaxVelocity(GAME.dashSpeed, 1000);
    this.keys = scene.input.keyboard!.addKeys({
      a: 'A',
      d: 'D',
      left: 'LEFT',
      right: 'RIGHT',
      jump: 'SPACE',
      dash: 'SHIFT',
      interact: 'E',
      crouch: Phaser.Input.Keyboard.KeyCodes.CTRL
    }) as Record<string, Phaser.Input.Keyboard.Key>;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ControlLeft' || e.key === 'Control') this.leftCtrlDown = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ControlLeft' || e.key === 'Control') this.leftCtrlDown = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    });

    this.play('sam-idle');
  }

  get physicsBody() { return this.body as Phaser.Physics.Arcade.Body; }

  isCrouchKeyDown(): boolean {
    return (this.keys.crouch?.isDown ?? false) || this.leftCtrlDown;
  }

  updateMovement(
    now: number,
    collecting: boolean,
    stealth?: StealthController,
    onNoise?: (action: NoiseAction) => void
  ) {
    const body = this.physicsBody;
    const grounded = body.blocked.down || body.touching.down;
    if (grounded) this.lastGrounded = now;
    const jumpJustPressed = Phaser.Input.Keyboard.JustDown(this.keys.jump);
    if (jumpJustPressed) this.jumpBufferedUntil = now + GAME.jumpBufferMs;

    const crouching = stealth
      ? stealth.update(this.isCrouchKeyDown(), jumpJustPressed, grounded, FEATURES.stealth)
      : false;

    const direction = (this.keys.d.isDown || this.keys.right.isDown ? 1 : 0) - (this.keys.a.isDown || this.keys.left.isDown ? 1 : 0);
    if (now >= this.hurtUntil) {
      const canDash = !crouching && this.keys.dash.isDown;
      const speed = stealth ? stealth.movementSpeed(this.keys.dash.isDown) : (canDash ? GAME.dashSpeed : GAME.walkSpeed);
      this.setMaxVelocity(speed, 1000);
      this.setAccelerationX(collecting ? 0 : direction * GAME.acceleration);
      if (collecting) this.setVelocityX(0);
      if (direction && !collecting) this.setFlipX(direction < 0);
      if (this.jumpBufferedUntil >= now && now - this.lastGrounded <= GAME.coyoteMs) {
        stealth?.forceStand();
        this.setVelocityY(-GAME.jumpSpeed);
        this.lastGrounded = -1000;
        this.jumpBufferedUntil = -1000;
        audio.play('jump');
        this.dust(5);
      }
      if (Phaser.Input.Keyboard.JustUp(this.keys.jump) && body.velocity.y < -230) {
        this.setVelocityY(body.velocity.y * 0.53);
      }

      if (now < this.actionUntil) {
        this.play(this.actionAnimation, true);
      } else if (collecting) {
        this.play('sam-collect', true);
      } else if (!grounded) {
        this.play('sam-jump', true);
      } else if (stealth?.crouching) {
        if (Math.abs(body.velocity.x) > 15) {
          this.play('sam-crouch', true);
        } else {
          this.anims.pause();
          this.setTexture('sam-crouch-0');
        }
      } else if (Math.abs(body.velocity.x) > 20) {
        this.play('sam-run', true);
      } else {
        this.play('sam-idle', true);
      }
    } else {
      this.play('sam-hurt', true);
    }

    if (grounded && !this.wasGrounded) {
      this.dust(6);
      onNoise?.('jumpLand');
    }
    const stepInterval = stealth?.crouching ? 230 : 150;
    const minStepVel = stealth?.crouching ? 65 : 140;
    if (grounded && Math.abs(body.velocity.x) > minStepVel && now - this.lastStep > stepInterval) {
      this.lastStep = now;
      audio.play(stealth?.crouching ? 'crouchStep' : 'step');
      const stepAction = stealth ? stealth.stepNoiseAction(this.keys.dash.isDown) : (this.keys.dash.isDown ? 'dash' : 'walk');
      onNoise?.(stepAction);
      if (this.keys.dash.isDown && !stealth?.crouching) this.dust(1);
    }
    this.wasGrounded = grounded;
  }

  hurt(now: number, sourceX: number) {
    this.hurtUntil = now + 320;
    this.setAccelerationX(0).setVelocity(this.x < sourceX ? -270 : 270, -240);
    this.play('sam-hurt', true);
  }
  stopInput() { this.setAccelerationX(0).setVelocityX(0); this.leftCtrlDown = false; }
  action(now: number, pose: 'attack' | 'cast' | 'victory', ms = 300) {
    this.actionAnimation = `sam-${pose}`;
    this.actionUntil = now + ms;
    this.play(this.actionAnimation, true);
  }
  private dust(count: number) {
    for (let i = 0; i < count; i++) {
      const p = this.scene.add.image(this.x + Phaser.Math.Between(-12, 12), this.y - 3, 'dust').setScale(1.4).setDepth(4);
      this.scene.tweens.add({ targets: p, x: p.x + Phaser.Math.Between(-22, 22), y: p.y - Phaser.Math.Between(4, 15), alpha: 0, scale: 0.6, duration: 220 + i * 20, onComplete: () => p.destroy() });
    }
  }
}
