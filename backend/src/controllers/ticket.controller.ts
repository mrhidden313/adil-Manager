import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const createTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { transactionId, genericData, price } = req.body;
    const userId = req.user?.id;
    const companyId = req.user?.companyId;
    const file = req.file;

    if (!userId || !companyId) {
      res.status(401).json({ error: 'Unauthorized or missing company' });
      return;
    }

    if (!file) {
      res.status(400).json({ error: 'Payment proof image is required' });
      return;
    }
    
    // Check for duplicate transactionId
    const existingTicket = await prisma.ticket.findUnique({ where: { transactionId } });
    if (existingTicket) {
      res.status(400).json({ error: 'Duplicate Transaction ID' });
      return;
    }

    const ticketPrice = parseFloat(price) || 0;
    const bonusAmount = ticketPrice * 0.10; // 10% commission

    // Upload to Supabase
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    
    const { error: uploadError } = await supabase
      .storage
      .from('proofs')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      res.status(500).json({ error: 'Failed to upload image' });
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('proofs').getPublicUrl(fileName);
    const paymentProofUrl = publicUrl;

    let parsedGenericData: any = {};
    if (genericData) {
      if (typeof genericData === 'string') {
        try {
          parsedGenericData = JSON.parse(genericData);
        } catch (e) {
          console.error("Failed to parse genericData JSON");
        }
      } else {
        parsedGenericData = genericData;
      }
    }

    const ticket = await prisma.ticket.create({
      data: {
        createdById: userId,
        companyId,
        transactionId,
        paymentProofUrl,
        genericData: parsedGenericData,
        status: 'PENDING',
        price: ticketPrice,
        bonusAmount: bonusAmount,
        bonusStatus: 'PENDING'
      }
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        ticketId: ticket.id,
        userId: userId,
        companyId,
        action: 'CREATED',
        newStatus: 'PENDING'
      }
    });

    res.status(201).json({ message: 'Ticket created', ticket });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listTickets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, id: userId, companyId } = req.user!;
    let tickets;

    const companyIdStr = companyId as string;

    const includeData = { 
      createdBy: { select: { name: true, role: true, email: true } }
    };

    if (role === 'SUPER_ADMIN') {
      tickets = await prisma.ticket.findMany({ include: includeData });
    } else if (role === 'MANAGER') {
      tickets = await prisma.ticket.findMany({ where: { companyId: companyIdStr }, include: includeData });
    } else if (role === 'SALES') {
      tickets = await prisma.ticket.findMany({ where: { createdById: userId, companyId: companyIdStr }, include: includeData });
    } else if (role === 'FULFILLMENT') {
      tickets = await prisma.ticket.findMany({ where: { assignedToId: userId, companyId: companyIdStr }, include: includeData });
    }

    res.json(tickets);
  } catch (error) {
    console.error('List tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTicketStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { status, assignedToId, fulfillmentProofUrl } = req.body;
    const userId = req.user!.id;
    const role = req.user!.role;

    const existingTicket = await prisma.ticket.findUnique({ where: { id } });
    if (!existingTicket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Basic permission checking
    if (role === 'SALES') {
      res.status(403).json({ error: 'Sales cannot update status directly' });
      return;
    }

    const updateData: any = { status };
    
    if (role === 'MANAGER' || role === 'SUPER_ADMIN') {
      if (assignedToId !== undefined) {
        updateData.assignedToId = assignedToId || null;
      }
      if (status === 'PENDING') {
        updateData.assignedToId = null;
      } else if (updateData.assignedToId) {
        updateData.approvedById = userId;
      }
    }

    if (role === 'FULFILLMENT') {
      let uploadedUrl = fulfillmentProofUrl;
      const file = req.file;
      
      if (file) {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `fulfillment_${uuidv4()}.${fileExt}`;
        
        const { error: uploadError } = await supabase
          .storage
          .from('proofs')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype
          });

        if (uploadError) {
          console.error('Supabase upload error:', uploadError);
          res.status(500).json({ error: 'Failed to upload video proof' });
          return;
        }

        const { data: { publicUrl } } = supabase.storage.from('proofs').getPublicUrl(fileName);
        uploadedUrl = publicUrl;
      }

      if (uploadedUrl) {
        updateData.fulfillmentProofUrl = uploadedUrl;
      }
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: updateData
    });

    await prisma.auditLog.create({
      data: {
        ticketId: updatedTicket.id,
        userId: userId,
        companyId: updatedTicket.companyId,
        action: 'STATUS_UPDATED',
        previousStatus: existingTicket.status,
        newStatus: updatedTicket.status
      }
    });

    res.json({ message: 'Ticket updated', ticket: updatedTicket });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
