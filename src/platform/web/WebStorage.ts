import type { StorageAdapter } from '../../save/Storage';

/** localStorage wrapper that degrades gracefully in privacy-restricted contexts. */
export class WebStorage implements StorageAdapter {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): boolean {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  removeItem(key: string): boolean {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
}
