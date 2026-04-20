import { Request, Response } from 'express';
import { customExtraService } from '../services/custom-extra.service';
import { CreateCustomExtraSchema, UpdateCustomExtraSchema, CustomExtraIdSchema } from '../types/custom-extra.types';
import { hasPrismaCode, isZodError } from '../lib/error';

export class CustomExtraController {
  async getAllExtras(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.active === 'true';
      const extras = activeOnly
        ? await customExtraService.getActiveExtras()
        : await customExtraService.getAllExtras();
      res.json({ success: true, data: extras, count: extras.length });
    } catch (error) {
      console.error('Error getting extras:', error);
      res.status(500).json({ success: false, error: 'Failed to get extras' });
    }
  }

  async createExtra(req: Request, res: Response): Promise<void> {
    try {
      const data = CreateCustomExtraSchema.parse(req.body);
      const extra = await customExtraService.createExtra(data, req.user!.userId);
      res.status(201).json({ success: true, data: extra, message: 'Extra created successfully' });
    } catch (error) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      if (hasPrismaCode(error, 'P2002')) {
        res.status(409).json({ success: false, error: 'An extra with that name already exists' });
        return;
      }
      console.error('Error creating extra:', error);
      res.status(500).json({ success: false, error: 'Failed to create extra' });
    }
  }

  async updateExtra(req: Request, res: Response): Promise<void> {
    const idResult = CustomExtraIdSchema.safeParse(req.params);
    if (!idResult.success) {
      res.status(400).json({ success: false, error: 'Invalid extra ID' });
      return;
    }
    try {
      const data = UpdateCustomExtraSchema.parse(req.body);
      const extra = await customExtraService.updateExtra(idResult.data.id, data);
      res.json({ success: true, data: extra, message: 'Extra updated successfully' });
    } catch (error) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      if (hasPrismaCode(error, 'P2025')) {
        res.status(404).json({ success: false, error: 'Extra not found' });
        return;
      }
      if (hasPrismaCode(error, 'P2002')) {
        res.status(409).json({ success: false, error: 'An extra with that name already exists' });
        return;
      }
      console.error('Error updating extra:', error);
      res.status(500).json({ success: false, error: 'Failed to update extra' });
    }
  }

  async deleteExtra(req: Request, res: Response): Promise<void> {
    try {
      const { id } = CustomExtraIdSchema.parse(req.params);
      const permanent = req.query.permanent === 'true';

      if (permanent) {
        await customExtraService.deleteExtra(id);
        res.json({ success: true, message: 'Extra permanently deleted' });
      } else {
        await customExtraService.deactivateExtra(id);
        res.json({ success: true, message: 'Extra deactivated successfully' });
      }
    } catch (error) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid extra ID' });
        return;
      }
      if (hasPrismaCode(error, 'P2025')) {
        res.status(404).json({ success: false, error: 'Extra not found' });
        return;
      }
      console.error('Error deleting extra:', error);
      res.status(500).json({ success: false, error: 'Failed to delete extra' });
    }
  }
}

export const customExtraController = new CustomExtraController();
