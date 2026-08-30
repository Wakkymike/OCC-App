'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useTheme, THEMES } from '@/contexts/theme-context';
import UserMenu from '@/components/auth/UserMenu';
import {
  Map,
  ShieldAlert,
  ClipboardList,
  Route,
  Calendar,
  Clock,
  Radio,
  Shield,
  Home,
  Palette,
  BusFront,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  variant?: 'default' | 'destructive';
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: <Home className="h-5 w-5" /> },
  { href: '/map', label: 'Live Bus Map', icon: <Map className="h-5 w-5" /> },
  {
    href: '/rra',
    label: 'RRA Dashboard',
    icon: <ShieldAlert className="h-5 w-5" />,
    variant: 'destructive',
  },
  { href: '/call-logs', label: 'Call Logs', icon: <ClipboardList className="h-5 w-5" /> },
  { href: '/journey-planner', label: 'Journey Planner', icon: <Route className="h-5 w-5" /> },
  { href: '/shifts', label: 'My Shifts', icon: <Calendar className="h-5 w-5" /> },
  { href: '/drivers-hours', label: 'Drivers Hours', icon: <Clock className="h-5 w-5" /> },
  { href: '/timetable', label: 'Live Service Board', icon: <Radio className="h-5 w-5" /> },
  { href: '/metrolink-departures', label: 'Metrolink Departures', icon: <Radio className="h-5 w-5" /> },
  {
    href: '/admin',
    label: 'Admin Panel',
    icon: <Shield className="h-5 w-5" />,
    adminOnly: true,
  },
];

export default function SideNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const isSuperAdmin = user?.isSuperAdmin;
  const isAdmin = user?.isAdmin === true || isSuperAdmin;
  const isContentCreator = user?.isContentCreator === true;
  const canAccessAdmin = isAdmin || isContentCreator;

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !canAccessAdmin) return false;
    return true;
  });

  return (
    <aside className="h-screen sticky top-0 shrink-0 border-r border-sidebar-border bg-sidebar/95 flex flex-col w-20 md:w-72 transition-[width] duration-200">
      {/* Header */}
      <div className="px-3 md:px-5 pt-4 pb-3 border-b border-sidebar-border">
        <div className="hidden md:flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BusFront className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="font-headline text-xl leading-none text-sidebar-foreground">TfGM OCC</h2>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-foreground/70">Navigation</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 md:px-3">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          const isDestructive = item.variant === 'destructive';

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 border ${
                isActive
                  ? isDestructive
                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                    : 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : isDestructive
                    ? 'text-destructive border-transparent hover:bg-destructive/5'
                    : 'text-sidebar-foreground border-transparent hover:bg-sidebar-accent'
              }`}
            >
              <span className={`shrink-0 ${isActive ? '' : 'opacity-80'}`}>{item.icon}</span>
              <span className="hidden md:inline truncate">{item.label}</span>
              {isDestructive && (
                <span className="ml-auto h-2 w-2 rounded-full bg-destructive animate-pulse hidden md:block" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer — Theme switcher + User menu */}
      <div className="border-t border-sidebar-border p-2 md:p-3 space-y-3">
        {/* Theme selector */}
        <div className="flex flex-col items-center md:items-stretch">
          <div className="hidden md:flex items-center gap-1.5 mb-1.5 px-1">
            <Palette className="h-3.5 w-3.5 text-sidebar-foreground/70" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/70">Theme</span>
          </div>
          <div className="md:hidden flex justify-center mb-1">
            <Palette className="h-4 w-4 text-sidebar-foreground/70" />
          </div>
          <div className="flex flex-col gap-0.5">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                title={`${t.label} — ${t.description}`}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                  theme === t.id
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
              >
                <span className={`h-3 w-3 rounded-full border shrink-0 ${
                  theme === t.id ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                }`}
                  style={{
                    backgroundColor:
                      t.id === 'light' ? '#f0f0f0'
                      : t.id === 'medium' ? '#b0b8c4'
                      : t.id === 'dark' ? '#1e293b'
                      : t.id === 'high-contrast' ? '#ffffff'
                      : '#f5efe6',
                    ...(t.id === 'high-contrast' ? { border: '2px solid #000' } : {}),
                  }}
                />
                <span className="hidden md:inline truncate">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* User menu */}
        <div className="flex items-center gap-3">
          <UserMenu />
          <div className="hidden md:block min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{user.displayName || 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
