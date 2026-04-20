import { Injectable, inject, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { SwrCache } from '../utils/swr-cache';
import type {
  ApiResponse,
  Location,
  CreateLocationPayload,
  UpdateLocationPayload,
} from '../models';

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly http = inject(HttpClient);
  private readonly locationsUrl = `${environment.apiUrl}/locations`;

  private readonly locationsCache = new SwrCache<Location[]>({
    fetcher: () =>
      this.http
        .get<ApiResponse<Location[]>>(this.locationsUrl)
        .pipe(map((r) => r.data)),
  });

  readonly locations: Signal<Location[] | null> = this.locationsCache.data;
  readonly locationsLoading: Signal<boolean> = this.locationsCache.loading;
  readonly locationsRevalidating: Signal<boolean> = this.locationsCache.revalidating;
  readonly locationsError: Signal<unknown> = this.locationsCache.error;

  ensureLocations(): void {
    this.locationsCache.ensureLoaded();
  }

  refreshLocations(): void {
    this.locationsCache.refreshInBackground();
  }

  setLocationsData(data: Location[]): void {
    this.locationsCache.setData(data);
  }

  createLocation(data: CreateLocationPayload): Observable<Location> {
    return this.http
      .post<ApiResponse<Location>>(this.locationsUrl, data)
      .pipe(map((r) => r.data));
  }

  updateLocation(id: number, data: UpdateLocationPayload): Observable<Location> {
    return this.http
      .put<ApiResponse<Location>>(`${this.locationsUrl}/${id}`, data)
      .pipe(map((r) => r.data));
  }

  deleteLocation(id: number, permanent = false): Observable<void> {
    const url = permanent
      ? `${this.locationsUrl}/${id}?permanent=true`
      : `${this.locationsUrl}/${id}`;
    return this.http.delete<ApiResponse<void>>(url).pipe(map(() => undefined));
  }

  reorderLocations(locationIds: number[]): Observable<void> {
    return this.http
      .patch<ApiResponse<void>>(`${this.locationsUrl}/reorder`, { locationIds })
      .pipe(map(() => undefined));
  }
}
