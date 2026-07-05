import { Request, Response } from 'express';
import { prisma } from '../prisma';
import bcrypt from 'bcrypt';

export const getCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    const companies = await prisma.company.findMany({
      include: {
        users: {
          where: { role: 'MANAGER' },
          select: { id: true, name: true, email: true, isActive: true }
        },
        _count: {
          select: { users: true, tickets: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const { companyName, managerName, managerEmail, managerPassword } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email: managerEmail } });
    if (existingUser) {
      res.status(400).json({ error: 'Manager email already in use' });
      return;
    }

    const hashedPassword = await bcrypt.hash(managerPassword, 10);
    
    // Set trial expiration 3 days from now
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 3);

    const company = await prisma.company.create({
      data: {
        name: companyName,
        planStatus: 'TRIAL',
        trialEndsAt,
        users: {
          create: {
            name: managerName,
            email: managerEmail,
            password: hashedPassword,
            role: 'MANAGER'
          }
        }
      },
      include: {
        users: true
      }
    });

    res.status(201).json(company);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create company' });
  }
};

export const updateCompanyStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { planStatus, planType } = req.body;

    const dataToUpdate: any = {};
    if (planStatus) dataToUpdate.planStatus = planStatus;
    if (planType) {
      dataToUpdate.planType = planType;
      
      // Calculate planEndsAt if they are activating
      if (planStatus === 'ACTIVE') {
        const planEndsAt = new Date();
        if (planType === 'MONTHLY') {
          planEndsAt.setDate(planEndsAt.getDate() + 30);
        } else if (planType === 'YEARLY') {
          planEndsAt.setDate(planEndsAt.getDate() + 365);
        }
        dataToUpdate.planEndsAt = planEndsAt;
      }
    }

    const company = await prisma.company.update({
      where: { id: id as string },
      data: dataToUpdate
    });

    res.json(company);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update company status' });
  }
};

export const getCompanyUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const users = await prisma.user.findMany({
      where: { companyId: id as string },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const deleteCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Soft delete the company
    const company = await prisma.company.update({
      where: { id: id as string },
      data: { isDeleted: true }
    });

    // Optionally, you can also mark all its users as inactive to prevent login
    await prisma.user.updateMany({
      where: { companyId: id as string },
      data: { isActive: false }
    });

    res.json({ success: true, company });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
};

export const getCompanySettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (user.role !== 'SUPER_ADMIN' && user.companyId !== id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const company = await prisma.company.findUnique({
      where: { id },
      select: {
        id: true, name: true, maxPadLimit: true, allowSalesChat: true, requireManagerApproval: true
      }
    });

    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    res.json(company);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCompanySettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const { name, maxPadLimit, allowSalesChat, requireManagerApproval } = req.body;

    if (user.role !== 'SUPER_ADMIN' && user.companyId !== id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    
    // Only SUPER_ADMIN can change the maxPadLimit
    if (user.role === 'SUPER_ADMIN' && maxPadLimit !== undefined) {
      updateData.maxPadLimit = Number(maxPadLimit);
    }
    
    if (allowSalesChat !== undefined) updateData.allowSalesChat = Boolean(allowSalesChat);
    if (requireManagerApproval !== undefined) updateData.requireManagerApproval = Boolean(requireManagerApproval);

    const updated = await prisma.company.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, maxPadLimit: true, allowSalesChat: true, requireManagerApproval: true }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
