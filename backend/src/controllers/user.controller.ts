import { Request, Response } from 'express';
import { prisma } from '../prisma';
import bcrypt from 'bcrypt';
import { AuthRequest } from '../middleware/auth.middleware';

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, role: true, isActive: true, createdAt: true, companyId: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.user.update({
      where: { id: id as string },
      data: { isActive: false }
    });
    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
};

export const getMyTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, companyId } = req.user!;
    if (role === 'SUPER_ADMIN' && (!companyId || companyId === 'null')) {
      const allTeam = await prisma.user.findMany({
        where: { role: { in: ['SALES', 'FULFILLMENT', 'MANAGER'] } },
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, profilePictureUrl: true, paymentAccountType: true, paymentAccountNumber: true, companyId: true },
        orderBy: { createdAt: 'desc' }
      });
      res.json(allTeam);
      return;
    }
    if (!companyId || companyId === 'null') {
      res.status(400).json({ error: 'Manager has no company' });
      return;
    }
    const team = await prisma.user.findMany({
      where: { companyId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, profilePictureUrl: true, paymentAccountType: true, paymentAccountNumber: true, companyId: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(team);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch team' });
  }
};

export const createTeamMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(400).json({ error: 'Manager has no company' });
      return;
    }

    const { name, email, password, role } = req.body;
    
    // Managers can only create SALES or FULFILLMENT
    if (role !== 'SALES' && role !== 'FULFILLMENT') {
      res.status(403).json({ error: 'Managers can only create SALES or FULFILLMENT agents' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Email already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        companyId
      }
    });

    res.status(201).json({ message: 'Team member created', userId: user.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create team member' });
  }
};

export const toggleTeamMemberStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;
    const { isActive } = req.body;

    if (!companyId) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id: id as string, companyId }
    });

    if (!user) {
      res.status(404).json({ error: 'Team member not found in your agency' });
      return;
    }

    // Prevent manager from disabling themselves
    if (user.id === req.user?.id) {
      res.status(400).json({ error: 'Cannot modify your own status' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isActive }
    });

    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
};

export const deleteTeamMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;

    if (!companyId) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id: id as string, companyId }
    });

    if (!user) {
      res.status(404).json({ error: 'Team member not found in your agency' });
      return;
    }

    if (user.id === req.user?.id) {
      res.status(400).json({ error: 'Cannot delete yourself' });
      return;
    }

    await prisma.user.delete({
      where: { id: user.id }
    });

    res.json({ success: true, message: 'Team member deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete team member. Ensure they have no active linked records.' });
  }
};

export const changeTeamMemberPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.user?.id;
    const requesterRole = req.user?.role;
    const requesterCompanyId = req.user?.companyId;
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    // Super Admin can change any user's password
    // Manager can only change passwords of users in their own company
    let targetUser;
    if (requesterRole === 'SUPER_ADMIN') {
      targetUser = await prisma.user.findUnique({ where: { id: id as string } });
    } else if (requesterRole === 'MANAGER' && requesterCompanyId) {
      targetUser = await prisma.user.findFirst({
        where: { id: id as string, companyId: requesterCompanyId }
      });
      // Manager cannot change another manager's or admin's password
      if (targetUser && (targetUser.role === 'MANAGER' || targetUser.role === 'SUPER_ADMIN') && targetUser.id !== requesterId) {
        res.status(403).json({ error: 'Managers can only change passwords for their Sales and Fulfillment agents' });
        return;
      }
    } else {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: targetUser.id },
      data: { password: hashedPassword }
    });

    res.json({ success: true, message: `Password updated for ${targetUser.name}` });
  } catch (error) {
    console.error('changeTeamMemberPassword error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

