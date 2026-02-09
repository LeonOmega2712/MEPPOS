import { MenuProduct } from './product.model';

export interface MenuCategory {
  id: number;
  name: string;
  description: string | null;
  basePrice: number | null;
  image: string | null;
  displayOrder: number;
  products: MenuProduct[];
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  basePrice: number | null;
  image: string | null;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { products: number };
}

export interface CreateCategoryPayload {
  name: string;
  description?: string;
  basePrice?: number;
  image?: string;
  active?: boolean;
}

export interface UpdateCategoryPayload {
  name?: string;
  description?: string | null;
  basePrice?: number | null;
  image?: string | null;
  displayOrder?: number;
  active?: boolean;
}
