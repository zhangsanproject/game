import { describe, expect, it } from 'vitest';
import { SAVE_CONFIG, UPGRADE_CONFIG } from '../src/game/config';
import { createDefaultSave, sanitizeSaveData } from '../src/save/SaveData';
import { SaveManager } from '../src/save/SaveManager';
import type { StorageAdapter } from '../src/save/Storage';

class MemoryStorage implements StorageAdapter {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): boolean {
    this.values.set(key, value);
    return true;
  }

  removeItem(key: string): boolean {
    return this.values.delete(key);
  }
}

describe('SaveManager', () => {
  it('returns defaults when no save exists', () => {
    const manager = new SaveManager(new MemoryStorage());
    expect(manager.load()).toEqual(createDefaultSave());
  });

  it('round-trips coins, upgrade levels and version', () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const save = createDefaultSave();
    save.coins = 175;
    save.upgrades.hull = 2;
    save.upgrades.speed = 1;
    save.upgrades.damage = 4;
    save.totalSunk = 12;

    expect(manager.save(save)).toBe(true);
    const raw = storage.getItem(SAVE_CONFIG.key);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? '{}').version).toBe(SAVE_CONFIG.version);

    expect(manager.load()).toEqual(save);
  });

  it('falls back safely when stored JSON is corrupted', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_CONFIG.key, '{not valid json');
    const manager = new SaveManager(storage);

    expect(manager.load()).toEqual(createDefaultSave());
    expect(manager.getLastError()).toBeTruthy();
  });

  it('rejects unknown save versions', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_CONFIG.key,
      JSON.stringify({ version: 999, coins: 500, upgrades: { hull: 5 } }),
    );
    const manager = new SaveManager(storage);

    expect(manager.load()).toEqual(createDefaultSave());
  });

  it('sanitises out-of-range and malformed fields', () => {
    const sanitized = sanitizeSaveData({
      version: SAVE_CONFIG.version,
      coins: -50,
      upgrades: { hull: 99, speed: -3, damage: 'lots' },
      totalSunk: 2.9,
    });

    expect(sanitized.coins).toBe(0);
    expect(sanitized.upgrades.hull).toBe(UPGRADE_CONFIG.maxLevel);
    expect(sanitized.upgrades.speed).toBe(0);
    expect(sanitized.upgrades.damage).toBe(0);
    expect(sanitized.totalSunk).toBe(2);
  });

  it('clears the persisted key when resetting', () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const save = createDefaultSave();
    save.coins = 80;
    manager.save(save);

    const reset = manager.reset();
    expect(reset).toEqual(createDefaultSave());
    expect(storage.getItem(SAVE_CONFIG.key)).toBeNull();
  });

  it('reports write failures without throwing', () => {
    const storage: StorageAdapter = {
      getItem: () => null,
      setItem: () => false,
      removeItem: () => false,
    };
    const manager = new SaveManager(storage);
    expect(manager.save(createDefaultSave())).toBe(false);
    expect(manager.getLastError()).toBeTruthy();
    expect(manager.load()).toEqual(createDefaultSave());
  });
});
