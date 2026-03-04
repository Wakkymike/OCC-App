
'use client';

import { useAuth } from '@/contexts/auth-context';
import ShiftDisplay from '@/components/ShiftDisplay';
import { Button } from '@/components/ui/button';
import { Home, Loader2, Calendar } from 'lucide-react';
import Link from 'next/link';
import UserMenu from '@/components/auth/UserMenu';

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
    <div className="flex flex-col min-h-screen bg-background">
      <div className="absolute top-4 right-4 z-10">
        <UserMenu />
      </div>
      
      <main className="flex flex-col items-center p-8 gap-8">
        <div className="w-full max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary" />
            <div className="flex flex-col">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">My Shifts</h1>
              <p className="text-muted-foreground text-sm">Manage your personal rota and upcoming duties.</p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Home
            </Link>
          </Button>
        </div>

        <div className="w-full max-w-4xl">
          <ShiftDisplay userProfile={user} />
        </div>
      </main>
    </div>
  );
}
