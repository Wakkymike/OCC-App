'use client';

import { useState, useMemo } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Home, TramFront, Users, UserPlus, Send, Clock, XCircle, Rss, PlusCircle, Trash2, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking, useUser, useAuth, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, orderBy, Timestamp, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { sendSignInLinkToEmail, User } from 'firebase/auth';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import type { NetworkUpdate } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';


interface UserProfile {
  id: string; // Document ID, which is the user's UID
  uid: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
  isContentCreator: boolean;
  isActive: boolean;
  passwordChangeRequired: boolean;
  forceSignOut: boolean;
}

interface Invitation {
    id: string;
    email: string;
    invitedAt: Timestamp;
}

function UserManagement({ users, isLoading, currentUser }: { users: UserProfile[] | null; isLoading: boolean, currentUser: User | null }) {
  const firestore = useFirestore();
  const { toast } = useToast();

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
  
  const handleContentCreatorToggle = (user: UserProfile, isContentCreator: boolean) => {
    if (user.email === 'michael.dodsworth@gonorthwest.co.uk') {
        toast({
            variant: 'destructive',
            title: 'Action Forbidden',
            description: "The super admin must have all permissions.",
        });
        return;
    }
    const userDocRef = doc(firestore, 'userProfiles', user.id);
    updateDocumentNonBlocking(userDocRef, { isContentCreator });

    toast({
        title: 'User Updated',
        description: `${user.displayName} has been ${isContentCreator ? 'granted' : 'revoked'} content creator privileges.`,
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

  const handlePasswordChangeToggle = (user: UserProfile, required: boolean) => {
    const userDocRef = doc(firestore, 'userProfiles', user.id);
    updateDocumentNonBlocking(userDocRef, { passwordChangeRequired: required });

    toast({
        title: 'User Updated',
        description: `${user.displayName} will ${required ? 'be required to' : 'not be required to'} change their password on next login.`,
    });
  };

  const handleForceSignOut = (user: UserProfile) => {
    if (user.uid === currentUser?.uid) {
      toast({
        variant: 'destructive',
        title: 'Action Forbidden',
        description: "You cannot force sign out yourself.",
      });
      return;
    }

    const userDocRef = doc(firestore, 'userProfiles', user.id);
    updateDocumentNonBlocking(userDocRef, { forceSignOut: true });

    toast({
        title: 'User Session Flagged',
        description: `${user.displayName} will be signed out on their next page load.`,
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
                <TableHead>Force Password Change</TableHead>
                <TableHead>Content Creator</TableHead>
                <TableHead>Administrator</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                      disabled={user.email === 'michael.dodsworth@gonorthwest.co.uk'}
                    />
                  </TableCell>
                  <TableCell>
                     <Switch
                      checked={user.passwordChangeRequired}
                      onCheckedChange={(isChecked) => handlePasswordChangeToggle(user, isChecked)}
                      aria-label={`Toggle force password change for ${user.displayName}`}
                      disabled={user.email === 'michael.dodsworth@gonorthwest.co.uk'}
                    />
                  </TableCell>
                  <TableCell>
                     <Switch
                      checked={user.isContentCreator}
                      onCheckedChange={(isChecked) => handleContentCreatorToggle(user, isChecked)}
                      aria-label={`Toggle content creator for ${user.displayName}`}
                      disabled={user.email === 'michael.dodsworth@gonorthwest.co.uk'}
                    />
                  </TableCell>
                  <TableCell>
                     <Switch
                      checked={user.isAdmin}
                      onCheckedChange={(isChecked) => handleAdminToggle(user, isChecked)}
                      aria-label={`Toggle admin for ${user.displayName}`}
                      disabled={user.email === 'michael.dodsworth@gonorthwest.co.uk'}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleForceSignOut(user)}
                        disabled={user.email === 'michael.dodsworth@gonorthwest.co.uk' || user.uid === currentUser?.uid}
                        aria-label={`Force sign out for ${user.displayName}`}
                    >
                        <LogOut className="h-5 w-5 text-destructive" />
                    </Button>
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

function PendingInvitations({ allUsers, usersLoading }: { allUsers: UserProfile[] | null, usersLoading: boolean }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const invitationsCollectionRef = useMemoFirebase(() => collection(firestore, 'invitations'), [firestore]);
    const { data: invitations, isLoading: invitationsLoading } = useCollection<Invitation>(invitationsCollectionRef);

    const pendingInvites = useMemo(() => {
        if (!invitations || !allUsers) return [];
        const registeredEmails = new Set(allUsers.map(u => u.email));
        return invitations
            .filter(inv => !registeredEmails.has(inv.email))
            .sort((a, b) => b.invitedAt.seconds - a.invitedAt.seconds);
    }, [invitations, allUsers]);

    const isLoading = usersLoading || invitationsLoading;
    
    const handleCancelInvite = (invitationId: string) => {
        const inviteDocRef = doc(firestore, 'invitations', invitationId);
        deleteDocumentNonBlocking(inviteDocRef);
        toast({
            title: 'Invitation Revoked',
            description: 'The pending invitation has been cancelled.',
        });
    };


    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Clock className="h-6 w-6" />
                    <div>
                        <CardTitle className="text-xl">Pending Invitations</CardTitle>
                        <CardDescription>
                            These users have been invited but have not yet created an account.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading && (
                    <div className="flex items-center justify-center py-10 text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <span>Loading invitations...</span>
                    </div>
                )}
                {!isLoading && pendingInvites.length === 0 && (
                    <p className="py-10 text-center text-muted-foreground">No pending invitations.</p>
                )}
                {!isLoading && pendingInvites.length > 0 && (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Invited At</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pendingInvites.map((invite) => (
                                <TableRow key={invite.id}>
                                    <TableCell className="font-medium">{invite.email}</TableCell>
                                    <TableCell>{format(new Date(invite.invitedAt.seconds * 1000), 'PPpp')}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleCancelInvite(invite.id)}
                                            aria-label="Cancel invitation"
                                        >
                                            <XCircle className="h-5 w-5 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

function NetworkUpdateManagement() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [newUpdateTitle, setNewUpdateTitle] = useState('');
    const [newUpdateDetails, setNewUpdateDetails] = useState('');
    const [newUpdatePriority, setNewUpdatePriority] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const updatesCollectionRef = useMemoFirebase(() => query(collection(firestore, 'networkUpdates')), [firestore]);
    const { data: allUpdates, isLoading } = useCollection<NetworkUpdate>(updatesCollectionRef);

    const updates = useMemo(() => {
        if (!allUpdates) return null;
        return [...allUpdates].sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            if (a.createdAt && b.createdAt) {
                return b.createdAt.seconds - a.createdAt.seconds;
            }
            return 0;
        });
    }, [allUpdates]);

    const handleAddUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'networkUpdates'), {
                title: newUpdateTitle,
                details: newUpdateDetails,
                priority: Number(newUpdatePriority),
                isVisible: true,
                createdAt: serverTimestamp(),
            });
            toast({ title: 'Update Added', description: 'The new network update has been added.' });
            setNewUpdateTitle('');
            setNewUpdateDetails('');
            setNewUpdatePriority(0);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error Adding Update', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVisibilityToggle = (update: NetworkUpdate, isVisible: boolean) => {
        const updateRef = doc(firestore, 'networkUpdates', update.id);
        updateDocumentNonBlocking(updateRef, { isVisible });
        toast({ title: 'Update Changed', description: `Update is now ${isVisible ? 'visible' : 'hidden'}.` });
    };

    const handlePriorityChange = (updateId: string, priority: string) => {
        const numericPriority = Number(priority);
        if (!isNaN(numericPriority)) {
            const updateRef = doc(firestore, 'networkUpdates', updateId);
            updateDocumentNonBlocking(updateRef, { priority: numericPriority });
             toast({ title: 'Priority Updated', description: 'The update priority has been changed.' });
        }
    };

    const handleDeleteUpdate = (updateId: string) => {
        const updateRef = doc(firestore, 'networkUpdates', updateId);
        deleteDocumentNonBlocking(updateRef);
        toast({ title: 'Update Deleted', description: 'The network update has been removed.' });
    };
    
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Rss className="h-6 w-6" />
                    <div>
                        <CardTitle className="text-xl">Network Update Management</CardTitle>
                        <CardDescription>
                            Add, remove, and manage homepage network updates.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <form onSubmit={handleAddUpdate} className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold flex items-center gap-2"><PlusCircle className="h-5 w-5" /> Add New Update</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div className="space-y-2 md:col-span-2">
                             <Label htmlFor="update-title">Title</Label>
                             <Input id="update-title" value={newUpdateTitle} onChange={(e) => setNewUpdateTitle(e.target.value)} placeholder="e.g., Service 582 Diversion" required disabled={isSubmitting} />
                         </div>
                         <div className="space-y-2">
                             <Label htmlFor="update-priority">Priority</Label>
                             <Input id="update-priority" type="number" value={newUpdatePriority} onChange={(e) => setNewUpdatePriority(Number(e.target.value))} required disabled={isSubmitting} />
                         </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="update-details">Details</Label>
                        <Textarea id="update-details" value={newUpdateDetails} onChange={(e) => setNewUpdateDetails(e.target.value)} placeholder="Full details of the update..." required disabled={isSubmitting} />
                    </div>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...</> : 'Add Update'}
                    </Button>
                </form>

                <div>
                   <h3 className="font-semibold mb-4">Current Updates</h3>
                    {isLoading && (
                        <div className="flex items-center justify-center py-10 text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            <span>Loading updates...</span>
                        </div>
                    )}
                    {!isLoading && (!updates || updates.length === 0) && (
                        <p className="py-10 text-center text-muted-foreground">No network updates have been added yet.</p>
                    )}
                    {updates && updates.length > 0 && (
                        <div className="space-y-4">
                           {updates.map(update => (
                               <div key={update.id} className="flex items-start gap-4 p-3 border rounded-lg">
                                   <div className="flex-grow space-y-2">
                                        <p className="font-bold">{update.title}</p>
                                        <p className="text-sm text-muted-foreground">{update.details}</p>
                                   </div>
                                   <div className="flex flex-col items-end gap-3 w-40">
                                      <div className="flex items-center space-x-2">
                                          <Label htmlFor={`visible-${update.id}`} className="text-xs">Visible</Label>
                                           <Switch id={`visible-${update.id}`} checked={update.isVisible} onCheckedChange={(isChecked) => handleVisibilityToggle(update, isChecked)} />
                                      </div>
                                       <div className="flex items-center space-x-2">
                                          <Label htmlFor={`priority-${update.id}`} className="text-xs">Priority</Label>
                                          <Input id={`priority-${update.id}`} type="number" defaultValue={update.priority} onBlur={(e) => handlePriorityChange(update.id, e.target.value)} className="h-8 w-16" />
                                       </div>
                                   </div>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteUpdate(update.id)} aria-label="Delete update">
                                        <Trash2 className="h-5 w-5 text-destructive" />
                                    </Button>
                               </div>
                           ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default function AdminPage() {
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  
  const [txcFile, setTxcFile] = useState<File | null>(null);
  const [isUploadingTxc, setIsUploadingTxc] = useState(false);

  const [metroFile, setMetroFile] = useState<File | null>(null);
  const [isUploadingMetro, setIsUploadingMetro] = useState(false);
  
  const auth = useAuth();
  const firestore = useFirestore();
  const { user: currentUser, isUserLoading: isCurrentUserAuthLoading } = useUser();
  const { toast } = useToast();

  const usersCollectionRef = useMemoFirebase(() => collection(firestore, 'userProfiles'), [firestore]);
  const { data: users, isLoading: isUsersLoading } = useCollection<UserProfile>(usersCollectionRef);

  const currentUserProfileRef = useMemoFirebase(() => {
    if (!currentUser) return null;
    return doc(firestore, 'userProfiles', currentUser.uid);
  }, [currentUser, firestore]);
  const { data: currentUserProfile, isLoading: isUserProfileLoading } = useDoc<UserProfile>(currentUserProfileRef);

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

  const handleInviteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inviteEmail) {
      toast({ variant: 'destructive', title: 'Email required' });
      return;
    }
    setIsInviting(true);

    try {
      const invitationsColRef = collection(firestore, 'invitations');
      const newInvitation = {
          email: inviteEmail,
          invitedAt: new Date(),
      };
      const docRef = await addDoc(invitationsColRef, newInvitation);
      const invitationId = docRef.id;

      const actionCodeSettings = {
        url: `${window.location.origin}/finish-sign-up?invitationId=${invitationId}`,
        handleCodeInApp: true,
      };
      
      await sendSignInLinkToEmail(auth, inviteEmail, actionCodeSettings);
      
      toast({
        title: 'Invitation Sent',
        description: `An email has been sent to ${inviteEmail} with instructions to create their account.`,
      });
      setInviteEmail('');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Invitation Failed',
        description: error.message,
      });
    } finally {
      setIsInviting(false);
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
          duration: 300000,
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
  
  if (isCurrentUserAuthLoading || isUserProfileLoading) {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8">
            <Loader2 className="h-12 w-12 animate-spin" />
        </main>
      )
  }

  const isSuperAdmin = currentUser?.email === 'michael.dodsworth@gonorthwest.co.uk';
  const isFullAdmin = currentUserProfile?.isAdmin || isSuperAdmin;

  return (
    <main className="flex min-h-screen flex-col items-center bg-background p-8 gap-8">
       <div className="w-full max-w-4xl space-y-8">
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

        {isFullAdmin ? (
            <>
                <UserManagement users={users} isLoading={isUsersLoading} currentUser={currentUser} />
                
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <UserPlus className="h-6 w-6" />
                            <div>
                                <CardTitle className="text-xl">Invite New User</CardTitle>
                                <CardDescription>
                                  Send an email invitation to a new user to create their account.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleInviteSubmit} className="space-y-4">
                          <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="invite-email">User's Email</Label>
                            <Input
                              id="invite-email"
                              type="email"
                              placeholder="new.user@example.com"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              disabled={isInviting}
                              required
                            />
                          </div>
                          <Button type="submit" disabled={isInviting || !inviteEmail}>
                            {isInviting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Send className="mr-2 h-4 w-4" />
                                Send Invitation
                              </>
                            )}
                          </Button>
                        </form>
                    </CardContent>
                </Card>
                
                <PendingInvitations allUsers={users} usersLoading={isUsersLoading} />

                <NetworkUpdateManagement />

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
            </>
        ) : (
             <NetworkUpdateManagement />
        )}
      </div>
    </main>
  );
}
