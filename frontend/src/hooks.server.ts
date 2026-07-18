import type { HandleServerError } from '@sveltejs/kit';

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
  const err = error as any;
  const errorDetails = {
    url: event.url.href,
    route: event.route.id,
    stack: err?.stack || err?.message || String(err),
    status
  };

  // Log on server console
  console.error('Frontend SSR Crash:', errorDetails);

  // Note: We don't have direct access to the client-side socket here.
  // The backend watchtower will catch API errors directly. SSR errors are mostly UI rendering issues.
  
  return {
    message: 'An unexpected error occurred on the server.',
    errorId: crypto.randomUUID()
  };
};
