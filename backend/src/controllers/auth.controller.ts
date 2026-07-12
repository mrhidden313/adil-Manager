import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { company: true }
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid credentials or inactive account' });
      return;
    }

    if (user.company?.isDeleted) {
      res.status(401).json({ error: 'Your agency workspace has been deactivated' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, companyId: user.companyId },
      JWT_SECRET,
      { expiresIn: '100y' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        allowSalesChat: user.company?.allowSalesChat,
        profilePictureUrl: user.profilePictureUrl
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;

    if (role === 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Cannot register as SUPER_ADMIN' });
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
        role: role || 'SALES', // Default role for safety, though it should be validated
      }
    });

    res.status(201).json({ message: 'User created successfully', userId: user.id });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true, profilePictureUrl: true, paymentAccountType: true, paymentAccountNumber: true, companyId: true, company: { select: { maxPadLimit: true, allowSalesChat: true, requireManagerApproval: true } } }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error: any) {
    console.error('getMe error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, password, paymentAccountType, paymentAccountNumber } = req.body;
    const file = req.file;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (paymentAccountType !== undefined) updateData.paymentAccountType = paymentAccountType;
    if (paymentAccountNumber !== undefined) updateData.paymentAccountNumber = paymentAccountNumber;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    if (file) {
      const fileExt = file.originalname.split('.').pop();
      const fileName = `profile_${userId}_${uuidv4()}.${fileExt}`;
      
      const { error: uploadError } = await supabase
        .storage
        .from('proofs') // using same bucket for simplicity
        .upload(fileName, file.buffer, {
          contentType: file.mimetype
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        res.status(500).json({ error: 'Failed to upload profile picture' });
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from('proofs').getPublicUrl(fileName);
      updateData.profilePictureUrl = publicUrl;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'No data provided to update' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, profilePictureUrl: true, paymentAccountType: true, paymentAccountNumber: true }
    });

    res.json({ message: 'Profile updated', user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const impersonate = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only SUPER_ADMIN can impersonate' });
      return;
    }

    const { companyId } = req.body;
    
    let tokenPayload = { id: user.id, role: user.role, companyId: null };

    if (companyId) {
      // Impersonate a company
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }
      tokenPayload.companyId = companyId as any;
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development';
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '100y' });

    res.json({ token, message: companyId ? 'Impersonating company' : 'Returned to admin mode' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
