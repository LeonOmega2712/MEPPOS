export type LocationType = 'table' | 'bar';

export interface Location {
  id: number;
  name: string;
  type: LocationType;
  active: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string | null;
  /** True when a `table` location has an open order. Bars are never reported as occupied. */
  occupied?: boolean;
}

export interface CreateLocationPayload {
  name: string;
  type: LocationType;
}

export interface UpdateLocationPayload {
  name?: string;
  type?: LocationType;
  displayOrder?: number;
  active?: boolean;
}

export interface LocationDraft {
  name: string;
  type: LocationType;
}
