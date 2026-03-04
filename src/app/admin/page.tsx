
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Home, Users, Clock, XCircle, Rss, Trash2, LogOut, ShieldAlert, MapPin, History, Pencil, Smile, Bold, Italic, Underline, Palette, Type, Plus, FileUp, Database } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useSocket } from '@/contexts/socket-context';
import { SOCKET_EVENTS } from '@/lib/socket/events';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { NetworkUpdate, MonitoredHazard } from '@/lib/types';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isContentCreator: boolean;
  isActive: boolean;
  passwordChangeRequired: boolean;
  forceSignOut: boolean;
}

interface Invitation {
    id: string;
    email: string;
    invitedAt: string;
}

function UserManagement({ currentUserId }: { currentUserId: string }) {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { on, off } = useSocket();

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (e) {
      console.error('Failed to fetch users', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const handler = () => fetchUsers();
    on(SOCKET_EVENTS.USER_UPDATED, handler);
    return () => off(SOCKET_EVENTS.USER_UPDATED, handler);
  }, [on, off]);

  const patchUser = async (userId: string, data: Partial<UserProfile>) => {
    await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  };

  const handleAdminToggle = (user: UserProfile, isAdmin: boolean) => {
    if (user.id === currentUserId) {
      toast({ variant: 'destructive', title: 'Action Forbidden', description: "You cannot change your own admin status." });
      return;
    }
    patchUser(user.id, { isAdmin });
    toast({ title: 'User Updated', description: `${user.displayName} has been ${isAdmin ? 'granted' : 'revoked'} admin privileges.` });
  };
  
  const handleContentCreatorToggle = (user: UserProfile, isContentCreator: boolean) => {
    const updateData: any = { isContentCreator };
    if (isContentCreator) updateData.isActive = true;
    patchUser(user.id, updateData);
    toast({ title: 'User Updated', description: `${user.displayName} has been ${isContentCreator ? 'granted' : 'revoked'} content creator privileges.` });
  };

  const handleActiveToggle = (user: UserProfile, isActive: boolean) => {
    if (user.id === currentUserId) {
      toast({ variant: 'destructive', title: 'Action Forbidden', description: "You cannot change your own activation status." });
      return;
    }
    patchUser(user.id, { isActive });
    toast({ title: 'User Updated', description: `${user.displayName}'s account has been ${isActive ? 'activated' : 'deactivated'}.` });
  };

  const handlePasswordChangeToggle = (user: UserProfile, required: boolean) => {
    patchUser(user.id, { passwordChangeRequired: required });
    toast({ title: 'User Updated', description: `${user.displayName} will ${required ? 'be required to' : 'not be required to'} change their password on next login.` });
  };

  const handleForceSignOut = (user: UserProfile) => {
    if (user.id === currentUserId) {
      toast({ variant: 'destructive', title: 'Action Forbidden', description: "You cannot force sign out yourself." });
      return;
    }
    patchUser(user.id, { forceSignOut: true });
    toast({ title: 'User Session Flagged', description: `${user.displayName} will be signed out on their next page load.` });
  };

  const handleDeleteUser = async (user: UserProfile) => {
    try {
      await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
      toast({ title: 'User Deletion Initiated' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Delete Failed' });
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
                     <Switch checked={user.isActive} onCheckedChange={(v) => handleActiveToggle(user, v)} disabled={user.isSuperAdmin} />
                  </TableCell>
                  <TableCell>
                     <Switch checked={user.passwordChangeRequired} onCheckedChange={(v) => handlePasswordChangeToggle(user, v)} disabled={user.isSuperAdmin} />
                  </TableCell>
                  <TableCell>
                     <Switch checked={user.isContentCreator} onCheckedChange={(v) => handleContentCreatorToggle(user, v)} disabled={user.isSuperAdmin} />
                  </TableCell>
                  <TableCell>
                     <Switch checked={user.isAdmin} onCheckedChange={(v) => handleAdminToggle(user, v)} disabled={user.isSuperAdmin} />
                  </TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleForceSignOut(user)} title="Force Sign Out" disabled={user.isSuperAdmin || user.id === currentUserId}>
                        <LogOut className="h-4 w-4 text-destructive" />
                    </Button>
                    
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Delete User" disabled={user.isSuperAdmin || user.id === currentUserId}>
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

function GTFSUpload() {
    const { toast } = useToast();
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload-gtfs', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (response.ok) {
                toast({ title: 'GTFS Upload Successful', description: data.message });
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Database className="h-6 w-6" />
                    <div>
                        <CardTitle className="text-xl">GTFS Data Management</CardTitle>
                        <CardDescription>Upload a GTFS ZIP file to update network routes and geometry.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-4">
                    <Input 
                        type="file" 
                        accept=".zip" 
                        onChange={handleUpload} 
                        disabled={isUploading}
                        ref={fileInputRef}
                        className="max-w-sm"
                    />
                    {isUploading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                </div>
                <p className="text-[10px] text-muted-foreground mt-4 italic">
                    Note: Expected files within ZIP: routes.txt, trips.txt, shapes.txt.
                </p>
            </CardContent>
        </Card>
    );
}

function PendingInvitations() {
    const { toast } = useToast();
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchInvitations = async () => {
        try {
            const res = await fetch('/api/invitations');
            if (res.ok) {
                const data = await res.json();
                setInvitations(data.invitations);
            }
        } catch (e) {
            console.error('Failed to fetch invitations', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchInvitations(); }, []);

    const handleCancelInvite = async (id: string) => {
        await fetch(`/api/invitations/${id}`, { method: 'DELETE' });
        setInvitations(prev => prev.filter(i => i.id !== id));
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
    const { toast } = useToast();
    const [monitored, setMonitored] = useState<MonitoredHazard[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { on, off } = useSocket();

    const fetchHazards = async () => {
        try {
            const res = await fetch('/api/monitored-hazards');
            if (res.ok) {
                const data = await res.json();
                setMonitored(data.hazards);
            }
        } catch (e) {
            console.error('Failed to fetch hazards', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchHazards(); }, []);

    useEffect(() => {
        const handler = () => fetchHazards();
        on(SOCKET_EVENTS.HAZARD_CHANGED, handler);
        return () => off(SOCKET_EVENTS.HAZARD_CHANGED, handler);
    }, [on, off]);

    const handleRemove = async (id: string) => {
        await fetch(`/api/monitored-hazards/${id}`, { method: 'DELETE' });
        setMonitored(prev => prev.filter(m => m.id !== id));
        toast({ title: 'Monitor Removed' });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-primary">
                      <ShieldAlert className="h-6 w-6" />
                      <CardTitle className="text-xl">Active Geofence Monitors</CardTitle>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/rra"><History className="mr-2 h-4 w-4" />View Breach History</Link>
                  </Button>
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

const TRANSPORT_EMOJIS = ['🚌', '🚍', '🛑', '⚠️', '🚧', '🕒', '📅', '📍', '📢', '🔧', '🚦', '🏁', '✅', '❌', 'ℹ️', '🆘', '🛠️', '💧', '❄️', '🔥'];

/**
 * Custom Native Rich Text Editor component.
 * Uses contentEditable to avoid library dependency issues with React 19.
 */
function RichTextEditor({ value, onChange, placeholder, editorRef }: { value: string, onChange: (v: string) => void, placeholder: string, editorRef: React.RefObject<HTMLDivElement | null> }) {
  
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value, editorRef]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const exec = (cmd: string, val?: string) => {
    if (typeof window !== 'undefined') {
        document.execCommand(cmd, false, val);
        handleInput();
    }
  };

  return (
    <div className="border rounded-md overflow-hidden bg-background">
      <div className="flex flex-wrap items-center gap-1 p-1 bg-muted/20 border-b">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => exec('bold')} title="Bold">
            <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => exec('italic')} title="Italic">
            <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => exec('underline')} title="Underline">
            <Underline className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Select onValueChange={(v) => exec('foreColor', v)}>
          <SelectTrigger className="h-8 w-[100px] text-[10px] font-bold uppercase">
            <Palette className="h-3 w-3 mr-1" /> Color
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inherit">Default</SelectItem>
            <SelectItem value="#ef4444">Red</SelectItem>
            <SelectItem value="#3b82f6">Blue</SelectItem>
            <SelectItem value="#10b981">Green</SelectItem>
            <SelectItem value="#f59e0b">Orange</SelectItem>
          </SelectContent>
        </Select>
        <Select onValueChange={(v) => exec('fontSize', v)}>
          <SelectTrigger className="h-8 w-[100px] text-[10px] font-bold uppercase">
            <Type className="h-3 w-3 mr-1" /> Size
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2">Small</SelectItem>
            <SelectItem value="3">Normal</SelectItem>
            <SelectItem value="5">Large</SelectItem>
            <SelectItem value="7">Huge</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="p-3 min-h-[150px] focus:outline-none rich-content text-sm"
        style={{ whiteSpace: 'pre-wrap' }}
      />
      {(!value || value === '<br>') && (
          <div className="absolute top-[100px] left-3 pointer-events-none text-muted-foreground/50 text-sm">
              {placeholder}
          </div>
      )}
    </div>
  );
}

function NetworkUpdateManagement() {
    const { toast } = useToast();
    const { on, off } = useSocket();
    const [title, setTitle] = useState('');
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const editorRef = useRef<HTMLDivElement>(null);

    const [allUpdates, setAllUpdates] = useState<NetworkUpdate[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchUpdates = async () => {
        try {
            const res = await fetch('/api/network-updates');
            if (res.ok) {
                const data = await res.json();
                setAllUpdates(data.updates);
            }
        } catch (e) {
            console.error('Failed to fetch updates', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchUpdates(); }, []);

    useEffect(() => {
        const handler = () => fetchUpdates();
        on(SOCKET_EVENTS.NETWORK_UPDATE_CHANGED, handler);
        return () => off(SOCKET_EVENTS.NETWORK_UPDATE_CHANGED, handler);
    }, [on, off]);

    const updates = useMemo(() => {
        if (!allUpdates) return null;
        return [...allUpdates].sort((a: any, b: any) => {
            const pa = a.priority ?? 0;
            const pb = b.priority ?? 0;
            if (pa !== pb) return pa - pb;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [allUpdates]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            if (editingId) {
                await fetch(`/api/network-updates/${editingId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, details }),
                });
                toast({ title: 'Update Updated', description: 'Your changes have been saved.' });
            } else {
                await fetch('/api/network-updates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, details, priority: 0, isVisible: true }),
                });
                toast({ title: 'Update Added' });
            }
            setTitle('');
            setDetails('');
            setEditingId(null);
            setIsFormVisible(false);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save update.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (update: NetworkUpdate) => {
        setTitle(update.title);
        setDetails(update.details);
        setEditingId(update.id);
        setIsFormVisible(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setTitle('');
        setDetails('');
        setEditingId(null);
        setIsFormVisible(false);
    };

    const insertEmoji = (emoji: string) => {
        if (editorRef.current) {
            editorRef.current.focus();
            document.execCommand('insertText', false, emoji);
            setDetails(editorRef.current.innerHTML);
        } else {
            setDetails(prev => prev + emoji);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Rss className="h-6 w-6" />
                        <CardTitle className="text-xl">Network Update Management</CardTitle>
                    </div>
                    {!isFormVisible && !editingId && (
                        <Button onClick={() => setIsFormVisible(true)} size="sm">
                            <Plus className="mr-2 h-4 w-4" /> Create Update
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {(isFormVisible || editingId) && (
                    <form onSubmit={handleSubmit} className={`space-y-4 p-4 border rounded-lg animate-in fade-in slide-in-from-top-2 duration-300 ${editingId ? 'bg-primary/5 border-primary/20' : ''}`}>
                        <div className="flex items-center justify-between">
                            <Label className="font-bold text-sm uppercase tracking-wider">{editingId ? 'Edit Network Update' : 'Create New Update'}</Label>
                            {(editingId || isFormVisible) && (
                                <Button type="button" variant="ghost" size="sm" onClick={handleCancelEdit}>Cancel</Button>
                            )}
                        </div>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Update Title" required disabled={isSubmitting} />
                        
                        <div className="space-y-2 relative">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground font-bold">Details & Information</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button type="button" variant="outline" size="sm" className="h-7 px-2">
                                            <Smile className="h-4 w-4 mr-1" /> Emojis
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-2" side="top">
                                        <div className="grid grid-cols-5 gap-1">
                                            {TRANSPORT_EMOJIS.map(emoji => (
                                                <button 
                                                    key={emoji} 
                                                    type="button"
                                                    onClick={() => insertEmoji(emoji)}
                                                    className="text-xl hover:bg-accent p-1 rounded transition-colors"
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            
                            <RichTextEditor 
                                value={details} 
                                onChange={setDetails} 
                                placeholder="Enter detailed network alert here..."
                                editorRef={editorRef}
                            />
                        </div>

                        <Button type="submit" disabled={isSubmitting} className="w-full">
                            {editingId ? 'Save Changes' : 'Add Update'}
                        </Button>
                    </form>
                )}
                
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
                    ) : updates?.map(update => (
                        <div key={update.id} className="flex items-start gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex-grow min-w-0">
                                <p className="font-bold">{update.title}</p>
                                <div 
                                    className="text-xs text-muted-foreground line-clamp-2 mt-1 rich-content"
                                    dangerouslySetInnerHTML={{ __html: update.details }} 
                                />
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(update)} title="Edit Entry">
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => {
                                    fetch(`/api/network-updates/${update.id}`, { method: 'DELETE' });
                                }} title="Delete Entry">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
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
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create invitation');
      }
      toast({ title: 'Invitation Created', description: `Share the invitation link with ${inviteEmail} to complete sign-up.` });
      setInviteEmail('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Invitation Failed', description: error.message });
    } finally {
      setIsInviting(false);
    }
  };

  if (isAuthLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  const isSuperAdmin = user?.isSuperAdmin;
  const isFullAdmin = !!user?.isAdmin || isSuperAdmin;
  const isContentCreator = user?.isContentCreator === true;

  return (
    <main className="flex min-h-screen flex-col items-center bg-background p-8 gap-8">
       <div className="w-full max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-foreground">OCC App Admin</h1>
            <Button asChild variant="outline"><Link href="/"><Home className="mr-2 h-5 w-5" />Home</Link></Button>
        </div>

        {isFullAdmin ? (
            <>
                <UserManagement currentUserId={user?.id || ''} />
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
                <GTFSUpload />
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
