import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import React, { createContext, useContext, useEffect, useState } from 'react';

const TOKEN_KEY = '@docscan:token';
const USER_KEY = '@docscan:user';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'inactive';
  createdAt: string;
}

interface AuthContextValue {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

// Module-level token reference for the auth getter.
// The getter is registered once and reads this reference on every request.
let _currentToken: string | null = null;
setAuthTokenGetter(() => _currentToken);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore persisted auth state on startup
    Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(USER_KEY),
    ]).then(([t, u]) => {
      if (t) {
        _currentToken = t;
        setToken(t);
      }
      if (u) {
        try {
          setUser(JSON.parse(u));
        } catch {}
      }
      setIsLoading(false);
    });
  }, []);

  const login = async (t: string, u: User) => {
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, t),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(u)),
    ]);
    _currentToken = t;
    setToken(t);
    setUser(u);
  };

  const logout = async () => {
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
    _currentToken = null;
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
