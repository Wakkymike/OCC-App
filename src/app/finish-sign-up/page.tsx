'use client';

import { useState, useEffect, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function FinishSignUpComponent() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'verifying' | 'form' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const verifyInvitation = async () => {
      const invId = searchParams.get('invitationId');
      if (!invId) {
        setErrorMessage('The invitation link is missing required information.');
        setStatus('error');
        return;
      }
      setInvitationId(invId);

      try {
        const res = await fetch(`/api/invitations/${invId}`);
        if (!res.ok) {
          setErrorMessage('This invitation is invalid, has expired, or has been cancelled.');
          setStatus('error');
          return;
        }
        const invitation = await res.json();
        setEmail(invitation.email);
        setStatus('form');
      } catch {
        setErrorMessage('Failed to verify invitation. Please try again.');
        setStatus('error');
      }
    };

    verifyInvitation();
  }, [searchParams]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'Password Too Short', description: 'Password must be at least 6 characters.' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Passwords Do Not Match' });
      return;
    }
    if (!invitationId) {
      toast({ variant: 'destructive', title: 'Sign Up Failed', description: 'Missing invitation information.' });
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/finish-sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitationId,
          email,
          password,
          displayName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Sign up failed');
      }

      toast({
        title: 'Account Created',
        description: 'Your account is now pending activation by an administrator.',
      });

      router.replace('/pending-activation');
    } catch (error: any) {
      console.error('Finish sign up error:', error);
      toast({
        variant: 'destructive',
        title: 'Sign Up Failed',
        description: error.message || 'An unexpected error occurred.',
      });
      setIsLoading(false);
    }
  };
  
  if (status === 'verifying') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Verifying invitation...</p>
      </div>
    );
  }

  if (status === 'error') {
     return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl text-destructive">Invitation Error</CardTitle>
                    <CardDescription>{errorMessage}</CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button asChild className="w-full">
                        <Link href="/login">Return to Login</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
     );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Complete Your Account</CardTitle>
          <CardDescription>
            Create a password for your account: {email}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCreateAccount}>
          <CardContent className="grid gap-4">
             <div className="grid gap-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                placeholder="Your Name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account & Sign In
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function FinishSignUpPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FinishSignUpComponent />
    </Suspense>
  );
}
