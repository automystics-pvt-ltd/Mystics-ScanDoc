import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@workspace/api-client-react';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
  setInitialUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("docscan_token"));
  const [isLoading, setIsLoading] = useState(true);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("docscan_token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("docscan_token");
    setToken(null);
    setUser(null);
  };

  const setInitialUser = (fetchedUser: User) => {
    setUser(fetchedUser);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, setInitialUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}