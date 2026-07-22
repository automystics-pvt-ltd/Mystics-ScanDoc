import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useGetMe, getGetMeQueryKey } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

export function AuthGuard({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, token, setInitialUser, logout } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: me, isError, isLoading: meLoading } = useGetMe({
    query: {
      enabled: !!token && !user,
      retry: false,
      queryKey: getGetMeQueryKey(),
    },
  });

  useEffect(() => {
    if (me) {
      setInitialUser(me);
    }
  }, [me, setInitialUser]);

  // Unauthenticated → clear cache and go to login
  useEffect(() => {
    if (isError || (!token && !meLoading)) {
      queryClient.clear();
      logout();
      setLocation('/login');
    }
  }, [isError, token, meLoading, logout, setLocation, queryClient]);

  // Non-admin on an admin-only route → redirect to upload
  useEffect(() => {
    if (user && requireAdmin && user.role !== 'admin') {
      setLocation('/upload');
    }
  }, [user, requireAdmin, setLocation]);

  // Admin on a user-only route → redirect to dashboard
  useEffect(() => {
    if (user && !requireAdmin && user.role === 'admin') {
      setLocation('/dashboard');
    }
  }, [user, requireAdmin, setLocation]);

  const isLoading = (!!token && !user) || meLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;
  if (requireAdmin && user.role !== 'admin') return null;
  if (!requireAdmin && user.role === 'admin') return null;

  return <>{children}</>;
}
