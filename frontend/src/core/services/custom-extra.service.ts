import { Injectable, inject, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { SwrCache } from '../utils/swr-cache';
import type { ApiResponse, CustomExtra, CreateCustomExtraPayload, UpdateCustomExtraPayload } from '../models';

@Injectable({ providedIn: 'root' })
export class CustomExtraService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/extras`;

  private readonly cache = new SwrCache<CustomExtra[]>({
    fetcher: () =>
      this.http
        .get<ApiResponse<CustomExtra[]>>(this.baseUrl)
        .pipe(map((r) => r.data)),
  });

  readonly extras: Signal<CustomExtra[] | null> = this.cache.data;
  readonly extrasLoading: Signal<boolean> = this.cache.loading;
  readonly extrasRevalidating: Signal<boolean> = this.cache.revalidating;
  readonly extrasError: Signal<unknown> = this.cache.error;

  ensureExtras(): void {
    this.cache.ensureLoaded();
  }

  refreshExtras(): void {
    this.cache.refreshInBackground();
  }

  createExtra(data: CreateCustomExtraPayload): Observable<CustomExtra> {
    return this.http
      .post<ApiResponse<CustomExtra>>(this.baseUrl, data)
      .pipe(map((r) => r.data));
  }

  updateExtra(id: number, data: UpdateCustomExtraPayload): Observable<CustomExtra> {
    return this.http
      .put<ApiResponse<CustomExtra>>(`${this.baseUrl}/${id}`, data)
      .pipe(map((r) => r.data));
  }

  deleteExtra(id: number, permanent = false): Observable<void> {
    const url = permanent
      ? `${this.baseUrl}/${id}?permanent=true`
      : `${this.baseUrl}/${id}`;
    return this.http.delete<ApiResponse<void>>(url).pipe(map(() => undefined));
  }
}
