/**
 * Safe localStorage wrapper.
 * Prevents strict-mode browser crashes or issues in SSR contexts.
 */
export const storage = {
  get(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage is unavailable', e);
      return null;
    }
  },

  set(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage is unavailable', e);
    }
  },

  remove(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.warn('localStorage is unavailable', e);
    }
  }
};
