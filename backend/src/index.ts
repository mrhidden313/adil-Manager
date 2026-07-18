import express from 'express';



import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import { app, httpServer, io } from './socket';
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

import authRoutes from './routes/auth.routes';
import messageRoutes from './routes/message.routes';
import pushRoutes from './routes/push.routes';
import ticketRoutes from './routes/ticket.routes';

// Routes will be added here
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);

import { requireAuth, requireRole } from './middleware/auth.middleware';
import { prisma } from './prisma';

app.get('/api/users/fulfillment', requireAuth as any, requireRole(['MANAGER', 'SUPER_ADMIN']) as any, async (req, res) => {
  try {
    const users = await prisma.user.findMany({ where: { role: 'FULFILLMENT' }, select: { id: true, name: true } });
    res.json(users);
  } catch (err) {
    console.error('Error fetching fulfillment users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

import userRoutes from './routes/user.routes';
app.use('/api/users', userRoutes);

import companyRoutes from './routes/company.routes';
app.use('/api/companies', companyRoutes);

import payoutRoutes from './routes/payout.routes';
app.use('/api/payouts', payoutRoutes);

import notificationRoutes from './routes/notification.routes';
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/push', pushRoutes);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('joinCompany', (companyId) => {
    socket.join(`company_${companyId}`);
    console.log(`Socket ${socket.id} joined company ${companyId}`);
  });

  socket.on('global_client_log', (data) => {
    if (data && data.companyId) {
      io.to(`company_${data.companyId}`).emit('global_log_broadcast', data);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

import { errorWatchtower } from './middleware/errorWatchtower';

// Global Error Handler for Express
app.use(errorWatchtower);

// Prevent Node process from crashing on unhandled errors/rejections
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

