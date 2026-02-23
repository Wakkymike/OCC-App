
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
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
        <FirebaseClientProvider>
          <AlertMonitor />
          <GlobalAlertOverlay />
          <ClientLayout>{children}</ClientLayout>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
