import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import type { ApiResponse, Category, CreateCategoryPayload, UpdateCategoryPayload } from '../models';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/categories`;

  getCategories(): Observable<Category[]> {
    return this.http
      .get<ApiResponse<Category[]>>(this.baseUrl)
      .pipe(map((response) => response.data));
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
}
