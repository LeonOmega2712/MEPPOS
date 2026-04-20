import { prisma } from '../lib/prisma';
import type { CreateCustomExtraDTO, UpdateCustomExtraDTO } from '../types/custom-extra.types';

export class CustomExtraService {
  async getAllExtras() {
    return prisma.customExtra.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getActiveExtras() {
    return prisma.customExtra.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async getExtraById(id: number) {
    return prisma.customExtra.findUnique({ where: { id } });
  }

  async createExtra(data: CreateCustomExtraDTO, createdBy: number) {
    return prisma.customExtra.create({
      data: {
        name: data.name,
        defaultPrice: data.defaultPrice,
        createdBy,
      },
    });
  }

  async updateExtra(id: number, data: UpdateCustomExtraDTO) {
    return prisma.customExtra.update({ where: { id }, data });
  }

  async deactivateExtra(id: number) {
    return prisma.customExtra.update({ where: { id }, data: { active: false } });
  }

  async deleteExtra(id: number) {
    return prisma.customExtra.delete({ where: { id } });
  }
}

export const customExtraService = new CustomExtraService();
