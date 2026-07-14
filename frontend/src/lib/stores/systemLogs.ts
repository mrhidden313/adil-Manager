import { writable } from 'svelte/store';
import { io, Socket } from 'socket.io-client';
import { getAuthUser, getAuthToken } from '$lib/utils/auth';

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;
  details?: string;
}

let globalSocket: Socket | null = null;
const clientId = Math.random().toString(36).substring(2, 9);

function getLocalUser() {
  return getAuthUser();
}

function createSystemLogsStore() {
  const { subscribe, update, set } = writable<LogEntry[]>([
    {
      id: 'init-1',
      timestamp: new Date(),
      type: 'INFO',
      message: 'Global Live Watchtower initialized. Syncing real-time logs across all users...'
    }
  ]);

  return {
    subscribe,
    addRemote: (type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR', message: string, details?: any) => {
      let detailsStr = '';
      if (details) {
        if (typeof details === 'string') detailsStr = details;
        else if (details instanceof Error) detailsStr = details.message || details.stack || '';
        else {
          try { detailsStr = JSON.stringify(details); } catch (e) { detailsStr = String(details); }
        }
      }

      update(logs => {
        const newLog: LogEntry = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          timestamp: new Date(),
          type,
          message,
          details: detailsStr
        };
        return [newLog, ...logs].slice(0, 100);
      });
    },
    add: (type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR', message: string, details?: any, silentEmit = false) => {
      let detailsStr = '';
      if (details) {
        if (typeof details === 'string') detailsStr = details;
        else if (details instanceof Error) detailsStr = details.message || details.stack || '';
        else {
          try { detailsStr = JSON.stringify(details); } catch (e) { detailsStr = String(details); }
        }
      }

      const user = getLocalUser();
      const badge = user ? `[${user.role || 'USER'}: ${user.name || 'Client'}] ` : '';
      const formattedMessage = message.startsWith('[') ? message : `${badge}${message}`;

      update(logs => {
        const newLog: LogEntry = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          timestamp: new Date(),
          type,
          message: formattedMessage,
          details: detailsStr
        };
        return [newLog, ...logs].slice(0, 100);
      });

      // Emit to global socket for Manager screen catch & fire
      if (!silentEmit && typeof window !== 'undefined') {
        const socket = systemLogs.initGlobalSocket();
        if (socket && user?.companyId) {
          socket.emit('global_client_log', {
            senderClientId: clientId,
            companyId: user.companyId,
            userName: user.name || 'Unknown',
            userRole: user.role || 'USER',
            type,
            message: formattedMessage,
            details: detailsStr
          });
        }
      }
    },
    clear: () => {
      set([]);
    },
    initGlobalSocket: () => {
      if (typeof window === 'undefined') return null;
      if (globalSocket && globalSocket.connected) return globalSocket;

      const user = getLocalUser();
      const token = getAuthToken();
      if (!user || !user.companyId || !token) return null;

      if (!globalSocket) {
        globalSocket = io((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '', {
          transports: ['websocket', 'polling'],
          withCredentials: true
        });

        globalSocket.on('connect', () => {
          globalSocket?.emit('joinCompany', user.companyId);
        });

        globalSocket.on('global_log_broadcast', (remoteData: any) => {
          if (!remoteData) return;
          // Don't duplicate if we originated this client log
          if (remoteData.senderClientId && remoteData.senderClientId === clientId) return;

          let msg = remoteData.message || 'Remote action occurred';
          if (!msg.startsWith('[')) {
            const badge = remoteData.userName ? `[${remoteData.userRole || 'REMOTE'}: ${remoteData.userName}] ` : '[REMOTE] ';
            msg = `${badge}${msg}`;
          }

          systemLogs.addRemote(
            remoteData.type || 'INFO',
            msg,
            remoteData.details || ''
          );
        });
      }

      return globalSocket;
    }
  };
}

export const systemLogs = createSystemLogsStore();

// Auto-interceptor for window.fetch errors and modifying requests on any client device
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || 'unknown URL';
    const method = args[1]?.method || 'GET';
    const shortUrl = url.replace(/^https?:\/\/[^\/]+/, '');

    // Avoid logging polling/socket requests to keep terminal clean
    if (shortUrl.includes('socket.io') || shortUrl.includes('/notifications') || shortUrl.includes('/messages/unread')) {
      return originalFetch(...args);
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
      let desc = `API Request (${method}): ${shortUrl}`;
      if (shortUrl.includes('/tickets') && method === 'POST') desc = 'Order creation initiated...';
      if (shortUrl.includes('/status')) desc = 'Order status update initiated...';
      systemLogs.add('INFO', desc);
    }

    try {
      const response = await originalFetch(...args);
      if (!response.ok) {
        const status = response.status;
        let errDesc = `HTTP ${status} Error from ${shortUrl}`;
        if (status === 413) errDesc = `Payload Too Large (413): File is too big (${shortUrl})`;
        if (status >= 500) errDesc = `Server Error (${status}): ${shortUrl}`;
        systemLogs.add('ERROR', errDesc, `Status: ${status} ${response.statusText}`);
      } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
        systemLogs.add('SUCCESS', `Completed (${method}): ${shortUrl}`);
      }
      return response;
    } catch (error: any) {
      let errMsg = error?.message || String(error);
      if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
        errMsg = `Network / CORS or Payload Limit Error on ${shortUrl}. (Check file size or server status)`;
      }
      systemLogs.add('ERROR', `Fetch Failed: ${shortUrl}`, errMsg);
      throw error;
    }
  };
}
