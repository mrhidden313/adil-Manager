export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('token') || localStorage.getItem('token');
}

export function getAuthUser(): any | null {
  if (typeof window === 'undefined') return null;
  const userStr = sessionStorage.getItem('user') || localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function isImpersonatingSession(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('isImpersonating') === 'true';
}

export function exitImpersonation(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('isImpersonating');
  window.close();
  setTimeout(() => {
    window.location.href = '/manager';
  }, 100);
}

export function requireRoleGuard(allowedRoles: string[]): boolean {
  if (typeof window === 'undefined') return true;
  const token = getAuthToken();
  const user = getAuthUser();

  if (!token || !user || !user.role) {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('/');
    return false;
  }

  if (!allowedRoles.includes(user.role)) {
    let correctPath = '/';
    if (user.role === 'SUPER_ADMIN') correctPath = '/admin';
    else if (user.role === 'MANAGER') correctPath = '/manager';
    else if (user.role === 'SALES') correctPath = '/sales';
    else if (user.role === 'FULFILLMENT') correctPath = '/fulfillment';

    window.location.replace(correctPath);
    return false;
  }

  return true;
}
