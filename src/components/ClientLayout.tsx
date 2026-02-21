'use client';

import { useUser, updateDocumentNonBlocking } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

const PUBLIC_PAGES = ['/login', '/sign-up', '/pending-activation', '/finish-sign-up'];
const ADMIN_PAGES = ['/admin'];
const FORCE_PASSWORD_CHANGE_PAGE = '/force-password-change';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (isUserLoading) {
      return;
    }

    const isPublicPage = PUBLIC_PAGES.includes(pathname);
    const isAdminPage = ADMIN_PAGES.includes(pathname);
    const isPendingPage = pathname === '/pending-activation';
    const isPasswordChangePage = pathname === FORCE_PASSWORD_CHANGE_PAGE;

    if (user) {
      const db = getFirestore();
      const userProfileRef = doc(db, 'userProfiles', user.uid);
      
      getDoc(userProfileRef).then(userProfileSnap => {
        const isSuperAdmin = user.email === 'michael.dodsworth@gonorthwest.co.uk';

        if (!userProfileSnap.exists()) {
          if (!isPublicPage) {
            signOut(getAuth());
          }
          return;
        }
        
        const userProfile = userProfileSnap.data() || {};

        if (userProfile.forceSignOut) {
            updateDocumentNonBlocking(userProfileRef, { forceSignOut: false });
            signOut(getAuth());
            toast({
                title: "Signed Out",
                description: "You have been signed out by an administrator."
            });
            return;
        }

        if (!userProfile.isActive && !isSuperAdmin) {
          if (!isPendingPage) {
            router.replace('/pending-activation');
          }
          return;
        }

        if (userProfile.passwordChangeRequired && !isPasswordChangePage) {
            router.replace(FORCE_PASSWORD_CHANGE_PAGE);
            return;
        }

        if (!userProfile.passwordChangeRequired && isPasswordChangePage) {
            router.replace('/');
            return;
        }
        
        if (isPendingPage && (userProfile.isActive || isSuperAdmin)) {
          router.replace('/');
          return;
        }

        if (isAdminPage) {
          const isDbAdmin = userProfile.isAdmin === true;
          const isContentCreator = userProfile.isContentCreator === true;

          if (!isSuperAdmin && !isDbAdmin && !isContentCreator) {
            router.replace('/');
          }
          return;
        }

        if (isPublicPage && !isPendingPage) {
            router.replace('/');
            return;
        }

      }).catch((err) => {
          console.error("Layout auth check failed", err);
          signOut(getAuth());
      });
    } else {
      if (!isPublicPage) {
        router.replace('/login');
      }
    }
  }, [user, isUserLoading, pathname, router, toast]);

  if (isUserLoading && !PUBLIC_PAGES.includes(pathname)) {
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