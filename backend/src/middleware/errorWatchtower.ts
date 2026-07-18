import { Request, Response, NextFunction } from 'express';
import { io } from '../socket';

export const errorWatchtower = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('🔥 Watchtower Caught Error:', err);

  // Extract user context if available (from AuthRequest)
  const user = (req as any).user;
  const companyId = user?.companyId || 'SYSTEM';
  
  // Format the deep error stack trace and context
  const errorDetails = {
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    query: req.query,
    user: user ? { id: user.id, name: user.name, role: user.role } : 'Anonymous',
    stack: err.stack || err.message || String(err),
    name: err.name || 'Error',
    code: err.code || 'UNKNOWN_CODE'
  };

  const formattedMessage = `Backend Crash: ${err.message || 'Unknown Error'} on ${req.method} ${req.originalUrl}`;
  
  // Emit directly to the company's admin terminal, or to all if no company
  if (companyId && companyId !== 'SYSTEM') {
    io.to(`company_${companyId}`).emit('global_log_broadcast', {
      type: 'ERROR',
      userName: user?.name || 'System Auto-Catcher',
      userRole: user?.role || 'SYSTEM',
      message: formattedMessage,
      details: JSON.stringify(errorDetails, null, 2)
    });
  } else {
    // If we can't tie it to a company, emit broadly (useful for unauthenticated routes)
    io.emit('global_log_broadcast', {
      type: 'ERROR',
      userName: 'System Auto-Catcher',
      userRole: 'SYSTEM',
      message: formattedMessage,
      details: JSON.stringify(errorDetails, null, 2)
    });
  }

  // Ensure we don't leak full stack traces to normal API responses, but we keep 500 error consistent
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    reference: 'Logged in Admin Terminal'
  });
};
