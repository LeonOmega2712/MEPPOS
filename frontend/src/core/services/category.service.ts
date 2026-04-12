import { Injectable, inject, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { SwrCache } from '../utils/swr-cache';
import type { ApiResponse, Category, CreateCategoryPayload, UpdateCategoryPayload } from '../models';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/categories`;

  private readonly cache = new SwrCache<Category[]>({
    fetcher: () =>
      this.http
        .get<ApiResponse<Category[]>>(this.baseUrl)
        .pipe(map((response) => response.data)),
  });

  readonly categories: Signal<Category[] | null> = this.cache.data;
  readonly categoriesLoading: Signal<boolean> = this.cache.loading;
  readonly categoriesRevalidating: Signal<boolean> = this.cache.revalidating;
  readonly categoriesError: Signal<unknown> = this.cache.error;

  ensureCategories(): void {
    this.cache.ensureLoaded();
  }

  refreshCategories(): void {
    this.cache.refreshInBackground();
  }

  invalidateCategories(): void {
    this.cache.reset();
  }

  setCategoriesData(data: Category[]): void {
    this.cache.setData(data);
  }

  createCategory(data: CreateCategoryPayload): Observable<Category> {
    return this.http
      .post<ApiResponse<Category>>(this.baseUrl, data)
      .pipe(map((response) => response.data));
  }

  updateCategory(id: number, data: UpdateCategoryPayload): Observable<Category> {
    return this.http
      .put<ApiResponse<Category>>(`${this.baseUrl}/${id}`, data)
      .pipe(map((response) => response.data));
  }

  deleteCategory(id: number, permanent = false): Observable<void> {
    const url = permanent
      ? `${this.baseUrl}/${id}?permanent=true`
      : `${this.baseUrl}/${id}`;
    return this.http
      .delete<ApiResponse<void>>(url)
      .pipe(map(() => undefined));
  }

  reorderCategories(categoryIds: number[]): Observable<void> {
    return this.http
      .patch<ApiResponse<{ updated: number }>>(`${this.baseUrl}/reorder`, {
        categoryIds
      })
      .pipe(map(() => undefined));
  }
}
