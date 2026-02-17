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
      return; // Wait until user state is determined.
    }

    const isPublicPage = PUBLIC_PAGES.includes(pathname);
    const isAdminPage = ADMIN_PAGES.includes(pathname);
    const isPendingPage = pathname === '/pending-activation';
    const isPasswordChangePage = pathname === FORCE_PASSWORD_CHANGE_PAGE;


    if (user) {
      // User is authenticated, now check their profile status (active, admin).
      const db = getFirestore();
      const userProfileRef = doc(db, 'userProfiles', user.uid);
      
      getDoc(userProfileRef).then(userProfileSnap => {
        const isSuperAdmin = user.email === 'michael.dodsworth@gonorthwest.co.uk';

        // If profile doesn't exist yet (e.g., in the middle of sign-up flow),
        // and we're not on a public page, log them out to be safe.
        // This can happen with the email link flow if something goes wrong.
        if (!userProfileSnap.exists() && !isPublicPage) {
          signOut(getAuth());
          return;
        }
        
        // If profile exists, proceed with checks
        if (userProfileSnap.exists()) {
            const userProfile = userProfileSnap.data();

            // 0. Check for forced sign out first.
            if (userProfile.forceSignOut) {
                // Reset the flag first to prevent a sign-out loop on next login.
                updateDocumentNonBlocking(userProfileRef, { forceSignOut: false });
                
                signOut(getAuth());
                
                toast({
                    title: "Signed Out",
                    description: "You have been signed out by an administrator."
                });
                return; // Stop further processing. The onAuthStateChanged will handle the redirect.
            }

            // 1. Check for account activation.
            if (!userProfile.isActive && !isSuperAdmin) {
              if (!isPendingPage) {
                // If user is not active, force them to the pending page.
                router.replace('/pending-activation');
              }
              return; // Stop further checks if not active.
            }

            // 2. Check for forced password change (if user is active).
            if (userProfile.passwordChangeRequired && !isPasswordChangePage) {
                router.replace(FORCE_PASSWORD_CHANGE_PAGE);
                return;
            }

            // 3. If on password change page but it's not required, redirect to home.
            if (!userProfile.passwordChangeRequired && isPasswordChangePage) {
                router.replace('/');
                return;
            }

            // User IS active and doesn't need a password change, proceed with other routing rules.
            
            // 4. If on the pending page, but they are now active, redirect to home.
            if (isPendingPage && (userProfile.isActive || isSuperAdmin)) {
              router.replace('/');
              return;
            }

            // 5. If on a public page (login/signup) but they are active and logged in, redirect to home.
            if (isPublicPage && !isPendingPage) {
                router.replace('/');
                return;
            }

            // 6. Check for admin access if they are on an admin page.
            if (isAdminPage) {
              const isDbAdmin = userProfile.isAdmin;

              if (!isSuperAdmin && !isDbAdmin) {
                // Not an admin, redirect to home.
                router.replace('/');
              }
            }
        }
      }).catch(() => {
          // If there's an error fetching the profile, log the user out.
          signOut(getAuth());
      });
    } else {
      // User is not authenticated.
      // If they are on a page that isn't public, redirect to login.
      if (!isPublicPage) {
        router.replace('/login');
      }
    }
  }, [user, isUserLoading, pathname, router, toast]);

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
