export interface CustomExtra {
  id: number;
  name: string;
  defaultPrice: number;
  active: boolean;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateCustomExtraPayload {
  name: string;
  defaultPrice: number;
}

export interface UpdateCustomExtraPayload {
  name?: string;
  defaultPrice?: number;
  active?: boolean;
}

export interface CustomExtraDraft {
  name: string;
  defaultPrice: string;
}
