import { SAVE_CONFIG } from '../game/config';
import { createDefaultSave, sanitizeSaveData, type SaveData } from './SaveData';
import type { StorageAdapter } from './Storage';

/**
 * Owns serialization and validation only. Gameplay mutation (coins, upgrades)
 * happens in the systems; this class persists the result.
 */
export class SaveManager {
  private lastError: string | null = null;

  constructor(
    private readonly storage: StorageAdapter,
    private readonly key: string = SAVE_CONFIG.key,
  ) {}

  load(): SaveData {
    this.lastError = null;
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return createDefaultSave();
      const parsed: unknown = JSON.parse(raw);
      return sanitizeSaveData(parsed);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : '未知存档读取错误';
      return createDefaultSave();
    }
  }

  save(data: SaveData): boolean {
    this.lastError = null;
    try {
      const serializable: SaveData = {
        version: SAVE_CONFIG.version,
        coins: Math.max(0, Math.floor(data.coins)),
        upgrades: {
          hull: data.upgrades.hull,
          speed: data.upgrades.speed,
          damage: data.upgrades.damage,
        },
        totalSunk: Math.max(0, Math.floor(data.totalSunk)),
      };
      const ok = this.storage.setItem(this.key, JSON.stringify(serializable));
      if (!ok) this.lastError = '浏览器拒绝了存档写入（可能是隐私模式或存储空间不足）';
      return ok;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : '未知存档写入错误';
      return false;
    }
  }

  /** Removes the persisted save and returns a fresh default object. */
  reset(): SaveData {
    this.lastError = null;
    try {
      this.storage.removeItem(this.key);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : '未知存档清除错误';
    }
    return createDefaultSave();
  }

  getLastError(): string | null {
    return this.lastError;
  }

  getKey(): string {
    return this.key;
  }
}
