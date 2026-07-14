import { writable } from 'svelte/store';

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;
  details?: string;
}

function createSystemLogsStore() {
  const { subscribe, update, set } = writable<LogEntry[]>([
    {
      id: 'init-1',
      timestamp: new Date(),
      type: 'INFO',
      message: 'System Live Terminal initialized. Listening for real-time operations...'
    }
  ]);

  return {
    subscribe,
    add: (type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR', message: string, details?: any) => {
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
        // Keep last 100 logs
        return [newLog, ...logs].slice(0, 100);
      });
    },
    clear: () => {
      set([]);
    }
  };
}

export const systemLogs = createSystemLogsStore();

// Optional auto-interceptor for window.fetch errors and global actions
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || 'unknown URL';
    const method = args[1]?.method || 'GET';
    const shortUrl = url.replace(/^https?:\/\/[^\/]+/, '');

    // Log modifying requests
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
        if (status === 413) errDesc = `Payload Too Large (413): File or request data is exceeding server limits (${shortUrl})`;
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
