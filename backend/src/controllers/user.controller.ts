import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserIdSchema,
} from '../types/user.types';
import { hasPrismaCode, isZodError } from '../lib/error';

export class UserController {
  async getAllUsers(_req: Request, res: Response) {
    try {
      const users = await userService.getAllUsers();
      res.json({ success: true, data: users, count: users.length });
    } catch (error) {
      console.error('Error getting users:', error);
      res.status(500).json({ success: false, error: 'Failed to get users' });
    }
  }

  async getUserById(req: Request, res: Response) {
    try {
      const { id } = UserIdSchema.parse(req.params);
      const user = await userService.getUserById(id);

      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      res.json({ success: true, data: user });
    } catch (error: unknown) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid user ID' });
        return;
      }
      console.error('Error getting user:', error);
      res.status(500).json({ success: false, error: 'Failed to get user' });
    }
  }

  async createUser(req: Request, res: Response) {
    try {
      const data = CreateUserSchema.parse(req.body);
      const user = await userService.createUser(data);
      res.status(201).json({ success: true, data: user });
    } catch (error: unknown) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      if (hasPrismaCode(error, 'P2002')) {
        res.status(409).json({ success: false, error: 'Username already exists' });
        return;
      }
      console.error('Error creating user:', error);
      res.status(500).json({ success: false, error: 'Failed to create user' });
    }
  }

  async updateUser(req: Request, res: Response) {
    try {
      const { id } = UserIdSchema.parse(req.params);
      const data = UpdateUserSchema.parse(req.body);
      const user = await userService.updateUser(id, data);
      res.json({ success: true, data: user });
    } catch (error: unknown) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      if (hasPrismaCode(error, 'P2025')) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }
      if (hasPrismaCode(error, 'P2002')) {
        res.status(409).json({ success: false, error: 'Username already exists' });
        return;
      }
      console.error('Error updating user:', error);
      res.status(500).json({ success: false, error: 'Failed to update user' });
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const { id } = UserIdSchema.parse(req.params);
      const permanent = req.query.permanent === 'true';

      if (permanent) {
        const user = await userService.deleteUser(id);
        res.json({ success: true, data: user, message: 'User permanently deleted' });
      } else {
        const user = await userService.deactivateUser(id);
        res.json({ success: true, data: user, message: 'User deactivated' });
      }
    } catch (error: unknown) {
      if (hasPrismaCode(error, 'P2025')) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }
      console.error('Error deleting user:', error);
      res.status(500).json({ success: false, error: 'Failed to delete user' });
    }
  }
}

export const userController = new UserController();
