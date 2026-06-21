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
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

export default function PendingActivationPage() {
  const router = useRouter();
  const { logout } = useAuth();

  const handleSignOut = async () => {
    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      console.error('Error signing out:', error);
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
