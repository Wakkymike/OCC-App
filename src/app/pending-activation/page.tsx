'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getAuth, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function PendingActivationPage() {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut(getAuth());
      router.replace('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      // Even if sign-out fails, redirect to login
      router.replace('/login');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Account Pending Activation</CardTitle>
          <CardDescription>
            Your account has been successfully created but is currently awaiting
            approval from an administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            You will not be able to access the application until your account is
            activated. Please check back later. If you believe this is an
            error, please contact support.
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSignOut} className="w-full">
            Return to Login Page
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
