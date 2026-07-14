import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { storage } from '../../src/utils/storage';

describe('storage utility', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('SSR Context (window is undefined)', () => {
    beforeEach(() => {
      vi.stubGlobal('window', undefined);
    });

    it('get should return null', () => {
      expect(storage.get('test')).toBeNull();
    });

    it('set should not throw', () => {
      expect(() => storage.set('test', 'value')).not.toThrow();
    });

    it('remove should not throw', () => {
      expect(() => storage.remove('test')).not.toThrow();
    });
  });

  describe('Strict Privacy Mode (localStorage throws)', () => {
    beforeEach(() => {
      const mockStorage = {
        getItem: vi.fn().mockImplementation(() => { throw new Error('Access denied'); }),
        setItem: vi.fn().mockImplementation(() => { throw new Error('Access denied'); }),
        removeItem: vi.fn().mockImplementation(() => { throw new Error('Access denied'); }),
      };
      vi.stubGlobal('window', { localStorage: mockStorage });
    });

    it('get should catch error, warn, and return null', () => {
      expect(storage.get('test')).toBeNull();
      expect(console.warn).toHaveBeenCalledWith('localStorage is unavailable', expect.any(Error));
    });

    it('set should catch error and warn', () => {
      expect(() => storage.set('test', 'value')).not.toThrow();
      expect(console.warn).toHaveBeenCalledWith('localStorage is unavailable', expect.any(Error));
    });

    it('remove should catch error and warn', () => {
      expect(() => storage.remove('test')).not.toThrow();
      expect(console.warn).toHaveBeenCalledWith('localStorage is unavailable', expect.any(Error));
    });
  });

  describe('Normal Operation', () => {
    beforeEach(() => {
      const mockStorage = {
        getItem: vi.fn().mockReturnValue('stored-value'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      vi.stubGlobal('window', { localStorage: mockStorage });
    });

    it('get should return the value from localStorage', () => {
      expect(storage.get('test')).toBe('stored-value');
    });

    it('set should call localStorage.setItem', () => {
      storage.set('test', 'new-value');
      expect(window.localStorage.setItem).toHaveBeenCalledWith('test', 'new-value');
    });

    it('remove should call localStorage.removeItem', () => {
      storage.remove('test');
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('test');
    });
  });
});
