'use client';

import { useState, useMemo } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Home, TramFront, Shield, Users } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking, useUser } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


interface UserProfile {
  id: string; // Document ID, which is the user's UID
  uid: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
  isActive: boolean;
}

function UserManagement() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();

  const usersCollectionRef = useMemoFirebase(() => collection(firestore, 'userProfiles'), [firestore]);
  const { data: users, isLoading } = useCollection<UserProfile>(usersCollectionRef);

  const handleAdminToggle = (user: UserProfile, isAdmin: boolean) => {
    if (user.uid === currentUser?.uid) {
      toast({
        variant: 'destructive',
        title: 'Action Forbidden',
        description: "You cannot change your own admin status.",
      });
      return;
    }

    const userDocRef = doc(firestore, 'userProfiles', user.id);
    updateDocumentNonBlocking(userDocRef, { isAdmin });

    toast({
      title: 'User Updated',
      description: `${user.displayName} has been ${isAdmin ? 'granted' : 'revoked'} admin privileges.`,
    });
  };

  const handleActiveToggle = (user: UserProfile, isActive: boolean) => {
    if (user.uid === currentUser?.uid) {
      toast({
        variant: 'destructive',
        title: 'Action Forbidden',
        description: "You cannot change your own activation status.",
      });
      return;
    }

    const userDocRef = doc(firestore, 'userProfiles', user.id);
    updateDocumentNonBlocking(userDocRef, { isActive });

    toast({
      title: 'User Updated',
      description: `${user.displayName}'s account has been ${isActive ? 'activated' : 'deactivated'}.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6" />
          <div>
            <CardTitle className="text-xl">User Management</CardTitle>
            <CardDescription>
              Activate, deactivate, and grant admin privileges to users.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
           <div className="flex items-center justify-center py-10 text-muted-foreground">
             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
             <span>Loading users...</span>
           </div>
        )}
        {users && (
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Administrator</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.displayName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                   <TableCell>
                     <Switch
                      checked={user.isActive}
                      onCheckedChange={(isChecked) => handleActiveToggle(user, isChecked)}
                      aria-label={`Toggle activation for ${user.displayName}`}
                      disabled={user.uid === currentUser?.uid || user.email === 'michael.dodsworth@gonorthwest.co.uk'}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                     <Switch
                      checked={user.isAdmin}
                      onCheckedChange={(isChecked) => handleAdminToggle(user, isChecked)}
                      aria-label={`Toggle admin for ${user.displayName}`}
                      disabled={user.uid === currentUser?.uid || user.email === 'michael.dodsworth@gonorthwest.co.uk'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!isLoading && (!users || users.length === 0) && (
            <p className="py-10 text-center text-muted-foreground">No users have signed up yet.</p>
        )}
      </CardContent>
    </Card>
  );
}


export default function AdminPage() {
  // State for TransXchange upload
  const [txcFile, setTxcFile] = useState<File | null>(null);
  const [isUploadingTxc, setIsUploadingTxc] = useState(false);
  
  // State for Metrolink upload
  const [metroFile, setMetroFile] = useState<File | null>(null);
  const [isUploadingMetro, setIsUploadingMetro] = useState(false);

  const { toast } = useToast();

  const handleTxcFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setTxcFile(e.target.files[0]);
    }
  };
  
  const handleMetroFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setMetroFile(e.target.files[0]);
    }
  };

  const handleTxcSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!txcFile) {
      toast({
        variant: 'destructive',
        title: 'No file selected',
        description: 'Please select a TransXchange ZIP or XML file to upload.',
      });
      return;
    }

    setIsUploadingTxc(true);
    const formData = new FormData();
    formData.append('file', txcFile);

    try {
      const response = await fetch('/api/upload-transxchange', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'An unknown error occurred.');
      }

      let reportContent = result.message;
      
      if (result.debug_info?.stop_point_sample) {
          reportContent += `\n\n--- DEBUG INFO ---\n`;
          reportContent += `This is a sample of the first StopPoint object that could not be parsed:\n\n`;
          reportContent += JSON.stringify(result.debug_info.stop_point_sample, null, 2);
      } else if (result.debug_info?.sample_journey_pattern) {
          reportContent += `\n\n--- DEBUG INFO ---\n`;
          reportContent += `The system failed to build routes. This is likely due to an unexpected structure in the JourneyPattern data. Here is a sample of a raw JourneyPattern it could not process:\n\n`;
          reportContent += JSON.stringify(result.debug_info.sample_journey_pattern, null, 2);
      }


      const description = (
          <div className="mt-4 w-full text-left">
              <Label htmlFor="upload-report">Full Report (click to select all)</Label>
              <textarea
                  id="upload-report"
                  readOnly
                  rows={20}
                  className="mt-1 w-full rounded-md border border-input bg-slate-950 p-3 font-mono text-xs text-white"
                  value={reportContent}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
          </div>
      );

      toast({
          title: 'Upload Report',
          description: description,
          duration: 300000, // 5 minutes
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: error.message,
      });
    } finally {
      setIsUploadingTxc(false);
      setTxcFile(null);
      const fileInput = document.getElementById('txc-file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };
  
  const handleMetroSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!metroFile) {
      toast({
        variant: 'destructive',
        title: 'No file selected',
        description: 'Please select a Metrolink JSON file to upload.',
      });
      return;
    }

    setIsUploadingMetro(true);
    const formData = new FormData();
    formData.append('file', metroFile);

    try {
      const response = await fetch('/api/upload-metrolink', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'An unknown error occurred.');
      }

      toast({
        title: 'Upload Successful',
        description: `${result.message}`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: error.message,
      });
    } finally {
      setIsUploadingMetro(false);
      setMetroFile(null);
      const fileInput = document.getElementById('metro-file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-background p-8 gap-8">
       <div className="w-full max-w-2xl space-y-8">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <Link
              href="/"
              className={buttonVariants({ variant: 'outline' })}
              aria-label="Home"
            >
              <Home className="mr-2 h-5 w-5" />
              Back to Home
            </Link>
        </div>

        <UserManagement />

        <Card>
           <CardHeader>
              <div className="flex items-center gap-3">
                <Upload className="h-6 w-6" />
                <div>
                    <CardTitle className="text-xl">Bus Timetable Upload</CardTitle>
                    <CardDescription>
                      Upload TransXchange data to update the bus timetable reference.
                    </CardDescription>
                </div>
              </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTxcSubmit} className="space-y-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="txc-file-upload">TransXchange ZIP/XML File</Label>
                <Input
                  id="txc-file-upload"
                  type="file"
                  accept=".zip,.xml"
                  onChange={handleTxcFileChange}
                  disabled={isUploadingTxc}
                />
              </div>
              <Button type="submit" disabled={isUploadingTxc || !txcFile}>
                {isUploadingTxc ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Bus Timetable
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <Card>
           <CardHeader>
              <div className="flex items-center gap-3">
                <TramFront className="h-6 w-6" />
                <div>
                    <CardTitle className="text-xl">Metrolink Data Upload</CardTitle>
                    <CardDescription>
                      Upload Metrolink stops and lines information in JSON format.
                    </CardDescription>
                </div>
              </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleMetroSubmit} className="space-y-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="metro-file-upload">Metrolink JSON File</Label>
                <Input
                  id="metro-file-upload"
                  type="file"
                  accept=".json"
                  onChange={handleMetroFileChange}
                  disabled={isUploadingMetro}
                />
              </div>
              <Button type="submit" disabled={isUploadingMetro || !metroFile}>
                {isUploadingMetro ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Metrolink Data
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

      </div>
    </main>
  );
}
