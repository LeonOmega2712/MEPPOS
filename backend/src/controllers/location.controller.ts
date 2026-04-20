import { Request, Response } from 'express';
import { locationService } from '../services/location.service';
import {
  CreateLocationSchema,
  UpdateLocationSchema,
  LocationIdSchema,
  ReorderLocationsSchema,
} from '../types/location.types';
import { hasPrismaCode, isZodError } from '../lib/error';

export class LocationController {
  async getAllLocations(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.active === 'true';
      const locations = activeOnly
        ? await locationService.getActiveLocations()
        : await locationService.getAllLocations();
      res.json({ success: true, data: locations, count: locations.length });
    } catch (error) {
      console.error('Error getting locations:', error);
      res.status(500).json({ success: false, error: 'Failed to get locations' });
    }
  }

  async createLocation(req: Request, res: Response): Promise<void> {
    try {
      const data = CreateLocationSchema.parse(req.body);
      const location = await locationService.createLocation(data);
      res.status(201).json({ success: true, data: location, message: 'Location created successfully' });
    } catch (error) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      console.error('Error creating location:', error);
      res.status(500).json({ success: false, error: 'Failed to create location' });
    }
  }

  async updateLocation(req: Request, res: Response): Promise<void> {
    const idResult = LocationIdSchema.safeParse(req.params);
    if (!idResult.success) {
      res.status(400).json({ success: false, error: 'Invalid location ID' });
      return;
    }
    try {
      const data = UpdateLocationSchema.parse(req.body);
      const location = await locationService.updateLocation(idResult.data.id, data);
      res.json({ success: true, data: location, message: 'Location updated successfully' });
    } catch (error) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      if (hasPrismaCode(error, 'P2025')) {
        res.status(404).json({ success: false, error: 'Location not found' });
        return;
      }
      console.error('Error updating location:', error);
      res.status(500).json({ success: false, error: 'Failed to update location' });
    }
  }

  async deleteLocation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = LocationIdSchema.parse(req.params);
      const permanent = req.query.permanent === 'true';

      if (permanent) {
        await locationService.deleteLocation(id);
        res.json({ success: true, message: 'Location permanently deleted' });
      } else {
        await locationService.deactivateLocation(id);
        res.json({ success: true, message: 'Location deactivated successfully' });
      }
    } catch (error) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid location ID' });
        return;
      }
      if (hasPrismaCode(error, 'P2025')) {
        res.status(404).json({ success: false, error: 'Location not found' });
        return;
      }
      console.error('Error deleting location:', error);
      res.status(500).json({ success: false, error: 'Failed to delete location' });
    }
  }

  async reorderLocations(req: Request, res: Response): Promise<void> {
    try {
      const { locationIds } = ReorderLocationsSchema.parse(req.body);
      const updated = await locationService.reorderLocations(locationIds);
      res.json({ success: true, message: 'Locations reordered successfully', data: { updated } });
    } catch (error) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, error: 'Invalid request body' });
        return;
      }
      if (error instanceof Error && (error.message.includes('Invalid location IDs') || error.message.includes('Duplicate location IDs'))) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      console.error('Error reordering locations:', error);
      res.status(500).json({ success: false, error: 'Failed to reorder locations' });
    }
  }
}

export const locationController = new LocationController();
