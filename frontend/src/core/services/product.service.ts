import { Injectable, inject, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { SwrCache } from '../utils/swr-cache';
import type {
  ProductsApiResponse,
  ApiResponse,
  Product,
  Category,
  CreateProductPayload,
  UpdateProductPayload
} from '../models';

export interface ProductsWithCategories {
  products: Product[];
  categories: Category[];
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/products`;

  private readonly cache = new SwrCache<ProductsWithCategories>({
    fetcher: () =>
      this.http
        .get<ProductsApiResponse<Product[]>>(this.baseUrl)
        .pipe(map((response) => ({
          products: response.data,
          categories: response.categories,
        }))),
  });

  readonly productsData: Signal<ProductsWithCategories | null> = this.cache.data;
  readonly productsLoading: Signal<boolean> = this.cache.loading;
  readonly productsRevalidating: Signal<boolean> = this.cache.revalidating;
  readonly productsError: Signal<unknown> = this.cache.error;

  ensureProducts(): void {
    this.cache.ensureLoaded();
  }

  refreshProducts(): void {
    this.cache.refreshInBackground();
  }

  invalidateProducts(): void {
    this.cache.reset();
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
