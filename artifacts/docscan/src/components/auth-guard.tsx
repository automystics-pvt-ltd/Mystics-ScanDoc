import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useGetMe, getGetMeQueryKey } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';

export function AuthGuard({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) {
  const { user, token, setInitialUser, logout } = useAuth();
  const [, setLocation] = useLocation();

  const { data: me, isError, isLoading: meLoading } = useGetMe({
    query: {
      enabled: !!token && !user,
      retry: false,
      queryKey: getGetMeQueryKey()
    }
  });

  useEffect(() => {
    if (me) {
      setInitialUser(me);
    }
  }, [me, setInitialUser]);

  useEffect(() => {
    if (isError || (!token && !meLoading)) {
      logout();
      setLocation('/login');
    }
  }, [isError, token, meLoading, logout, setLocation]);

  const isLoading = (!!token && !user) || meLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  if (requireAdmin && user.role !== 'admin') {
    setLocation('/upload');
    return null;
  }

  return <>{children}</>;
}