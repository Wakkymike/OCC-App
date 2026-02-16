'use client';

import { useState } from 'react';
import { useUser, useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { updatePassword, signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
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
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ForcePasswordChangePage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: 'destructive', title: 'Not Authenticated', description: 'You must be logged in to change your password.' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Password Too Short', description: 'Your new password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Passwords Do Not Match', description: 'Please re-enter your password.' });
      return;
    }
    
    setIsLoading(true);
    try {
      await updatePassword(user, newPassword);

      // After successful password update, update the user's profile in Firestore.
      const userProfileRef = doc(firestore, 'userProfiles', user.uid);
      updateDocumentNonBlocking(userProfileRef, { passwordChangeRequired: false });
      
      toast({ title: 'Password Updated', description: 'Your password has been successfully changed.' });
      router.push('/');

    } catch (error: any) {
      console.error('Password update error:', error);
      let description = error.message;
      if (error.code === 'auth/requires-recent-login') {
        description = "This operation is sensitive and requires recent authentication. Please sign out and sign back in to change your password.";
      }
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: description,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSignOut = async () => {
    if (user) {
        await signOut(user.auth);
        router.replace('/login');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Change Your Password</CardTitle>
          <CardDescription>
            For security, you must change your password before proceeding.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handlePasswordUpdate}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
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
          <CardFooter className="flex-col gap-4">
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set New Password
            </Button>
            <Button variant="link" size="sm" onClick={handleSignOut} className="w-full">
                Sign Out
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
