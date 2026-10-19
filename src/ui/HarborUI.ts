import { UPGRADE_CONFIG } from '../game/config';
import {
  buildPlayerStats,
  getUpgradeCost,
} from '../game/systems/UpgradeSystem';
import type { UpgradeType } from '../game/types';
import { UPGRADE_TYPES, type SaveData } from '../save/SaveData';

export interface HarborUICallbacks {
  onBuy: (type: UpgradeType) => void;
  onLeave: () => void;
  onResetSave: () => void;
}

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`缺少 UI 元素 #${id}`);
  return node as T;
}

function isUpgradeType(value: string | undefined): value is UpgradeType {
  return value === 'hull' || value === 'speed' || value === 'damage';
}

/** Harbor upgrade panel. Only presentation; purchase logic stays in systems. */
export class HarborUI {
  private readonly abort = new AbortController();
  private readonly timeouts = new Set<number>();
  private readonly screen = element<HTMLDivElement>('harbor-screen');
  private readonly coins = element<HTMLElement>('harbor-coins');
  private readonly list = element<HTMLDivElement>('upgrade-list');
  private readonly leaveButton = element<HTMLButtonElement>('leave-harbor-btn');
  private openState = false;

  constructor(private readonly callbacks: HarborUICallbacks) {
    this.leaveButton.addEventListener(
      'click',
      () => {
        this.leaveButton.blur();
        callbacks.onLeave();
      },
      { signal: this.abort.signal },
    );

    this.list.addEventListener(
      'click',
      (event) => {
        const target = event.target as HTMLElement | null;
        const button = target?.closest<HTMLButtonElement>('button[data-upgrade]');
        if (!button || button.disabled) return;
        const type = button.dataset.upgrade;
        if (isUpgradeType(type)) callbacks.onBuy(type);
      },
      { signal: this.abort.signal },
    );

    this.bindReset(element<HTMLButtonElement>('reset-save-harbor'));
  }

  open(save: SaveData): void {
    this.refresh(save);
    this.screen.classList.remove('is-hidden');
    this.openState = true;
  }

  close(): void {
    this.screen.classList.add('is-hidden');
    this.openState = false;
  }

  refresh(save: SaveData): void {
    this.coins.textContent = String(save.coins);
    const currentStats = buildPlayerStats(save.upgrades);
    const cards: HTMLElement[] = [];

    for (const type of UPGRADE_TYPES) {
      const definition = UPGRADE_CONFIG.items[type];
      const level = save.upgrades[type];
      const maxLevel = UPGRADE_CONFIG.maxLevel;
      const isMax = level >= maxLevel;
      const cost = getUpgradeCost(type, level);
      const nextLevels = {
        ...save.upgrades,
        [type]: Math.min(maxLevel, level + 1),
      };
      const nextStats = buildPlayerStats(nextLevels);

      let effect: string;
      if (type === 'hull') {
        effect = isMax
          ? `船体上限 ${currentStats.maxHp}`
          : `船体上限 ${currentStats.maxHp} → ${nextStats.maxHp}`;
      } else if (type === 'speed') {
        const currentKnots = Math.round(currentStats.maxSpeed * 1.9);
        const nextKnots = Math.round(nextStats.maxSpeed * 1.9);
        effect = isMax
          ? `最高航速 ${currentKnots} 节`
          : `最高航速 ${currentKnots} → ${nextKnots} 节`;
      } else {
        effect = isMax
          ? `单发伤害 ${currentStats.cannonDamage}`
          : `单发伤害 ${currentStats.cannonDamage} → ${nextStats.cannonDamage}`;
      }

      const card = document.createElement('article');
      card.className = 'upgrade-card';

      const tag = document.createElement('span');
      tag.className = 'upgrade-tag';
      tag.textContent = definition.tagline;

      const pips = document.createElement('div');
      pips.className = 'pips';
      for (let i = 0; i < maxLevel; i += 1) {
        const pip = document.createElement('i');
        pip.className = i < level ? 'pip filled' : 'pip';
        pips.appendChild(pip);
      }

      const title = document.createElement('h3');
      title.textContent = definition.name;

      const effectLine = document.createElement('p');
      effectLine.className = 'upgrade-effect';
      effectLine.textContent = effect;

      const description = document.createElement('p');
      description.className = 'upgrade-desc';
      description.textContent = definition.description;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn buy';
      button.dataset.upgrade = type;
      if (isMax) {
        button.textContent = '已满级';
        button.disabled = true;
      } else {
        button.textContent = `升级 · ◈ ${cost}`;
        button.disabled = save.coins < cost;
      }

      card.append(tag, pips, title, effectLine, description, button);
      cards.push(card);
    }

    this.list.replaceChildren(...cards);
  }

  isOpen(): boolean {
    return this.openState;
  }

  dispose(): void {
    this.abort.abort();
    for (const timeout of this.timeouts) window.clearTimeout(timeout);
    this.timeouts.clear();
  }

  private bindReset(button: HTMLButtonElement): void {
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
          this.callbacks.onResetSave();
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
