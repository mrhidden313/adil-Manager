import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { io } from '../socket';
import { sendPushToUser } from './push.controller';

export const createTicket = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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
      io.to(`company_${companyId}`).emit('global_log_broadcast', {
        type: 'ERROR',
        userName: req.user?.name || 'Sales Agent',
        userRole: req.user?.role || 'SALES',
        message: `Upload Failed: TXN #${transactionId} (Supabase Error)`,
        details: uploadError?.message || 'Storage error while uploading proof'
      });
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

    io.to(`company_${companyId}`).emit('global_log_broadcast', {
      type: 'SUCCESS',
      userName: req.user?.name || 'Sales Agent',
      userRole: req.user?.role || 'SALES',
      message: `New Order Submitted: TXN #${transactionId} (${ticketPrice} PKR)`,
      details: `Proof uploaded successfully. Order #${ticket.id.substring(0, 8)} created.`
    });

    // Notify all Managers of this company via Web Push
    prisma.user.findMany({
      where: { companyId, role: { in: ['MANAGER', 'SUPER_ADMIN'] } },
      select: { id: true }
    }).then(managers => {
      managers.forEach(mgr => {
        sendPushToUser(mgr.id, {
          title: '🚀 New Order Submitted!',
          body: `Order #${transactionId} (${ticketPrice} PKR) submitted by ${req.user?.name || 'Sales Agent'}`,
          url: '/manager'
        });
      });
    }).catch(err => console.error('Error sending push to managers:', err));

    res.status(201).json({ message: 'Ticket created', ticket });
  } catch (error) {
    next(error);
  }
};


export const getTicketStats = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { role, id: userId, companyId } = req.user!;
    const companyIdStr = companyId as string;

    const selectData = {
      id: true,
      status: true,
      price: true,
      bonusAmount: true,
      genericData: true,
      createdById: true,
      assignedToId: true,
      transactionId: true,
      createdAt: true
    };

    let tickets;
    if (role === 'SUPER_ADMIN') {
      tickets = await prisma.ticket.findMany({ select: selectData });
    } else if (role === 'MANAGER') {
      tickets = await prisma.ticket.findMany({ where: { companyId: companyIdStr }, select: selectData });
    } else if (role === 'SALES') {
      tickets = await prisma.ticket.findMany({ where: { createdById: userId, companyId: companyIdStr }, select: selectData });
    } else if (role === 'FULFILLMENT') {
      tickets = await prisma.ticket.findMany({ where: { assignedToId: userId, companyId: companyIdStr }, select: selectData });
    }

    res.json(tickets);
  } catch (error) {
    next(error);
  }
};

export const listTickets = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { role, id: userId, companyId } = req.user!;
    const companyIdStr = companyId as string;
    
    // Pagination & Filtering
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 0; // 0 means no pagination (backward compatibility)
    const search = req.query.search as string || '';
    const sortBy = req.query.sortBy as string || 'date';
    const sortOrder = (req.query.sortOrder as string || 'desc').toLowerCase();
    const statusFilter = req.query.status as any;
    const userFilterId = req.query.userId as string;

    const includeData: any = { 
      createdBy: { select: { name: true, role: true, email: true } },
      assignedTo: { select: { name: true, role: true, email: true } },
      auditLogs: {
        orderBy: { timestamp: 'asc' },
        select: {
          action: true,
          previousStatus: true,
          newStatus: true,
          timestamp: true,
          user: { select: { name: true, role: true } }
        }
      }
    };

    let whereClause: any = {};
    if (role !== 'SUPER_ADMIN') {
      whereClause.companyId = companyIdStr;
    }
    if (role === 'SALES') {
      whereClause.createdById = userId;
    }
    if (role === 'FULFILLMENT') {
      whereClause.assignedToId = userId;
    }

    if (statusFilter && statusFilter !== 'ALL') {
      whereClause.status = statusFilter;
    }
    
    if (userFilterId) {
      whereClause.OR = [
        ...(whereClause.OR || []),
        { createdById: userFilterId },
        { assignedToId: userFilterId }
      ];
    }

    if (search) {
      const searchNumber = parseFloat(search);
      whereClause.OR = [
        ...(whereClause.OR || []),
        { transactionId: { contains: search, mode: 'insensitive' } },
        {
          genericData: {
            path: ['name'],
            string_contains: search
          }
        },
        {
          genericData: {
            path: ['ticketNumber'],
            string_contains: search
          }
        }
      ];
    }

    let orderBy: any = {};
    if (sortBy === 'price') {
      orderBy = { price: sortOrder === 'asc' ? 'asc' : 'desc' };
    } else {
      orderBy = { createdAt: sortOrder === 'asc' ? 'asc' : 'desc' };
    }

    if (limit > 0) {
      const skip = (page - 1) * limit;
      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          where: whereClause,
          include: includeData,
          orderBy,
          skip,
          take: limit
        }),
        prisma.ticket.count({ where: whereClause })
      ]);
      res.json({ data: tickets, metadata: { total, page, limit, hasMore: skip + tickets.length < total } });
    } else {
      const tickets = await prisma.ticket.findMany({
        where: whereClause,
        include: includeData,
        orderBy
      });
      res.json(tickets);
    }
  } catch (error) {
    next(error);
  }
};

export const updateTicketStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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
          io.to(`company_${existingTicket.companyId}`).emit('global_log_broadcast', {
            type: 'ERROR',
            userName: req.user?.name || 'Local Agent',
            userRole: req.user?.role || 'FULFILLMENT',
            message: `Proof Upload Failed for Order #${existingTicket.transactionId}`,
            details: uploadError?.message || 'Supabase storage upload error'
          });
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

    io.to(`company_${updatedTicket.companyId}`).emit('global_log_broadcast', {
      type: updatedTicket.status === 'REJECTED' ? 'WARNING' : 'SUCCESS',
      userName: req.user?.name || 'Agent',
      userRole: req.user?.role || role,
      message: `Order Status Changed to ${updatedTicket.status} (TXN #${existingTicket.transactionId})`,
      details: `Updated by ${req.user?.name || role}. Order ID: #${updatedTicket.id.substring(0, 8)}`
    });

    // Notify assigned local agent if assignment changed/set
    if (updatedTicket.assignedToId && updatedTicket.assignedToId !== existingTicket.assignedToId) {
      await prisma.auditLog.create({
        data: {
          ticketId: updatedTicket.id,
          userId: userId,
          companyId: updatedTicket.companyId,
          action: 'ASSIGNED',
          previousStatus: existingTicket.status,
          newStatus: updatedTicket.status
        }
      });
      sendPushToUser(updatedTicket.assignedToId, {
        title: '📦 Order Assigned to You!',
        body: `Order #${existingTicket.transactionId} has been assigned for fulfillment.`,
        url: '/fulfillment'
      });
    }


    // Notify sales agent who created the ticket when status changes to APPROVED / COMPLETED / REJECTED
    if (updatedTicket.status !== existingTicket.status && updatedTicket.createdById) {
      sendPushToUser(updatedTicket.createdById, {
        title: `Order ${updatedTicket.status} 🔔`,
        body: `Your order #${existingTicket.transactionId} status changed to ${updatedTicket.status}.`,
        url: '/sales'
      });
    }

    res.json({ message: 'Ticket updated', ticket: updatedTicket });
  } catch (error) {
    next(error);
  }
};

// ─── Edit ticket details (NOT status) ────────────────────────────────────────
export const editTicket = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const role = req.user!.role;
    const companyId = req.user!.companyId;

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // SALES: can only edit their own PENDING tickets
    if (role === 'SALES') {
      if (ticket.createdById !== userId) {
        res.status(403).json({ error: 'You can only edit your own orders' });
        return;
      }
      if (ticket.status !== 'PENDING') {
        res.status(403).json({ error: 'Only PENDING orders can be edited' });
        return;
      }
    }

    // MANAGER / SUPER_ADMIN: can edit any ticket in their company
    if (role === 'MANAGER' && ticket.companyId !== companyId) {
      res.status(403).json({ error: 'Not authorized for this ticket' });
      return;
    }

    const { name, phone, ticketNumber, notes, paymentMethod, bankType, price } = req.body;

    // Merge into existing genericData
    const existingGeneric = (ticket.genericData as any) || {};
    const updatedGeneric = {
      ...existingGeneric,
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(ticketNumber !== undefined && { ticketNumber }),
      ...(notes !== undefined && { notes }),
      ...(paymentMethod !== undefined && { paymentMethod }),
      ...(bankType !== undefined && { bankType }),
    };

    const updateData: any = { genericData: updatedGeneric };

    // Only MANAGER / SUPER_ADMIN can change price
    if ((role === 'MANAGER' || role === 'SUPER_ADMIN') && price !== undefined) {
      const newPrice = parseFloat(price);
      updateData.price = newPrice;
      updateData.bonusAmount = newPrice * 0.1;
    }

    const updated = await prisma.ticket.update({ where: { id }, data: updateData });

    io.to(`company_${ticket.companyId}`).emit('global_log_broadcast', {
      type: 'INFO',
      userName: req.user?.name || 'Agent',
      userRole: role,
      message: `Order Details Edited: TXN #${ticket.transactionId}`,
      details: `Edited by ${req.user?.name}. Fields updated.`
    });

    res.json({ message: 'Ticket edited', ticket: updated });
  } catch (error) {
    next(error);
  }
};

export const approveTicketWithFulfillment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { status, assignedToId, fulfillmentProofUrl } = req.body;
    const userId = req.user!.id;
    const role = req.user!.role;

    // ... Implementation logic would go here ...

    io.to(`company_${''}`).emit('global_log_broadcast', {
      type: 'INFO',
      userName: req.user?.name || 'Agent',
      userRole: role,
      message: `Order Details Edited: TXN #${''}`,
      details: `Edited by ${req.user?.name}. Fields updated.`
    });

    res.json({ message: 'Ticket approved successfully', ticket: {} });
  } catch (error) {
    next(error);
  }
};
