import type { SaveData } from '../save/SaveData';

export interface EnemyHudItem {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
}

export interface HUDCallbacks {
  onStart: () => void;
  onPauseToggle: () => void;
  onResume: () => void;
  onRestart: () => void;
  onResetSave: () => void;
  onDock: () => void;
  onResultPrimary: () => void;
  onResultSecondary: () => void;
}

interface EnemyRow {
  root: HTMLDivElement;
  name: HTMLSpanElement;
  fill: HTMLElement;
  lastLabel: string;
}

export type ResultKind = 'victory' | 'defeat';

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`缺少 UI 元素 #${id}`);
  return node as T;
}

/**
 * Owns every HUD/screen DOM node and translates game state into readable UI.
 * No simulation logic lives here.
 */
export class HUD {
  private readonly abort = new AbortController();
  private readonly timeouts = new Set<number>();

  private readonly startScreen = element<HTMLDivElement>('start-screen');
  private readonly pauseScreen = element<HTMLDivElement>('pause-screen');
  private readonly resultScreen = element<HTMLDivElement>('result-screen');
  private readonly hudRoot = element<HTMLDivElement>('hud');
  private readonly touchControls = element<HTMLDivElement>('touch-controls');

  private readonly hpFill = element<HTMLElement>('hp-fill');
  private readonly hpText = element<HTMLElement>('hp-text');
  private readonly speedText = element<HTMLElement>('speed-text');
  private readonly killsText = element<HTMLElement>('kills-text');
  private readonly coinText = element<HTMLElement>('coin-text');
  private readonly enemyCount = element<HTMLElement>('enemy-count');
  private readonly enemyList = element<HTMLDivElement>('enemy-list');
  private readonly reloadWrap = element<HTMLDivElement>('reload-wrap');
  private readonly reloadFill = element<HTMLElement>('reload-fill');
  private readonly reloadText = element<HTMLElement>('reload-text');
  private readonly harborPrompt = element<HTMLDivElement>('harbor-prompt');
  private readonly toastArea = element<HTMLDivElement>('toast-area');
  private readonly damageVignette = element<HTMLDivElement>('damage-vignette');
  private readonly fireButton = element<HTMLButtonElement>('fire-button');

  private readonly startCoins = element<HTMLElement>('start-coins');
  private readonly startHull = element<HTMLElement>('start-hull');
  private readonly startSpeed = element<HTMLElement>('start-speed');
  private readonly startDamage = element<HTMLElement>('start-damage');

  private readonly resultEyebrow = element<HTMLElement>('result-eyebrow');
  private readonly resultTitle = element<HTMLElement>('result-title');
  private readonly resultDetail = element<HTMLElement>('result-detail');
  private readonly resultPrimary = element<HTMLButtonElement>('result-primary-btn');
  private readonly resultSecondary = element<HTMLButtonElement>('result-secondary-btn');

  private readonly enemyRows = new Map<string, EnemyRow>();
  private enemyKey = '';

  private touchMode = false;
  private controlsActive = false;
  private hudVisible = false;
  private harborPromptVisible = false;

  private lastHp = Number.NaN;
  private lastMaxHp = Number.NaN;
  private lastSpeedKnots = Number.NaN;
  private lastCoins = Number.NaN;
  private lastKills = Number.NaN;
  private lastTarget = Number.NaN;
  private lastReloadLabel = '';
  private lastReloadReady: boolean | null = null;
  private damageTimeout: number | null = null;

  constructor(callbacks: HUDCallbacks) {
    this.bindClick('start-btn', callbacks.onStart);
    this.bindClick('pause-btn', callbacks.onPauseToggle);
    this.bindClick('pause-resume', callbacks.onResume);
    this.bindClick('pause-restart', callbacks.onRestart);
    this.bindClick('dock-btn', callbacks.onDock);
    this.bindClick('result-primary-btn', callbacks.onResultPrimary);
    this.bindClick('result-secondary-btn', callbacks.onResultSecondary);

    this.bindReset('reset-save-start', callbacks.onResetSave);
    this.bindReset('reset-save-pause', callbacks.onResetSave);

    this.setTouchMode(false);
  }

  setTouchMode(touch: boolean): void {
    this.touchMode = touch;
    document.body.classList.toggle('touch-ui', touch);
    this.updateTouchVisibility();
  }

  showStart(save: SaveData): void {
    this.startScreen.classList.remove('is-hidden');
    this.pauseScreen.classList.add('is-hidden');
    this.resultScreen.classList.add('is-hidden');
    this.hudRoot.classList.add('is-hidden');
    this.hudVisible = false;
    this.controlsActive = false;
    this.updateTouchVisibility();

    this.startCoins.textContent = String(save.coins);
    this.startHull.textContent = `Lv.${save.upgrades.hull}`;
    this.startSpeed.textContent = `Lv.${save.upgrades.speed}`;
    this.startDamage.textContent = `Lv.${save.upgrades.damage}`;
  }

  hideStart(): void {
    this.startScreen.classList.add('is-hidden');
  }

  showGame(): void {
    this.hideStart();
    this.pauseScreen.classList.add('is-hidden');
    this.resultScreen.classList.add('is-hidden');
    this.hudRoot.classList.remove('is-hidden');
    this.hudVisible = true;
    this.controlsActive = true;
    this.updateTouchVisibility();
  }

  showPause(): void {
    this.pauseScreen.classList.remove('is-hidden');
    this.controlsActive = false;
    this.updateTouchVisibility();
  }

  hidePause(): void {
    this.pauseScreen.classList.add('is-hidden');
  }

  showResult(kind: ResultKind, detail: string): void {
    this.pauseScreen.classList.add('is-hidden');
    this.resultScreen.classList.remove('is-hidden');
    this.controlsActive = false;
    this.updateTouchVisibility();
    this.harborPrompt.classList.add('is-hidden');
    this.harborPromptVisible = false;

    if (kind === 'victory') {
      this.resultEyebrow.textContent = '航程目标达成';
      this.resultTitle.textContent = '海域暂告肃清';
      this.resultPrimary.textContent = '再战一次';
      this.resultSecondary.textContent = '继续航行';
      this.resultSecondary.classList.remove('is-hidden');
    } else {
      this.resultEyebrow.textContent = '航程中断';
      this.resultTitle.textContent = '海风号沉没';
      this.resultPrimary.textContent = '重新出发';
      this.resultSecondary.classList.add('is-hidden');
    }
    this.resultDetail.textContent = detail;
  }

  hideResult(): void {
    this.resultScreen.classList.add('is-hidden');
  }

  setControlsActive(active: boolean): void {
    this.controlsActive = active;
    this.updateTouchVisibility();
  }

  setVitals(hp: number, maxHp: number, speed: number): void {
    const safeMax = Math.max(1, maxHp);
    const safeHp = Math.max(0, Math.min(hp, safeMax));
    if (safeHp !== this.lastHp || safeMax !== this.lastMaxHp) {
      this.lastHp = safeHp;
      this.lastMaxHp = safeMax;
      const fraction = safeHp / safeMax;
      this.hpFill.style.transform = `scaleX(${fraction.toFixed(3)})`;
      this.hpText.textContent = `${Math.ceil(safeHp)} / ${Math.ceil(safeMax)}`;
      this.hpFill.parentElement?.classList.toggle('is-low', fraction <= 0.3);
    }

    const knots = Math.round(Math.abs(speed) * 1.9);
    if (knots !== this.lastSpeedKnots) {
      this.lastSpeedKnots = knots;
      this.speedText.textContent = `航速 ${knots} 节`;
    }
  }

  setCoins(coins: number): void {
    const safe = Math.max(0, Math.floor(coins));
    if (safe === this.lastCoins) return;
    this.lastCoins = safe;
    this.coinText.textContent = String(safe);
  }

  setKills(kills: number, target: number): void {
    if (kills === this.lastKills && target === this.lastTarget) return;
    this.lastKills = kills;
    this.lastTarget = target;
    this.killsText.textContent = `击沉 ${kills} / ${target}`;
  }

  setEnemies(enemies: readonly EnemyHudItem[]): void {
    const key = [...enemies]
      .map((enemy) => enemy.id)
      .sort()
      .join('|');
    if (key !== this.enemyKey) {
      this.enemyKey = key;
      this.rebuildEnemyList(enemies);
    }

    this.enemyCount.textContent = String(enemies.length);
    for (const enemy of enemies) {
      const row = this.enemyRows.get(enemy.id);
      if (!row) continue;
      const fraction = enemy.maxHp > 0 ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)) : 0;
      row.fill.style.transform = `scaleX(${fraction.toFixed(3)})`;
      const label = `${enemy.name} · ${Math.ceil(enemy.hp)}`;
      if (label !== row.lastLabel) {
        row.lastLabel = label;
        row.name.textContent = label;
      }
    }
  }

  setReload(remaining: number, total: number): void {
    const safeTotal = Math.max(0.0001, total);
    const progress = Math.max(0, Math.min(1, 1 - remaining / safeTotal));
    this.reloadFill.style.transform = `scaleX(${progress.toFixed(3)})`;

    const ready = remaining <= 0.001;
    if (ready !== this.lastReloadReady) {
      this.lastReloadReady = ready;
      this.reloadWrap.classList.toggle('is-ready', ready);
      this.fireButton.classList.toggle('is-ready', ready);
    }

    const label = ready ? '火炮就绪' : `装填 ${remaining.toFixed(1)}s`;
    if (label !== this.lastReloadLabel) {
      this.lastReloadLabel = label;
      this.reloadText.textContent = label;
    }
  }

  setHarborPrompt(visible: boolean): void {
    if (visible === this.harborPromptVisible) return;
    this.harborPromptVisible = visible;
    this.harborPrompt.classList.toggle('is-hidden', !visible);
  }

  toast(message: string): void {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    this.toastArea.appendChild(toast);
    while (this.toastArea.childElementCount > 4) {
      this.toastArea.firstElementChild?.remove();
    }
    const timeout = window.setTimeout(() => {
      toast.remove();
      this.timeouts.delete(timeout);
    }, 1950);
    this.timeouts.add(timeout);
  }

  flashDamage(): void {
    if (this.damageTimeout !== null) {
      window.clearTimeout(this.damageTimeout);
      this.timeouts.delete(this.damageTimeout);
    }
    this.damageVignette.classList.remove('flash');
    void this.damageVignette.offsetWidth;
    this.damageVignette.classList.add('flash');
    this.damageTimeout = window.setTimeout(() => {
      this.damageVignette.classList.remove('flash');
      this.damageTimeout = null;
    }, 380);
    this.timeouts.add(this.damageTimeout);
  }

  dispose(): void {
    this.abort.abort();
    for (const timeout of this.timeouts) window.clearTimeout(timeout);
    this.timeouts.clear();
    if (this.damageTimeout !== null) window.clearTimeout(this.damageTimeout);
  }

  private rebuildEnemyList(enemies: readonly EnemyHudItem[]): void {
    this.enemyRows.clear();
    this.enemyList.replaceChildren();

    if (enemies.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'enemy-empty';
      empty.textContent = '尚未发现敌舰';
      this.enemyList.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const enemy of enemies) {
      const root = document.createElement('div');
      root.className = 'enemy-chip';

      const name = document.createElement('span');
      name.className = 'enemy-name';
      name.textContent = enemy.name;

      const hpTrack = document.createElement('div');
      hpTrack.className = 'enemy-hp';
      const fill = document.createElement('i');
      hpTrack.appendChild(fill);

      root.append(name, hpTrack);
      fragment.appendChild(root);
      this.enemyRows.set(enemy.id, {
        root,
        name,
        fill,
        lastLabel: '',
      });
    }
    this.enemyList.appendChild(fragment);
  }

  private updateTouchVisibility(): void {
    const visible =
      this.touchMode && this.controlsActive && this.hudVisible;
    this.touchControls.classList.toggle('is-hidden', !visible);
  }

  private bindClick(id: string, handler: () => void): void {
    const button = element<HTMLButtonElement>(id);
    button.addEventListener(
      'click',
      () => {
        button.blur();
        handler();
      },
      { signal: this.abort.signal },
    );
  }

  private bindReset(id: string, handler: () => void): void {
    const button = element<HTMLButtonElement>(id);
    const label = button.textContent?.trim() || '重置存档';
    let resetTimer: number | null = null;

    button.addEventListener(
      'click',
      () => {
        button.blur();
        if (button.dataset.armed === '1') {
          button.dataset.armed = '0';
          button.textContent = label;
          if (resetTimer !== null) {
            window.clearTimeout(resetTimer);
            this.timeouts.delete(resetTimer);
            resetTimer = null;
          }
          handler();
          return;
        }

        button.dataset.armed = '1';
        button.textContent = '再次点击确认';
        resetTimer = window.setTimeout(() => {
          button.dataset.armed = '0';
          button.textContent = label;
          if (resetTimer !== null) this.timeouts.delete(resetTimer);
          resetTimer = null;
        }, 3200);
        this.timeouts.add(resetTimer);
      },
      { signal: this.abort.signal },
    );
  }
}
