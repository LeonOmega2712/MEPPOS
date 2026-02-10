export interface MenuProduct {
  id: number;
  name: string;
  description: string | null;
  price: number | null;
  image: string | null;
  displayOrder: number;
  customizable: boolean;
}

export interface Product {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  price: number | null;
  image: string | null;
  displayOrder: number;
  customizable: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  category: {
    id: number;
    name: string;
    basePrice: number | null;
  };
}

export interface CreateProductPayload {
  categoryId: number;
  name: string;
  description?: string;
  price?: number;
  image?: string;
  customizable?: boolean;
  active?: boolean;
}

export interface UpdateProductPayload {
  categoryId?: number;
  name?: string;
  description?: string | null;
  price?: number | null;
  image?: string | null;
  displayOrder?: number;
  customizable?: boolean;
  active?: boolean;
}

export interface ProductDraft {
  categoryId: number;
  name: string;
  description: string;
  price: number | null;
  image: string;
  customizable: boolean;
}
