'use client';

import { useUser } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { doc, getDoc, getFirestore } from 'firebase/firestore';

const AUTH_PAGES = ['/login', '/sign-up'];
const ADMIN_PAGES = ['/admin'];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isUserLoading) return; // Wait until user state is determined

    const isAuthPage = AUTH_PAGES.includes(pathname);
    const isAdminPage = ADMIN_PAGES.includes(pathname);

    if (user) {
      // User is logged in
      if (isAuthPage) {
        // Redirect from auth pages if logged in
        router.replace('/');
      } else if (isAdminPage) {
        // Check for admin role if trying to access an admin page
        const checkAdminStatus = async () => {
          const db = getFirestore();
          const userProfileRef = doc(db, 'userProfiles', user.uid);
          const userProfileSnap = await getDoc(userProfileRef);

          const isSuperAdmin = user.email === 'michael.dodsworth@gonorthwest.co.uk';
          const isDbAdmin = userProfileSnap.exists() && userProfileSnap.data().isAdmin;

          if (!isSuperAdmin && !isDbAdmin) {
            // Not an admin or profile doesn't exist, redirect away
            console.warn('Admin access denied. Redirecting.');
            router.replace('/');
          }
        };
        checkAdminStatus();
      }
    } else {
      // User is not logged in
      if (!isAuthPage) {
        // Redirect to login if not on an auth page
        router.replace('/login');
      }
    }
  }, [user, isUserLoading, pathname, router]);

  // Show a loading screen while authentication is in progress and not on an auth page
  if (isUserLoading && !AUTH_PAGES.includes(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If user is not logged in and not on an auth page, the redirect is happening.
  // We render null to avoid a flash of the protected content.
  if (!user && !AUTH_PAGES.includes(pathname)) {
    return null;
  }
  
  // If user is logged in and on an auth page, the redirect is happening.
  if (user && AUTH_PAGES.includes(pathname)) {
    return null;
  }

  return <>{children}</>;
}
