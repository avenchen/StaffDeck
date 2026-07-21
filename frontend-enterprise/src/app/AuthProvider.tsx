import { createContext, useContext, type ReactNode } from 'react';

import type { EnterpriseAuthUser } from '../auth';

export type AuthContextValue = {
  user: EnterpriseAuthUser;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provides the signed-in user and a logout action to the authenticated tree,
 * replacing the `currentUser` / `onLogout` props that were drilled from the
 * shell into every page. Mounted once, above all authenticated routes.
 */
export function AuthProvider({
  user,
  logout,
  children,
}: {
  user: EnterpriseAuthUser;
  logout: () => void;
  children: ReactNode;
}) {
  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
