'use client';

import { useAuth } from '@/contexts/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PUBLIC_PAGES = ['/login', '/sign-up', '/pending-activation', '/finish-sign-up'];
const ADMIN_PAGES = ['/admin'];
const FORCE_PASSWORD_CHANGE_PAGE = '/force-password-change';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout, refreshUser } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (isLoading) return;

    const isPublicPage = PUBLIC_PAGES.includes(pathname);
    const isAdminPage = ADMIN_PAGES.includes(pathname);
    const isPendingPage = pathname === '/pending-activation';
    const isPasswordChangePage = pathname === FORCE_PASSWORD_CHANGE_PAGE;

    if (user) {
      const isSuperAdmin = user.isSuperAdmin;

      if (user.forceSignOut) {
        // Update the flag via API then log out
        fetch(`/api/users/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceSignOut: false }),
        }).finally(() => {
          logout();
          toast({
            title: 'Signed Out',
            description: 'You have been signed out by an administrator.',
          });
        });
        return;
      }

      if (!user.isActive && !isSuperAdmin) {
        if (!isPendingPage) {
          router.replace('/pending-activation');
        }
        return;
      }

      if (user.passwordChangeRequired && !isPasswordChangePage) {
        router.replace(FORCE_PASSWORD_CHANGE_PAGE);
        return;
      }

      if (!user.passwordChangeRequired && isPasswordChangePage) {
        router.replace('/');
        return;
      }

      if (isPendingPage && (user.isActive || isSuperAdmin)) {
        router.replace('/');
        return;
      }

      if (isAdminPage) {
        if (!isSuperAdmin && !user.isAdmin && !user.isContentCreator) {
          router.replace('/');
        }
        return;
      }

      if (isPublicPage && !isPendingPage) {
        router.replace('/');
        return;
      }
    } else {
      if (!isPublicPage) {
        router.replace('/login');
      }
    }
  }, [user, isLoading, pathname, router, toast, logout, refreshUser]);

  if (isLoading && !PUBLIC_PAGES.includes(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && !PUBLIC_PAGES.includes(pathname)) {
    return null;
  }

  if (user && (pathname === '/login' || pathname === '/sign-up')) {
    return null;
  }

  return <>{children}</>;
}
