'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/firebase';
import {
  isSignInWithEmailLink,
  signInWithEmailLink,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getFirestore } from 'firebase/firestore';
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
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function FinishSignUpPage() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'verifying' | 'form' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const auth = useAuth();
  const db = getFirestore();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let storedEmail = window.localStorage.getItem('emailForSignIn');
      if (!storedEmail) {
        // This can happen if the user opens the link on a different device.
        // We'll prompt them for their email.
        storedEmail = window.prompt('Please provide your email for confirmation');
      }

      if (storedEmail) {
        setEmail(storedEmail);
        setStatus('form');
      } else {
        setErrorMessage('Could not confirm email. Please try the invitation link again or contact an administrator.');
        setStatus('error');
      }
    } else {
      setErrorMessage('This is not a valid sign-up link. Please request a new invitation or sign up normally.');
      setStatus('error');
    }
  }, [auth]);

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
    
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailLink(auth, email, window.location.href);
      const user = userCredential.user;

      // Now that the user is signed in, update their password and profile
      await updatePassword(user, password);
      await updateProfile(user, { displayName });

      const isSuperAdmin = user.email === 'michael.dodsworth@gonorthwest.co.uk';

      // Create their profile in Firestore
      const userProfile = {
        uid: user.uid,
        email: user.email,
        displayName: displayName,
        isAdmin: isSuperAdmin,
        isActive: isSuperAdmin, // User must be activated by an admin unless they are super admin
        passwordChangeRequired: false,
      };
      await setDoc(doc(db, 'userProfiles', user.uid), userProfile);
      
      // Clean up local storage
      window.localStorage.removeItem('emailForSignIn');

      toast({
        title: 'Account Created',
        description: 'Your account is now pending activation by an administrator.',
      });

      // Redirect to the pending page. The ClientLayout will handle this.
      router.replace('/pending-activation');

    } catch (error: any) {
      console.error('Finish sign up error:', error);
      let description = error.message;
      if (error.code === 'auth/invalid-action-code') {
        description = "The invitation link is invalid or has expired. Please request a new one."
      }
      toast({
        variant: 'destructive',
        title: 'Sign Up Failed',
        description: description,
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
