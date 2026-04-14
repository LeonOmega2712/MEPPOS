import { Injectable, inject, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { SwrCache } from '../utils/swr-cache';
import type { ApiResponse, User, CreateUserPayload, UpdateUserPayload } from '../models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  private readonly cache = new SwrCache<User[]>({
    fetcher: () =>
      this.http
        .get<ApiResponse<User[]>>(this.baseUrl)
        .pipe(map((response) => response.data)),
  });

  readonly users: Signal<User[] | null> = this.cache.data;
  readonly usersLoading: Signal<boolean> = this.cache.loading;
  readonly usersRevalidating: Signal<boolean> = this.cache.revalidating;
  readonly usersError: Signal<unknown> = this.cache.error;

  ensureUsers(): void {
    this.cache.ensureLoaded();
  }

  refreshUsers(): void {
    this.cache.refreshInBackground();
  }

  invalidateUsers(): void {
    this.cache.reset();
  }

  createUser(data: CreateUserPayload): Observable<User> {
    return this.http
      .post<ApiResponse<User>>(this.baseUrl, data)
      .pipe(map((response) => response.data));
  }

  updateUser(id: number, data: UpdateUserPayload): Observable<User> {
    return this.http
      .put<ApiResponse<User>>(`${this.baseUrl}/${id}`, data)
      .pipe(map((response) => response.data));
  }

  deleteUser(id: number, permanent = false): Observable<void> {
    const url = permanent
      ? `${this.baseUrl}/${id}?permanent=true`
      : `${this.baseUrl}/${id}`;
    return this.http
      .delete<ApiResponse<void>>(url)
      .pipe(map(() => undefined));
  }
}
