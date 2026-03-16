import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { CreateUserDTO, UpdateUserDTO } from '../types/user.types';

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
};

export class UserService {
  async getAllUsers() {
    return prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { id: 'asc' },
    });
  }

  async getUserById(id: number) {
    return prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
  }

  async createUser(data: CreateUserDTO) {
    const hashedPassword = await bcrypt.hash(data.password, 12);

    return prisma.user.create({
      data: { ...data, password: hashedPassword },
      select: USER_SELECT,
    });
  }

  async updateUser(id: number, data: UpdateUserDTO) {
    const updateData: Record<string, unknown> = { ...data };

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12);
    }

    return prisma.user.update({
      where: { id },
      data: updateData,
      select: USER_SELECT,
    });
  }

  async deactivateUser(id: number) {
    return prisma.user.update({
      where: { id },
      data: { active: false },
      select: USER_SELECT,
    });
  }

  async deleteUser(id: number) {
    return prisma.user.delete({
      where: { id },
      select: USER_SELECT,
    });
  }
}

export const userService = new UserService();
