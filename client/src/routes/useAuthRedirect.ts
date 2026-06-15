import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext } from '~/hooks';

const REDIRECT_AFTER_LOGIN_KEY = 'redirectAfterLogin';

/**
 * Sanitize redirect target to same-origin path only.
 * Rejects external URLs and ensures path starts with /.
 */
function sanitizeRedirectTarget(target: string): string | null {
  if (!target || typeof target !== 'string') {
    return null;
  }

  // Remove protocol and domain if present
  let path = target;
  try {
    const url = new URL(target, window.location.origin);
    if (url.origin !== window.location.origin) {
      return null; // External URL rejected
    }
    path = url.pathname + url.search + url.hash;
  } catch {
    // If URL parsing fails, treat as relative path
  }

  // Ensure path starts with /
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  return path;
}

export default function useAuthRedirect() {
  const { user, roles, isAuthenticated, isLoading } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const timeout = setTimeout(() => {
      // Don't redirect while loading
      if (isLoading) {
        return;
      }

      // If authenticated, no redirect needed
      if (isAuthenticated) {
        return;
      }

      // Save current path for redirect after login
      const currentPath = location.pathname + location.search + location.hash;
      const sanitizedPath = sanitizeRedirectTarget(currentPath);
      
      if (sanitizedPath) {
        sessionStorage.setItem(REDIRECT_AFTER_LOGIN_KEY, sanitizedPath);
      }

      // Redirect to MDP login
      window.location.href = '/login';
    }, 300);

    return () => {
      clearTimeout(timeout);
    };
  }, [isAuthenticated, isLoading, location]);

  return {
    user,
    roles,
    isAuthenticated,
  };
}
