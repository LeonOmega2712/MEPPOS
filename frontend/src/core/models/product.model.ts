export interface MenuProduct {
  id: number;
  name: string;
  description: string | null;
  price: number | null;
  image: string | null;
  displayOrder: number;
  customizable: boolean;
}
