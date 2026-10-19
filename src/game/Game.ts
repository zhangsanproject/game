import * as THREE from 'three';
import { GAME_CONFIG } from './config';
import { GameLoop } from './GameLoop';
import { clamp, distanceTo, headingToPoint, randomRange, TAU } from './math';
import { PlayerShip } from './entities/PlayerShip';
import { EnemyShip } from './entities/EnemyShip';
import type { Ship } from './entities/Ship';
import { MovementSystem } from './systems/MovementSystem';
import {
  CombatSystem,
  type CombatEvent,
} from './systems/CombatSystem';
import { EnemyAISystem } from './systems/EnemyAISystem';
import { RewardSystem } from './systems/RewardSystem';
import { buildPlayerStats, purchaseUpgrade } from './systems/UpgradeSystem';
import { Sea } from './world/Sea';
import { Environment } from './world/Environment';
import { Harbor } from './world/Harbor';
import { Archipelago } from './world/Archipelago';
import { IslandDecorAssets } from './world/IslandDecor';
import { CameraController } from './world/CameraController';
import { ShipAssets } from './view/ShipAssets';
import { ShipView } from './view/ShipView';
import { EffectsSystem } from './view/Effects';
import { ProjectileViewPool } from './view/ProjectileViewPool';
import { InputManager } from '../input/InputManager';
import type { Platform, ViewportSize } from '../platform/Platform';
import { SaveManager } from '../save/SaveManager';
import type { SaveData } from '../save/SaveData';
import { HUD, type EnemyHudItem, type ResultKind } from '../ui/HUD';
import { HarborUI } from '../ui/HarborUI';
import { showFatalError } from '../ui/showFatalError';
import type { GridObstacle, UpgradeType } from './types';

type GameMode = 'menu' | 'playing' | 'paused' | 'docked' | 'victory' | 'defeat';

interface PendingResult {
  kind: ResultKind;
  detail: string;
}

function uiElement<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`缺少 UI 元素 #${id}`);
  return node as T;
}

/**
 * Orchestrates the pure simulation, Three.js presentation, input, UI and save
 * modules. Browser APIs are only reached through the injected Platform.
 */
export class Game {
  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly cameraController: CameraController;
  private readonly loop: GameLoop;
  private readonly saveManager: SaveManager;
  private readonly movement = new MovementSystem();
  private readonly combat = new CombatSystem();
  private readonly ai = new EnemyAISystem();
  private readonly rewards = new RewardSystem();
  private readonly events: CombatEvent[] = [];

  private readonly sea: Sea;
  private readonly environment: Environment;
  private readonly harbor: Harbor;
  private readonly archipelago: Archipelago;
  private readonly decorAssets: IslandDecorAssets;
  private readonly shipAssets = new ShipAssets();
  private readonly effects: EffectsSystem;
  private readonly projectileViews: ProjectileViewPool;
  private readonly input: InputManager;
  private readonly hud: HUD;
  private readonly harborUI: HarborUI;
  private readonly islandObstacles: GridObstacle[];

  private readonly enemies: EnemyShip[] = [];
  private readonly enemyViews = new Map<string, ShipView>();
  private readonly combatShips: Ship[] = [];
  private readonly wakeTimers = new Map<string, number>();
  private readonly disposers: Array<() => void> = [];

  private progress: SaveData;
  private player!: PlayerShip;
  private playerView!: ShipView;

  private mode: GameMode = 'menu';
  private started = false;
  private disposed = false;
  private visualTime = 0;
  private kills = 0;
  private killTarget: number = GAME_CONFIG.match.killTarget;
  private spawnTimer = 0;
  private enemySerial = 0;
  private pendingResult: PendingResult | null = null;
  private resultDelay = 0;
  private saveWarningShown = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly platform: Platform,
  ) {
    this.renderer = platform.createRenderer(canvas);
    this.cameraController = new CameraController(1);
    this.saveManager = new SaveManager(platform.storage);
    this.progress = this.saveManager.load();
    if (this.saveManager.getLastError()) {
      console.warn(
        '[Age of Wind Web] 存档读取失败，已使用默认存档：',
        this.saveManager.getLastError(),
      );
    }

    this.environment = new Environment(this.scene);
    this.sea = new Sea(this.scene);
    this.decorAssets = new IslandDecorAssets();
    this.harbor = new Harbor(this.scene, this.decorAssets);
    this.archipelago = new Archipelago(this.scene, this.decorAssets);
    this.effects = new EffectsSystem(this.scene);
    this.projectileViews = new ProjectileViewPool(this.scene, this.effects);
    this.islandObstacles = [
      {
        x: GAME_CONFIG.harbor.center.x,
        z: GAME_CONFIG.harbor.center.z,
        radius: GAME_CONFIG.harbor.avoidRadius,
      },
      ...this.archipelago.obstacles,
    ];

    this.hud = new HUD({
      onStart: () => this.startSession(),
      onPauseToggle: () => this.togglePause(),
      onResume: () => this.resumeGame(),
      onRestart: () => this.startSession(),
      onResetSave: () => this.resetProgress(),
      onDock: () => this.enterHarbor(),
      onResultPrimary: () => this.startSession(),
      onResultSecondary: () => this.continueAfterVictory(),
    });

    this.harborUI = new HarborUI({
      onBuy: (type) => this.buyUpgrade(type),
      onLeave: () => this.leaveHarbor(),
      onResetSave: () => this.resetProgress(),
    });

    this.input = new InputManager(
      {
        onPause: () => this.togglePause(),
        onDock: () => this.tryDock(),
      },
      {
        joystick: uiElement<HTMLDivElement>('joystick'),
        knob: uiElement<HTMLDivElement>('joystick-knob'),
        fireButton: uiElement<HTMLButtonElement>('fire-button'),
      },
    );

    this.loop = new GameLoop(
      platform,
      (dt) => this.update(dt),
      () => this.render(),
    );

    this.disposers.push(
      platform.onResize((viewport) => this.resize(viewport)),
    );
    this.disposers.push(
      platform.onVisibilityChange((hidden) => {
        if (hidden && this.mode === 'playing') this.pauseGame();
      }),
    );
    canvas.addEventListener('webglcontextlost', this.handleContextLost);

    this.createMenuPlayer();
    this.resize(platform.getViewport());
  }

  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    this.input.setActive(false);
    this.hud.setTouchMode(this.platform.isTouch);
    this.hud.showStart(this.progress);
    this.loop.start();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.loop.stop();
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    for (const dispose of this.disposers.splice(0)) dispose();

    this.input.dispose();
    this.hud.dispose();
    this.harborUI.dispose();

    for (const view of this.enemyViews.values()) view.remove();
    this.enemyViews.clear();
    this.playerView?.remove();

    this.projectileViews.dispose();
    this.effects.dispose();
    this.sea.dispose(this.scene);
    this.environment.dispose();
    this.archipelago.dispose();
    this.harbor.dispose();
    this.decorAssets.dispose();
    this.shipAssets.dispose();
    this.renderer.dispose();
    this.platform.dispose();
    this.scene.clear();
  }

  // ------------------------------------------------------------------ setup

  private createMenuPlayer(): void {
    this.player = new PlayerShip(
      { x: GAME_CONFIG.playerSpawn.x, z: GAME_CONFIG.playerSpawn.z },
      GAME_CONFIG.playerSpawn.heading,
      buildPlayerStats(this.progress.upgrades),
    );
    this.playerView = new ShipView(this.scene, this.shipAssets, 'player');
    this.playerView.sync(this.player, this.visualTime, 0);
    this.cameraController.snapTo(this.player.position, this.player.heading);
    this.rebuildCombatShips();
  }

  private startSession(): void {
    if (this.disposed) return;
    this.clearSession();

    this.kills = 0;
    this.killTarget = GAME_CONFIG.match.killTarget;
    this.enemySerial = 0;
    this.spawnTimer = GAME_CONFIG.match.spawnInterval;
    this.pendingResult = null;
    this.resultDelay = 0;

    this.player = new PlayerShip(
      { x: GAME_CONFIG.playerSpawn.x, z: GAME_CONFIG.playerSpawn.z },
      GAME_CONFIG.playerSpawn.heading,
      buildPlayerStats(this.progress.upgrades),
    );
    this.playerView = new ShipView(this.scene, this.shipAssets, 'player');
    this.playerView.sync(this.player, this.visualTime, 0);
    this.cameraController.snapTo(this.player.position, this.player.heading);

    this.mode = 'playing';
    this.harborUI.close();
    this.hud.showGame();
    this.hud.setHarborPrompt(false);
    this.hud.setCoins(this.progress.coins);
    this.hud.setKills(this.kills, this.killTarget);
    this.input.reset();
    this.input.setActive(true);

    this.rebuildCombatShips();
    for (let i = 0; i < GAME_CONFIG.match.initialEnemies; i += 1) {
      this.spawnEnemy();
    }
    this.syncHud();
  }

  private clearSession(): void {
    for (const view of this.enemyViews.values()) view.remove();
    this.enemyViews.clear();
    this.enemies.length = 0;
    this.combatShips.length = 0;
    this.wakeTimers.clear();

    this.combat.reset();
    this.rewards.reset();
    this.projectileViews.reset();
    this.effects.reset();
    this.events.length = 0;

    this.playerView?.remove();
  }

  private rebuildCombatShips(): void {
    this.combatShips.length = 0;
    if (this.player) this.combatShips.push(this.player);
    for (const enemy of this.enemies) this.combatShips.push(enemy);
  }

  // ----------------------------------------------------------------- update

  private update(dt: number): void {
    if (this.disposed) return;

    this.visualTime += dt;
    this.sea.update(dt);
    this.environment.update(dt, this.cameraController.camera);
    this.harbor.update(dt);

    if (this.mode === 'playing') this.updatePlaying(dt);
    this.updatePresentation(dt);
    this.effects.update(dt);

    if (this.pendingResult) {
      this.resultDelay -= dt;
      if (this.resultDelay <= 0) {
        const pending = this.pendingResult;
        this.pendingResult = null;
        this.hud.showResult(pending.kind, pending.detail);
      }
    }
  }

  private updatePlaying(dt: number): void {
    const input = this.input.read();
    this.player.intent.throttle = input.throttle;
    this.player.intent.steer = input.steer;

    if (input.fire) {
      this.combat.tryFire(
        this.player,
        this.player.heading,
        this.events,
        GAME_CONFIG.combat.playerSpread,
      );
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const decision = this.ai.decide(
        enemy,
        this.player,
        this.enemies,
        GAME_CONFIG.world.sailRadius,
        this.islandObstacles,
      );
      enemy.intent.throttle = decision.throttle;
      enemy.intent.steer = decision.steer;
      if (decision.fire) {
        this.combat.tryFire(
          enemy,
          decision.aimHeading,
          this.events,
          GAME_CONFIG.combat.enemySpread,
        );
      }
    }

    this.movement.update(this.player, dt);
    for (const enemy of this.enemies) {
      if (enemy.alive) this.movement.update(enemy, dt);
    }
    this.movement.resolveOverlaps(this.combatShips);
    this.movement.resolveObstacles(this.combatShips, this.islandObstacles);

    this.combat.update(this.combatShips, dt, this.events);
    for (const event of this.events) this.handleCombatEvent(event);
    this.events.length = 0;

    if (this.mode === 'playing' && this.kills >= this.killTarget) {
      this.hud.toast('航程目标达成');
      this.scheduleResult(
        'victory',
        `本航程击沉 ${this.kills} 艘敌舰，持有金币 ${this.progress.coins}。你可以继续航行，或重新开始一局。`,
      );
    }

    if (this.mode === 'playing') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = GAME_CONFIG.match.spawnInterval;
        if (this.countAliveEnemies() < GAME_CONFIG.match.maxActiveEnemies) {
          this.spawnEnemy();
        }
      }
    }

    this.syncHud();
  }

  private updatePresentation(dt: number): void {
    const gameplayDt = this.mode === 'playing' ? dt : 0;

    this.playerView.sync(this.player, this.visualTime, dt);
    for (const enemy of this.enemies) {
      this.enemyViews.get(enemy.id)?.sync(enemy, this.visualTime, dt);
    }

    this.projectileViews.sync(this.combat.getProjectiles(), gameplayDt);
    this.updateWakes(gameplayDt);
    this.pruneSunkEnemies();

    const speedRatio = this.player.alive
      ? clamp(this.player.speed / Math.max(0.001, this.player.stats.maxSpeed), 0, 1)
      : 0;
    this.cameraController.update(
      dt,
      this.player.position,
      this.player.heading,
      speedRatio,
    );
  }

  private updateWakes(dt: number): void {
    if (dt <= 0) return;
    this.updateWakeFor(this.player, dt);
    for (const enemy of this.enemies) this.updateWakeFor(enemy, dt);
  }

  private updateWakeFor(ship: Ship, dt: number): void {
    const speedRatio = clamp(
      Math.abs(ship.speed) / Math.max(0.001, ship.stats.maxSpeed),
      0,
      1,
    );
    if (!ship.alive || speedRatio < 0.11) {
      this.wakeTimers.delete(ship.id);
      return;
    }
    let timer = (this.wakeTimers.get(ship.id) ?? 0) - dt;
    if (timer <= 0) {
      const sternX = ship.position.x - ship.forwardX * 2.3;
      const sternZ = ship.position.z - ship.forwardZ * 2.3;
      this.effects.wake(sternX, sternZ, ship.heading, speedRatio);
      timer = 0.18 - speedRatio * 0.06;
    }
    this.wakeTimers.set(ship.id, timer);
  }

  private pruneSunkEnemies(): void {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      if (enemy.alive) continue;
      const view = this.enemyViews.get(enemy.id);
      if (view && !view.finishedSinking) continue;

      view?.remove();
      this.enemyViews.delete(enemy.id);
      this.wakeTimers.delete(enemy.id);
      this.enemies.splice(i, 1);
      this.rebuildCombatShips();
    }
  }

  // ---------------------------------------------------------------- combat

  private handleCombatEvent(event: CombatEvent): void {
    switch (event.type) {
      case 'fire': {
        this.effects.cannonMuzzle(event.x, event.z, event.heading, event.side);
        if (event.team === 'player') this.cameraController.addShake(0.09);
        break;
      }
      case 'hit': {
        this.effects.impact(event.x, event.z);
        if (event.team === 'player') {
          this.cameraController.addShake(0.34);
          this.hud.flashDamage();
        } else {
          this.cameraController.addShake(0.17);
        }
        break;
      }
      case 'sunk': {
        if (event.team === 'enemy') {
          const awarded = this.rewards.registerSunk(event.shipId, event.coins);
          if (awarded > 0) {
            this.progress.coins += awarded;
            this.progress.totalSunk += 1;
            this.kills += 1;
            this.persist();
            this.hud.setCoins(this.progress.coins);
            this.hud.toast(`击沉敌舰 · +${awarded} 金币`);
          }
          this.effects.impact(event.x, event.z);
          this.cameraController.addShake(0.3);
        } else {
          this.scheduleResult(
            'defeat',
            '海风号沉没了。金币与升级已经保留，整备航线后再试一次。',
          );
        }
        break;
      }
    }
  }

  private scheduleResult(kind: ResultKind, detail: string): void {
    if (this.mode === 'victory' || this.mode === 'defeat') return;
    this.mode = kind;
    this.pendingResult = { kind, detail };
    this.resultDelay = kind === 'defeat' ? 1.25 : 0.8;
    this.input.setActive(false);
    this.hud.setControlsActive(false);
    this.hud.setHarborPrompt(false);
  }

  // ---------------------------------------------------------------- enemies

  private spawnEnemy(): void {
    if (!this.player) return;

    let x = this.player.position.x;
    let z = this.player.position.z;
    let found = false;
    const minDistance = GAME_CONFIG.match.minSpawnDistance;
    const maxDistance = GAME_CONFIG.match.maxSpawnDistance;
    const maxRadius = GAME_CONFIG.world.sailRadius - 28;

    for (let attempt = 0; attempt < 32; attempt += 1) {
      const angle = Math.random() * TAU;
      const distance = randomRange(Math.random, minDistance, maxDistance);
      const candidateX = this.player.position.x + Math.cos(angle) * distance;
      const candidateZ = this.player.position.z + Math.sin(angle) * distance;
      const candidate = { x: candidateX, z: candidateZ };

      if (Math.hypot(candidateX, candidateZ) > maxRadius) continue;
      if (
        distanceTo(candidate, GAME_CONFIG.harbor.center) <
        GAME_CONFIG.match.minSpawnDistanceFromHarbor
      ) {
        continue;
      }

      let nearIsland = false;
      for (const island of GAME_CONFIG.decorativeIslands) {
        if (distanceTo(candidate, island) < island.shoreRadius + 26) {
          nearIsland = true;
          break;
        }
      }
      if (nearIsland) continue;

      let tooClose = false;
      for (const other of this.enemies) {
        if (
          distanceTo({ x: candidateX, z: candidateZ }, other.position) <
          GAME_CONFIG.match.minEnemySeparation
        ) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      x = candidateX;
      z = candidateZ;
      found = true;
      break;
    }

    if (!found) {
      const angle = Math.random() * TAU;
      const distance = maxDistance * 0.85;
      x = this.player.position.x + Math.cos(angle) * distance;
      z = this.player.position.z + Math.sin(angle) * distance;
      const radial = Math.hypot(x, z);
      if (radial > maxRadius) {
        x = (x / radial) * maxRadius;
        z = (z / radial) * maxRadius;
      }
    }

    const serial = this.enemySerial + 1;
    this.enemySerial = serial;
    const id = `enemy-${serial}`;
    const enemy = new EnemyShip(
      id,
      `赤帆 ${serial}`,
      { x, z },
      headingToPoint({ x, z }, this.player.position),
      GAME_CONFIG.ship.enemy,
      GAME_CONFIG.match.enemyCoinValue,
      Math.random() < 0.5 ? -1 : 1,
      Math.random() * TAU,
    );
    enemy.fireCooldownRemaining = 0.8 + Math.random() * 1.6;

    this.enemies.push(enemy);
    const view = new ShipView(this.scene, this.shipAssets, 'enemy');
    view.sync(enemy, this.visualTime, 0);
    this.enemyViews.set(id, view);
    this.combatShips.push(enemy);
  }

  private countAliveEnemies(): number {
    let count = 0;
    for (const enemy of this.enemies) if (enemy.alive) count += 1;
    return count;
  }

  // -------------------------------------------------------------------- HUD

  private syncHud(): void {
    const enemyItems: EnemyHudItem[] = [];
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemyItems.push({
        id: enemy.id,
        name: enemy.name,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
      });
    }

    this.hud.setEnemies(enemyItems);
    this.hud.setVitals(
      this.player.hp,
      this.player.maxHp,
      this.player.alive ? this.player.speed : 0,
    );
    this.hud.setCoins(this.progress.coins);
    this.hud.setKills(this.kills, this.killTarget);
    this.hud.setReload(
      this.player.alive ? this.player.fireCooldownRemaining : 0,
      this.player.stats.fireCooldown,
    );

    const canDock =
      this.mode === 'playing' &&
      this.player.alive &&
      distanceTo(this.player.position, GAME_CONFIG.harbor.dockPoint) <=
        GAME_CONFIG.harbor.dockRadius;
    this.hud.setHarborPrompt(canDock);
  }

  // ------------------------------------------------------------------- flow

  private togglePause(): void {
    if (this.mode === 'playing') this.pauseGame();
    else if (this.mode === 'paused') this.resumeGame();
  }

  private pauseGame(): void {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.player.intent.throttle = 0;
    this.player.intent.steer = 0;
    this.input.setActive(false);
    this.hud.setControlsActive(false);
    this.hud.setHarborPrompt(false);
    this.hud.showPause();
  }

  private resumeGame(): void {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.hud.hidePause();
    this.input.reset();
    this.input.setActive(true);
    this.hud.setControlsActive(true);
  }

  private tryDock(): void {
    if (this.mode !== 'playing' || !this.player.alive) return;
    const dockDistance = distanceTo(
      this.player.position,
      GAME_CONFIG.harbor.dockPoint,
    );
    if (dockDistance > GAME_CONFIG.harbor.dockRadius) {
      this.hud.toast('驶入港口金色环带即可停靠');
      return;
    }
    this.enterHarbor();
  }

  private enterHarbor(): void {
    if (this.mode !== 'playing' || !this.player.alive) return;
    const dockDistance = distanceTo(
      this.player.position,
      GAME_CONFIG.harbor.dockPoint,
    );
    if (dockDistance > GAME_CONFIG.harbor.dockRadius) return;

    this.mode = 'docked';
    this.player.intent.throttle = 0;
    this.player.intent.steer = 0;
    this.player.speed = 0;
    this.player.hp = this.player.maxHp;
    this.input.setActive(false);
    this.hud.setControlsActive(false);
    this.hud.setHarborPrompt(false);
    this.hud.setVitals(this.player.hp, this.player.maxHp, 0);
    this.harborUI.open(this.progress);
  }

  private leaveHarbor(): void {
    if (this.mode !== 'docked') return;
    this.harborUI.close();
    this.mode = 'playing';
    this.input.reset();
    this.input.setActive(true);
    this.hud.setControlsActive(true);
    this.hud.toast('再次出海');
  }

  private buyUpgrade(type: UpgradeType): void {
    if (this.mode !== 'docked') return;
    const result = purchaseUpgrade(this.progress, type);
    if (!result.success) {
      this.hud.toast(
        result.reason === 'max-level'
          ? '该强化已达到最高等级'
          : `金币不足，需要 ${result.cost} 金币`,
      );
      return;
    }

    this.persist();
    const stats = buildPlayerStats(this.progress.upgrades);
    this.player.stats = stats;
    this.player.maxHp = stats.maxHp;
    this.player.hp = this.player.maxHp;
    this.hud.setCoins(this.progress.coins);
    this.hud.setVitals(this.player.hp, this.player.maxHp, 0);
    this.harborUI.refresh(this.progress);
    this.hud.toast(`强化完成 · 花费 ${result.cost} 金币`);
  }

  private continueAfterVictory(): void {
    if (this.mode !== 'victory') return;
    this.killTarget += GAME_CONFIG.match.killTargetStep;
    this.pendingResult = null;
    this.resultDelay = 0;
    this.mode = 'playing';
    this.hud.hideResult();
    this.hud.setControlsActive(true);
    this.input.reset();
    this.input.setActive(true);
    this.hud.setKills(this.kills, this.killTarget);
    this.spawnTimer = 2.2;
    if (this.countAliveEnemies() === 0) this.spawnEnemy();
    this.hud.toast(`下一目标：击沉 ${this.killTarget} 艘`);
  }

  private resetProgress(): void {
    this.progress = this.saveManager.reset();
    this.saveWarningShown = false;

    if (this.mode === 'menu') {
      this.hud.showStart(this.progress);
      return;
    }

    this.startSession();
    this.hud.toast('存档已重置');
  }

  private persist(): void {
    const ok = this.saveManager.save(this.progress);
    if (!ok && !this.saveWarningShown) {
      this.saveWarningShown = true;
      console.warn(
        '[Age of Wind Web] 存档写入失败：',
        this.saveManager.getLastError(),
      );
      this.hud.toast('存档写入失败，进度可能无法保留');
    }
  }

  // --------------------------------------------------------------- platform

  private resize(viewport: ViewportSize): void {
    const width = Math.max(1, viewport.width);
    const height = Math.max(1, viewport.height);
    const dprCap = this.platform.isTouch ? 1.75 : 2;
    this.renderer.setPixelRatio(Math.min(viewport.dpr || 1, dprCap));
    this.renderer.setSize(width, height, false);
    this.cameraController.resize(width / height);
  }

  private render(): void {
    this.renderer.render(this.scene, this.cameraController.camera);
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.loop.stop();
    this.input.setActive(false);
    this.hud.setControlsActive(false);
    showFatalError(
      'WebGL 图形上下文已丢失。请刷新页面；如果反复出现，请检查浏览器硬件加速设置。',
    );
  };
}
