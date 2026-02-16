'use client';

import { useUser } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';

const PUBLIC_PAGES = ['/login', '/sign-up', '/pending-activation'];
const ADMIN_PAGES = ['/admin'];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isUserLoading) {
      return; // Wait until user state is determined.
    }

    const isPublicPage = PUBLIC_PAGES.includes(pathname);
    const isAdminPage = ADMIN_PAGES.includes(pathname);
    const isPendingPage = pathname === '/pending-activation';

    if (user) {
      // User is authenticated, now check their profile status (active, admin).
      const db = getFirestore();
      const userProfileRef = doc(db, 'userProfiles', user.uid);
      
      getDoc(userProfileRef).then(userProfileSnap => {
        // If profile doesn't exist (e.g., still being created), log them out to be safe.
        if (!userProfileSnap.exists()) {
          signOut(getAuth());
          return;
        }

        const userProfile = userProfileSnap.data();

        // 1. Check for account activation.
        if (!userProfile.isActive) {
          if (!isPendingPage) {
            // If user is not active, force them to the pending page.
            router.replace('/pending-activation');
          }
          return; // Stop further checks if not active.
        }

        // User IS active, proceed with other routing rules.
        
        // 2. If on the pending page, but they are active, redirect to home.
        if (isPendingPage) {
          router.replace('/');
          return;
        }

        // 3. If on a public page (login/signup) but they are active and logged in, redirect to home.
        if (isPublicPage && !isPendingPage) {
            router.replace('/');
            return;
        }

        // 4. Check for admin access if they are on an admin page.
        if (isAdminPage) {
          const isSuperAdmin = user.email === 'michael.dodsworth@gonorthwest.co.uk';
          const isDbAdmin = userProfile.isAdmin;

          if (!isSuperAdmin && !isDbAdmin) {
            // Not an admin, redirect to home.
            router.replace('/');
          }
        }
      }).catch(() => {
          // If there's an error fetching the profile, log the user out.
          signOut(getAuth());
      });
    } else {
      // User is not authenticated.
      // If they are not on a public page, redirect to login.
      if (!isPublicPage) {
        router.replace('/login');
      }
    }
  }, [user, isUserLoading, pathname, router]);

  // Show a loading screen while authentication is in progress and not on a public page.
  if (isUserLoading && !PUBLIC_PAGES.includes(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If user is not logged in and not on a public page, the redirect is happening.
  // We render null to avoid a flash of the protected content.
  if (!user && !PUBLIC_PAGES.includes(pathname)) {
    return null;
  }
  
  // If user is logged in and on an auth page, the redirect is happening.
  if (user && (pathname === '/login' || pathname === '/sign-up')) {
    return null;
  }

  return <>{children}</>;
}
