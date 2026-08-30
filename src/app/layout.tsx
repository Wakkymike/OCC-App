import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/auth-context';
import { SocketProvider } from '@/contexts/socket-context';
import ClientLayout from '@/components/ClientLayout';
import { AlertMonitor } from '@/components/AlertMonitor';
import { GlobalAlertOverlay } from '@/components/GlobalAlertOverlay';
import { IrcProvider } from '@/contexts/irc-context';
import ChatBubble from '@/components/ChatBubble';
import SideNav from '@/components/SideNav';
import { ThemeProvider } from '@/contexts/theme-context';
import PersistentMapView from '@/components/PersistentMapView';
import { BusFront, RadioTower } from 'lucide-react';

export const metadata: Metadata = {
  title: 'OCC App',
  description: 'Live bus tracking and service information.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Public+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <IrcProvider>
              <AlertMonitor />
              <GlobalAlertOverlay />
              <Suspense fallback={null}>
              <PersistentMapView />
              </Suspense>
              <div className="app-shell flex min-h-screen">
                <SideNav />
                <div className="flex-1 min-w-0 flex flex-col occ-content-surface">
                  <header className="border-b border-border/80 bg-card/90 px-4 py-3 backdrop-blur md:px-8">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                          <BusFront className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-headline text-2xl leading-none tracking-wide text-primary">TfGM Bus Operations</p>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Network Control Centre Dashboard</p>
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                        <RadioTower className="h-3.5 w-3.5" />
                        Live Service Monitoring
                      </div>
                    </div>
                  </header>
                  <ClientLayout>
                    <div className="flex-grow occ-page-wrap">
                      {children}
                    </div>
                    <footer className="w-full py-2 bg-background border-t text-center text-[10px] font-medium text-muted-foreground flex-shrink-0">
                      &copy; Michael Dodsworth 2026
                    </footer>
                  </ClientLayout>
                </div>
              </div>
              <ChatBubble />
            </IrcProvider>
          </SocketProvider>
        </AuthProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
