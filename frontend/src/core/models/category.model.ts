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
