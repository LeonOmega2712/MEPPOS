import { Observable, Subject } from 'rxjs';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { SwrCache } from './swr-cache';

describe('SwrCache', () => {
  let fetchSubject: Subject<string>;
  let fetcherMock: Mock<() => Observable<string>>;
  let nowMock: Mock<() => number>;
  let cache: SwrCache<string>;

  const TTL = 1000;

  beforeEach(() => {
    fetchSubject = new Subject<string>();
    fetcherMock = vi.fn<() => Observable<string>>().mockReturnValue(fetchSubject.asObservable());
    nowMock = vi.fn<() => number>().mockReturnValue(0);
    cache = new SwrCache<string>({ fetcher: fetcherMock, ttlMs: TTL, now: nowMock });
  });

  describe('initial state', () => {
    it('data, loading, revalidating, and error signals are all at zero values', () => {
      expect(cache.data()).toBeNull();
      expect(cache.loading()).toBe(false);
      expect(cache.revalidating()).toBe(false);
      expect(cache.error()).toBeNull();
    });
  });

  describe('fresh load (cache miss)', () => {
    it('ensureLoaded triggers a fetch and sets loading to true', () => {
      cache.ensureLoaded();

      expect(fetcherMock).toHaveBeenCalledTimes(1);
      expect(cache.loading()).toBe(true);
      expect(cache.revalidating()).toBe(false);
    });

    it('data is updated and loading cleared when fetch resolves', () => {
      cache.ensureLoaded();
      fetchSubject.next('result');
      fetchSubject.complete();

      expect(cache.data()).toBe('result');
      expect(cache.loading()).toBe(false);
      expect(cache.error()).toBeNull();
    });
  });

  describe('cache hit (within TTL)', () => {
    beforeEach(() => {
      cache.ensureLoaded();
      fetchSubject.next('cached');
      fetchSubject.complete();
      nowMock.mockReturnValue(TTL - 1); // not yet stale
    });

    it('second ensureLoaded within TTL does not call fetcher again', () => {
      fetcherMock.mockReturnValue(new Subject<string>().asObservable());
      cache.ensureLoaded();

      expect(fetcherMock).toHaveBeenCalledTimes(1);
    });

    it('data signal still holds the value from the first fetch', () => {
      cache.ensureLoaded();

      expect(cache.data()).toBe('cached');
    });
  });

  describe('TTL boundary', () => {
    beforeEach(() => {
      cache.ensureLoaded();
      fetchSubject.next('initial');
      fetchSubject.complete();
      fetchSubject = new Subject<string>();
      fetcherMock.mockReturnValue(fetchSubject.asObservable());
    });

    it('at exactly ttlMs (>=) treats cache as stale and starts background fetch', () => {
      nowMock.mockReturnValue(TTL);
      cache.ensureLoaded();

      expect(fetcherMock).toHaveBeenCalledTimes(2);
      expect(cache.revalidating()).toBe(true);
      expect(cache.loading()).toBe(false);
    });

    it('one millisecond before ttlMs treats cache as fresh', () => {
      nowMock.mockReturnValue(TTL - 1);
      cache.ensureLoaded();

      expect(fetcherMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('stale-while-revalidate behavior', () => {
    beforeEach(() => {
      cache.ensureLoaded();
      fetchSubject.next('stale-data');
      fetchSubject.complete();
      nowMock.mockReturnValue(TTL); // now stale
      fetchSubject = new Subject<string>();
      fetcherMock.mockReturnValue(fetchSubject.asObservable());
    });

    it('stale data is immediately visible while background fetch is in-flight', () => {
      cache.ensureLoaded();

      expect(cache.data()).toBe('stale-data');
      expect(cache.revalidating()).toBe(true);
    });

    it('data updates to fresh value after background fetch resolves', () => {
      cache.ensureLoaded();
      fetchSubject.next('fresh-data');
      fetchSubject.complete();

      expect(cache.data()).toBe('fresh-data');
      expect(cache.revalidating()).toBe(false);
    });

    it('revalidating is true and loading is false during background fetch', () => {
      cache.ensureLoaded();

      expect(cache.revalidating()).toBe(true);
      expect(cache.loading()).toBe(false);
    });
  });

  describe('concurrent requests (in-flight deduplication)', () => {
    it('multiple ensureLoaded calls before first fetch resolves trigger only one fetch', () => {
      cache.ensureLoaded();
      cache.ensureLoaded();
      cache.ensureLoaded();

      expect(fetcherMock).toHaveBeenCalledTimes(1);
    });

    it('concurrent subscribers to refresh() share the same in-flight observable', () => {
      const results: string[] = [];

      const obs1 = cache.refresh();
      const obs2 = cache.refresh();

      obs1.subscribe(v => results.push(`a:${v}`));
      obs2.subscribe(v => results.push(`b:${v}`));

      fetchSubject.next('shared');
      fetchSubject.complete();

      expect(fetcherMock).toHaveBeenCalledTimes(1);
      expect(results).toContain('a:shared');
      expect(results).toContain('b:shared');
    });
  });

  describe('error handling', () => {
    it('error signal is set and loading returns to false on fetch failure', () => {
      cache.ensureLoaded();
      const err = new Error('network error');
      fetchSubject.error(err);

      expect(cache.error()).toBe(err);
      expect(cache.loading()).toBe(false);
      expect(cache.revalidating()).toBe(false);
    });

    it('data signal retains previous value after a failed re-fetch', () => {
      cache.ensureLoaded();
      fetchSubject.next('previous');
      fetchSubject.complete();
      nowMock.mockReturnValue(TTL);

      fetchSubject = new Subject<string>();
      fetcherMock.mockReturnValue(fetchSubject.asObservable());
      cache.ensureLoaded();
      fetchSubject.error(new Error('oops'));

      expect(cache.data()).toBe('previous');
    });

    it('in-flight is cleared after error so subsequent ensureLoaded retries the fetcher', () => {
      cache.ensureLoaded();
      fetchSubject.error(new Error('fail'));

      fetchSubject = new Subject<string>();
      fetcherMock.mockReturnValue(fetchSubject.asObservable());
      cache.ensureLoaded();

      expect(fetcherMock).toHaveBeenCalledTimes(2);
    });

    it('error is cleared on a successful subsequent fetch', () => {
      cache.ensureLoaded();
      fetchSubject.error(new Error('fail'));

      fetchSubject = new Subject<string>();
      fetcherMock.mockReturnValue(fetchSubject.asObservable());
      cache.ensureLoaded();
      fetchSubject.next('recovered');
      fetchSubject.complete();

      expect(cache.error()).toBeNull();
      expect(cache.data()).toBe('recovered');
    });
  });

  describe('reset()', () => {
    it('clears all signals and allows subsequent ensureLoaded to fetch fresh', () => {
      cache.ensureLoaded();
      fetchSubject.next('data');
      fetchSubject.complete();

      cache.reset();

      expect(cache.data()).toBeNull();
      expect(cache.loading()).toBe(false);
      expect(cache.revalidating()).toBe(false);
      expect(cache.error()).toBeNull();
    });

    it('after reset, ensureLoaded triggers a fresh loading fetch (not background)', () => {
      cache.ensureLoaded();
      fetchSubject.next('data');
      fetchSubject.complete();

      cache.reset();
      fetchSubject = new Subject<string>();
      fetcherMock.mockReturnValue(fetchSubject.asObservable());
      cache.ensureLoaded();

      expect(fetcherMock).toHaveBeenCalledTimes(2);
      expect(cache.loading()).toBe(true);
    });
  });

  describe('setData() — optimistic update', () => {
    it('updates the data signal immediately', () => {
      cache.setData('optimistic');

      expect(cache.data()).toBe('optimistic');
    });

    it('resets the TTL clock so ensureLoaded within TTL does not re-fetch', () => {
      nowMock.mockReturnValue(500);
      cache.setData('optimistic');
      nowMock.mockReturnValue(500 + TTL - 1);

      cache.ensureLoaded();

      expect(fetcherMock).not.toHaveBeenCalled();
    });

    it('after setData, ensureLoaded past TTL triggers background re-fetch', () => {
      nowMock.mockReturnValue(0);
      cache.setData('optimistic');
      nowMock.mockReturnValue(TTL);

      fetchSubject = new Subject<string>();
      fetcherMock.mockReturnValue(fetchSubject.asObservable());
      cache.ensureLoaded();

      expect(fetcherMock).toHaveBeenCalledTimes(1);
      expect(cache.revalidating()).toBe(true);
    });
  });

  describe('refresh() — forced re-fetch', () => {
    it('calls fetcher regardless of TTL when cache is fresh', () => {
      cache.ensureLoaded();
      fetchSubject.next('initial');
      fetchSubject.complete();
      nowMock.mockReturnValue(1); // still fresh

      fetchSubject = new Subject<string>();
      fetcherMock.mockReturnValue(fetchSubject.asObservable());
      cache.refresh().subscribe();

      expect(fetcherMock).toHaveBeenCalledTimes(2);
    });

    it('uses loading mode when cache is empty', () => {
      cache.refresh().subscribe();

      expect(cache.loading()).toBe(true);
      expect(cache.revalidating()).toBe(false);
    });

    it('uses revalidating mode when cache has existing data', () => {
      cache.ensureLoaded();
      fetchSubject.next('existing');
      fetchSubject.complete();

      fetchSubject = new Subject<string>();
      fetcherMock.mockReturnValue(fetchSubject.asObservable());
      cache.refresh().subscribe();

      expect(cache.revalidating()).toBe(true);
      expect(cache.loading()).toBe(false);
    });

    it('returned observable emits the fetched value', () => {
      const results: string[] = [];
      cache.refresh().subscribe(v => results.push(v));
      fetchSubject.next('fresh');
      fetchSubject.complete();

      expect(results).toEqual(['fresh']);
    });
  });

  describe('isStale()', () => {
    it('returns true when no fetch has been made and time has advanced past TTL', () => {
      nowMock.mockReturnValue(TTL);
      expect(cache.isStale()).toBe(true);
    });

    it('returns false immediately after a successful fetch', () => {
      cache.ensureLoaded();
      fetchSubject.next('data');
      fetchSubject.complete();

      expect(cache.isStale()).toBe(false);
    });

    it('returns true after TTL has elapsed', () => {
      cache.ensureLoaded();
      fetchSubject.next('data');
      fetchSubject.complete();
      nowMock.mockReturnValue(TTL);

      expect(cache.isStale()).toBe(true);
    });
  });

  describe('refreshInBackground()', () => {
    it('does not throw when the background fetch errors', () => {
      expect(() => {
        cache.refreshInBackground();
        fetchSubject.error(new Error('ignored'));
      }).not.toThrow();
    });

    it('uses revalidating mode (not loading) when cache has data', () => {
      cache.ensureLoaded();
      fetchSubject.next('existing');
      fetchSubject.complete();

      fetchSubject = new Subject<string>();
      fetcherMock.mockReturnValue(fetchSubject.asObservable());
      cache.refreshInBackground();

      expect(cache.revalidating()).toBe(true);
      expect(cache.loading()).toBe(false);
    });
  });
});
