import { Signal, signal } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';

export interface SwrCacheOptions<T> {
  fetcher: () => Observable<T>;
  ttlMs?: number;
  now?: () => number;
}

const DEFAULT_TTL_MS = 60_000;

export class SwrCache<T> {
  private readonly _data = signal<T | null>(null);
  private readonly _loading = signal(false);
  private readonly _revalidating = signal(false);
  private readonly _error = signal<unknown>(null);

  readonly data: Signal<T | null> = this._data.asReadonly();
  readonly loading: Signal<boolean> = this._loading.asReadonly();
  readonly revalidating: Signal<boolean> = this._revalidating.asReadonly();
  readonly error: Signal<unknown> = this._error.asReadonly();

  private lastFetch = 0;
  private inFlight: Observable<T> | null = null;

  private readonly fetcher: () => Observable<T>;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options: SwrCacheOptions<T>) {
    this.fetcher = options.fetcher;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.now = options.now ?? (() => Date.now());
  }

  ensureLoaded(): void {
    if (this._data() === null) {
      this.runFetchAndForget(false);
      return;
    }
    if (this.isStale()) {
      this.runFetchAndForget(true);
    }
  }

  refresh(): Observable<T> {
    return this.runFetch(this._data() !== null);
  }

  refreshInBackground(): void {
    this.runFetchAndForget(this._data() !== null);
  }

  reset(): void {
    this._data.set(null);
    this._loading.set(false);
    this._revalidating.set(false);
    this._error.set(null);
    this.lastFetch = 0;
    this.inFlight = null;
  }

  setData(data: T): void {
    this._data.set(data);
    this.lastFetch = this.now();
  }

  isStale(): boolean {
    return this.now() - this.lastFetch >= this.ttlMs;
  }

  private runFetchAndForget(background: boolean): void {
    this.runFetch(background).subscribe({ error: () => {} });
  }

  private runFetch(background: boolean): Observable<T> {
    if (this.inFlight) return this.inFlight;

    if (background) {
      this._revalidating.set(true);
    } else {
      this._loading.set(true);
    }
    this._error.set(null);

    const subject = new ReplaySubject<T>(1);
    const observable = subject.asObservable();
    this.inFlight = observable;

    this.fetcher().subscribe({
      next: (value) => {
        this._data.set(value);
        this.lastFetch = this.now();
        this._error.set(null);
        this._loading.set(false);
        this._revalidating.set(false);
        subject.next(value);
        subject.complete();
        this.inFlight = null;
      },
      error: (err) => {
        this._error.set(err);
        this._loading.set(false);
        this._revalidating.set(false);
        subject.error(err);
        this.inFlight = null;
      },
    });

    return observable;
  }
}
