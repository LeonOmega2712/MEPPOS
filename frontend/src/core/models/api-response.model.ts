import type { Category } from './category.model';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
  message?: string;
  error?: string;
}

export interface ProductsApiResponse<T> extends ApiResponse<T> {
  categories: Category[];
}
