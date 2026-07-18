import { systemLogs } from '$lib/stores/systemLogs';
import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = async ({ error, event, status, message }) => {
  const err = error as any;
  const errorDetails = {
    url: event.url.href,
    route: event.route.id,
    stack: err?.stack || err?.message || String(err),
    status
  };

  // Emit directly to the local systemLogs which will broadcast if it has a socket
  systemLogs.addRemote(
    'ERROR',
    `Frontend Crash: ${message || err?.message || 'Unknown UI Error'}`,
    JSON.stringify(errorDetails, null, 2)
  );

  return {
    message: 'An unexpected error occurred.',
    errorId: crypto.randomUUID()
  };
};
