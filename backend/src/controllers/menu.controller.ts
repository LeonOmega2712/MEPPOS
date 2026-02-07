import { Request, Response } from 'express';
import { menuService } from '../services/menu.service';

export class MenuController {
  async getFullMenu(_req: Request, res: Response) {
    try {
      const menu = await menuService.getFullMenu();

      res.json({
        success: true,
        data: menu,
        count: menu.length
      });
    } catch (error) {
      console.error('Error getting menu:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get menu'
      });
    }
  }
}

export const menuController = new MenuController();
