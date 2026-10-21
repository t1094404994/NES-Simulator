import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AdminUser } from '@nes/shared';
import { currentUser, login as loginRequest, logout as logoutRequest } from './api';

interface AuthState {
  user: AdminUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancel = false;
    currentUser()
      .then((next) => {
        if (!cancel) {
          setUser(next);
        }
      })
      .finally(() => {
        if (!cancel) {
          setReady(true);
        }
      });
    return () => {
      cancel = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const next = await loginRequest(email, password);
    setUser(next);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, login, logout }), [user, ready, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('AuthProvider missing');
  }
  return value;
}
