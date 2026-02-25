
'use client';

import { useState } from 'react';
import { useAuth, setDocumentNonBlocking } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getFirestore } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const db = getFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Password Too Short',
        description: 'Password must be at least 6 characters.',
      });
      return;
    }
    
    setIsLoading(true);
    
    createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        const user = userCredential.user;

        // Perform side-effects after creation
        updateProfile(user, { displayName });

        const isSuperAdmin = user.email === 'michael.dodsworth@gonorthwest.co.uk';

        const userProfile = {
          uid: user.uid,
          email: user.email,
          displayName: displayName,
          isAdmin: isSuperAdmin,
          isContentCreator: false,
          isActive: isSuperAdmin,
          passwordChangeRequired: false,
          forceSignOut: false,
        };
        
        const userProfileRef = doc(db, 'userProfiles', user.uid);
        setDocumentNonBlocking(userProfileRef, userProfile, { merge: false });

        toast({
          title: 'Account Created',
          description: 'Your account is now pending activation by an administrator.',
        });
      })
      .catch((error: any) => {
        console.error('Sign up error:', error);
        let message = 'An unknown error occurred.';
        if (error.code === 'auth/email-already-in-use') {
          message = 'This email is already registered. Please login instead.';
        } else if (error.code === 'auth/invalid-email') {
          message = 'The email address is not valid.';
        } else if (error.code === 'auth/weak-password') {
          message = 'The password is too weak.';
        } else if (error.message) {
          message = error.message;
        }

        toast({
          variant: 'destructive',
          title: 'Sign Up Failed',
          description: message,
        });
        setIsLoading(false);
      });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Sign Up</CardTitle>
          <CardDescription>
            Enter your information to create an account.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignUp}>
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
            <div className="text-center text-sm">
              Already have an account?{' '}
              <Link href="/login" className="underline">
                Login
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
