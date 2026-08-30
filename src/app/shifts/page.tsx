
'use client';

import { useAuth } from '@/contexts/auth-context';
import ShiftDisplay from '@/components/ShiftDisplay';
import { Button } from '@/components/ui/button';
import { Home, Loader2 } from 'lucide-react';
import Link from 'next/link';
import UserMenu from '@/components/auth/UserMenu';
import PageShell from '@/components/layout/PageShell';

export default function ShiftsPage() {
  const { user, isLoading: loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell
      title="My Shifts"
      description="Manage your personal rota and upcoming duties."
      actions={(
        <>
          <Button asChild variant="outline">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Home
            </Link>
          </Button>
          <UserMenu />
        </>
      )}
    >
      <div className="occ-panel p-3 sm:p-4">
        <ShiftDisplay userProfile={user} />
      </div>
    </PageShell>
  );
}
