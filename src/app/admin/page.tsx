
'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Home, Users, Clock, XCircle, Rss, Trash2, LogOut, ShieldAlert, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking, useUser, useAuth, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, Timestamp, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { sendSignInLinkToEmail, User } from 'firebase/auth';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { NetworkUpdate, MonitoredHazard } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';

interface UserProfile {
  id: string;
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

function UserManagement({ currentUser }: { currentUser: User | null }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const usersCollectionRef = useMemoFirebase(() => collection(firestore, 'userProfiles'), [firestore]);
  const { data: users, isLoading } = useCollection<UserProfile>(usersCollectionRef);

  const handleAdminToggle = (user: UserProfile, isAdmin: boolean) => {
    if (user.uid === currentUser?.uid) {
      toast({ variant: 'destructive', title: 'Action Forbidden', description: "You cannot change your own admin status." });
      return;
    }
    const userDocRef = doc(firestore, 'userProfiles', user.id);
    updateDocumentNonBlocking(userDocRef, { isAdmin });
    toast({ title: 'User Updated', description: `${user.displayName} has been ${isAdmin ? 'granted' : 'revoked'} admin privileges.` });
  };
  
  const handleContentCreatorToggle = (user: UserProfile, isContentCreator: boolean) => {
    const userDocRef = doc(firestore, 'userProfiles', user.id);
    const updateData: any = { isContentCreator };
    if (isContentCreator) updateData.isActive = true;
    
    updateDocumentNonBlocking(userDocRef, updateData);
    toast({ title: 'User Updated', description: `${user.displayName} has been ${isContentCreator ? 'granted' : 'revoked'} content creator privileges.` });
  };

  const handleActiveToggle = (user: UserProfile, isActive: boolean) => {
    if (user.uid === currentUser?.uid) {
      toast({ variant: 'destructive', title: 'Action Forbidden', description: "You cannot change your own activation status." });
      return;
    }
    const userDocRef = doc(firestore, 'userProfiles', user.id);
    updateDocumentNonBlocking(userDocRef, { isActive });
    toast({ title: 'User Updated', description: `${user.displayName}'s account has been ${isActive ? 'activated' : 'deactivated'}.` });
  };

  const handlePasswordChangeToggle = (user: UserProfile, required: boolean) => {
    const userDocRef = doc(firestore, 'userProfiles', user.id);
    updateDocumentNonBlocking(userDocRef, { passwordChangeRequired: required });
    toast({ title: 'User Updated', description: `${user.displayName} will ${required ? 'be required to' : 'not be required to'} change their password on next login.` });
  };

  const handleForceSignOut = (user: UserProfile) => {
    if (user.uid === currentUser?.uid) {
      toast({ variant: 'destructive', title: 'Action Forbidden', description: "You cannot force sign out yourself." });
      return;
    }
    const userDocRef = doc(firestore, 'userProfiles', user.id);
    updateDocumentNonBlocking(userDocRef, { forceSignOut: true });
    toast({ title: 'User Session Flagged', description: `${user.displayName} will be signed out on their next page load.` });
  };

  const handleDeleteUser = async (user: UserProfile) => {
    try {
        const userDocRef = doc(firestore, 'userProfiles', user.id);
        await updateDoc(userDocRef, { 
            isAdmin: false, 
            isContentCreator: false, 
            isActive: false, 
            forceSignOut: true 
        });
        deleteDocumentNonBlocking(userDocRef);
        const invitationsRef = collection(firestore, 'invitations');
        const q = query(invitationsRef, where("email", "==", user.email));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((invDoc) => {
            deleteDocumentNonBlocking(doc(firestore, 'invitations', invDoc.id));
        });
        toast({ title: 'User Deleted' });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Deletion Failed' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6" />
          <div>
            <CardTitle className="text-xl">User Management</CardTitle>
            <CardDescription>Manage user roles, access, and account status.</CardDescription>
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
                <TableHead>Pass Change</TableHead>
                <TableHead>Content Creator</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-xs">{user.displayName}</TableCell>
                  <TableCell className="text-xs">{user.email}</TableCell>
                   <TableCell>
                     <Switch checked={user.isActive} onCheckedChange={(v) => handleActiveToggle(user, v)} disabled={user.email === 'michael.dodsworth@gonorthwest.co.uk'} />
                  </TableCell>
                  <TableCell>
                     <Switch checked={user.passwordChangeRequired} onCheckedChange={(v) => handlePasswordChangeToggle(user, v)} disabled={user.email === 'michael.dodsworth@gonorthwest.co.uk'} />
                  </TableCell>
                  <TableCell>
                     <Switch checked={user.isContentCreator} onCheckedChange={(v) => handleContentCreatorToggle(user, v)} disabled={user.email === 'michael.dodsworth@gonorthwest.co.uk'} />
                  </TableCell>
                  <TableCell>
                     <Switch checked={user.isAdmin} onCheckedChange={(v) => handleAdminToggle(user, v)} disabled={user.email === 'michael.dodsworth@gonorthwest.co.uk'} />
                  </TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleForceSignOut(user)} title="Force Sign Out" disabled={user.email === 'michael.dodsworth@gonorthwest.co.uk' || user.uid === currentUser?.uid}>
                        <LogOut className="h-4 w-4 text-destructive" />
                    </Button>
                    
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Delete User" disabled={user.email === 'michael.dodsworth@gonorthwest.co.uk' || user.uid === currentUser?.uid}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete User Account?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will strip all privileges and permanently delete {user.displayName}'s profile.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteUser(user)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Confirm Deletion
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
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

function PendingInvitations() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const invitationsColRef = useMemoFirebase(() => collection(firestore, 'invitations'), [firestore]);
    const { data: invitations, isLoading } = useCollection<Invitation>(invitationsColRef);

    const handleCancelInvite = (id: string) => {
        deleteDocumentNonBlocking(doc(firestore, 'invitations', id));
        toast({ title: 'Invitation Revoked' });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Clock className="h-6 w-6" />
                    <CardTitle className="text-xl">Pending Invitations</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? <Loader2 className="animate-spin" /> : (
                    <Table>
                        <TableBody>
                            {invitations?.map((invite) => (
                                <TableRow key={invite.id}>
                                    <TableCell>{invite.email}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleCancelInvite(invite.id)}>
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

function GeofenceManagement() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const hazardsRef = useMemoFirebase(() => collection(firestore, 'monitoredHazards'), [firestore]);
    const { data: monitored, isLoading } = useCollection<MonitoredHazard>(hazardsRef);

    const handleRemove = (id: string) => {
        deleteDocumentNonBlocking(doc(firestore, 'monitoredHazards', id));
        toast({ title: 'Monitor Removed' });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3 text-primary">
                    <ShieldAlert className="h-6 w-6" />
                    <CardTitle className="text-xl">Active Geofence Monitors</CardTitle>
                </div>
                <CardDescription>Hazards currently triggering alerts for GNW vehicles.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? <Loader2 className="animate-spin mx-auto" /> : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Restriction</TableHead>
                                <TableHead>Area/Center</TableHead>
                                <TableHead>Radius</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {monitored?.map((m) => (
                                <TableRow key={m.id}>
                                    <TableCell>
                                        <Badge variant="outline" className="mr-2 uppercase">{m.type}</Badge>
                                        <span className="font-bold">{m.value}</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-xs truncate max-w-[150px]">{m.description}</span>
                                            {m.geofenceCenter ? (
                                                <span className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                                                    <MapPin className="h-2 w-2" /> Custom Center Set
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground italic">Default Center</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{m.radius}m</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleRemove(m.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {monitored?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        No active geofences. Go to the Map to add some.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}

function NetworkUpdateManagement() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const updatesQuery = useMemoFirebase(() => collection(firestore, 'networkUpdates'), [firestore]);
    const { data: allUpdates, isLoading } = useCollection<NetworkUpdate>(updatesQuery);

    const updates = useMemo(() => {
        if (!allUpdates) return null;
        return [...allUpdates].sort((a, b) => (a.priority - b.priority) || (b.createdAt?.seconds - a.createdAt?.seconds));
    }, [allUpdates]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'networkUpdates'), {
                title, details, priority: 0, isVisible: true, createdAt: serverTimestamp(),
            });
            toast({ title: 'Update Added' });
            setTitle(''); setDetails('');
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Rss className="h-6 w-6" />
                    <CardTitle className="text-xl">Network Update Management</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <form onSubmit={handleAdd} className="space-y-4 p-4 border rounded-lg">
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required disabled={isSubmitting} />
                    <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Details" required disabled={isSubmitting} />
                    <Button type="submit" disabled={isSubmitting}>Add Update</Button>
                </form>
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
                    ) : updates?.map(update => (
                        <div key={update.id} className="flex items-start gap-4 p-3 border rounded-lg">
                            <div className="flex-grow">
                                <p className="font-bold">{update.title}</p>
                                <p className="text-sm text-muted-foreground">{update.details}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => deleteDocumentNonBlocking(doc(firestore, 'networkUpdates', update.id))}>
                                <Trash2 className="h-5 w-5 text-destructive" />
                            </Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

export default function AdminPage() {
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const auth = useAuth();
  const firestore = useFirestore();
  const { user: currentUser, isUserLoading: isAuthLoading } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => currentUser ? doc(firestore, 'userProfiles', currentUser.uid) : null, [currentUser, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    try {
      const docRef = await addDoc(collection(firestore, 'invitations'), { email: inviteEmail, invitedAt: new Date() });
      await sendSignInLinkToEmail(auth, inviteEmail, { url: `${window.location.origin}/finish-sign-up?invitationId=${docRef.id}`, handleCodeInApp: true });
      toast({ title: 'Invitation Sent' });
      setInviteEmail('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsInviting(false);
    }
  };

  if (isAuthLoading || isProfileLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  const isSuperAdmin = currentUser?.email === 'michael.dodsworth@gonorthwest.co.uk';
  const isFullAdmin = !!userProfile?.isAdmin || isSuperAdmin;
  const isContentCreator = userProfile?.isContentCreator === true;

  return (
    <main className="flex min-h-screen flex-col items-center bg-background p-8 gap-8">
       <div className="w-full max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-foreground">OCC App Admin</h1>
            <Button asChild variant="outline"><Link href="/"><Home className="mr-2 h-5 w-5" />Home</Link></Button>
        </div>

        {isFullAdmin ? (
            <>
                <UserManagement currentUser={currentUser} />
                <Card>
                    <CardHeader><CardTitle className="text-xl">Invite New User</CardTitle></CardHeader>
                    <CardContent>
                        <form onSubmit={handleInvite} className="flex gap-4">
                            <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email" required disabled={isInviting} />
                            <Button type="submit" disabled={isInviting}>Invite</Button>
                        </form>
                    </CardContent>
                </Card>
                <PendingInvitations />
                <GeofenceManagement />
                <NetworkUpdateManagement />
            </>
        ) : isContentCreator ? (
             <NetworkUpdateManagement />
        ) : (
            <Card>
              <CardHeader>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>You do not have administrative or content management permissions.</CardDescription>
              </CardHeader>
            </Card>
        )}
      </div>
    </main>
  );
}
