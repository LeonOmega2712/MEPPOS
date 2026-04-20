import { prisma } from '../lib/prisma';
import { closeDisplayOrderGaps, reorderDisplayOrder } from '../lib/display-order';
import type { CreateLocationDTO, UpdateLocationDTO } from '../types/location.types';

export class LocationService {
  async getAllLocations() {
    return prisma.location.findMany({
      orderBy: { displayOrder: 'asc' },
    });
  }

  async getActiveLocations() {
    return prisma.location.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async getLocationById(id: number) {
    return prisma.location.findUnique({ where: { id } });
  }

  async createLocation(data: CreateLocationDTO) {
    const maxOrder = await prisma.location.aggregate({
      where: { active: true },
      _max: { displayOrder: true },
    });
    const nextOrder = (maxOrder._max.displayOrder ?? -1) + 1;

    return prisma.location.create({
      data: { name: data.name, type: data.type, displayOrder: nextOrder },
    });
  }

  async updateLocation(id: number, data: UpdateLocationDTO) {
    if (data.active === true) {
      const current = await prisma.location.findUnique({
        where: { id },
        select: { active: true, displayOrder: true },
      });

      if (current && !current.active) {
        return prisma.$transaction(async (tx) => {
          await tx.location.updateMany({
            where: {
              active: true,
              displayOrder: { gte: current.displayOrder },
            },
            data: { displayOrder: { increment: 1 } },
          });

          return tx.location.update({ where: { id }, data });
        });
      }
    }

    return prisma.location.update({ where: { id }, data });
  }

  async deactivateLocation(id: number) {
    return prisma.$transaction(async (tx) => {
      await tx.location.update({ where: { id }, data: { active: false } });
      await closeDisplayOrderGaps(tx, 'location');
    });
  }

  async deleteLocation(id: number) {
    return prisma.location.delete({ where: { id } });
  }

  async reorderLocations(locationIds: number[]): Promise<number> {
    return reorderDisplayOrder('location', locationIds);
  }
}

export const locationService = new LocationService();
