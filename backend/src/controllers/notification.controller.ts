import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';

export const getMyNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id as string;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id as string;
    const id = req.params.id as string;
    
    await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true }
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

export const requestPad = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id as string;
    const companyId = req.user?.companyId as string;
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const userName = user?.name || 'A Sales Agent';
    
    // Find a manager in the company to notify
    const manager = await prisma.user.findFirst({
      where: { companyId, role: 'MANAGER' }
    });

    if (manager) {
      await prisma.notification.create({
        data: {
          companyId,
          userId: manager.id, // Notify the manager
          title: 'Pad Request',
          message: `${userName} has requested a new Pad copy.`
        }
      });
    }

    res.json({ message: 'Request sent to manager' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send request' });
  }
};
