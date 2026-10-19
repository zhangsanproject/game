/**
 * Minimal key/value contract the save layer needs. The web implementation uses
 * localStorage; a future Douyin adapter can wrap tt.getStorageSync/setStorageSync.
 */
export interface StorageAdapter {
  getItem(key: string): string | null;
  /** Returns false instead of throwing when persistence is unavailable. */
  setItem(key: string, value: string): boolean;
  removeItem(key: string): boolean;
}
