import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/auth-context';
import { SocketProvider } from '@/contexts/socket-context';
import ClientLayout from '@/components/ClientLayout';
import { AlertMonitor } from '@/components/AlertMonitor';
import { GlobalAlertOverlay } from '@/components/GlobalAlertOverlay';

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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          <SocketProvider>
            <AlertMonitor />
            <GlobalAlertOverlay />
            <ClientLayout>
              <div className="min-h-screen flex flex-col">
                <div className="flex-grow">
                  {children}
                </div>
                <footer className="w-full py-2 bg-background border-t text-center text-[10px] font-medium text-muted-foreground flex-shrink-0">
                  &copy; Michael Dodsworth 2026
                </footer>
              </div>
            </ClientLayout>
          </SocketProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
