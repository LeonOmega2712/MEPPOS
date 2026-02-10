import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
  ApiResponse,
  Product,
  CreateProductPayload,
  UpdateProductPayload
} from '../models';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/products`;

  getProducts(): Observable<Product[]> {
    return this.http
      .get<ApiResponse<Product[]>>(this.baseUrl)
      .pipe(map((response) => response.data));
  }

  createProduct(data: CreateProductPayload): Observable<Product> {
    return this.http
      .post<ApiResponse<Product>>(this.baseUrl, data)
      .pipe(map((response) => response.data));
  }

  updateProduct(id: number, data: UpdateProductPayload): Observable<Product> {
    return this.http
      .put<ApiResponse<Product>>(`${this.baseUrl}/${id}`, data)
      .pipe(map((response) => response.data));
  }

  deleteProduct(id: number, permanent = false): Observable<void> {
    const url = permanent
      ? `${this.baseUrl}/${id}?permanent=true`
      : `${this.baseUrl}/${id}`;
    return this.http
      .delete<ApiResponse<void>>(url)
      .pipe(map(() => undefined));
  }

  reorderProducts(categoryId: number, productIds: number[]): Observable<void> {
    return this.http
      .patch<ApiResponse<{ updated: number }>>(`${this.baseUrl}/reorder`, {
        categoryId,
        productIds
      })
      .pipe(map(() => undefined));
  }
}
