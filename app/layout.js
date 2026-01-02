import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

// Force dynamic rendering for all pages (Clerk requires runtime env vars)
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Supercane Dashboard',
  description: 'Vending Machine Management Dashboard',
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          {children}
          <Toaster position="top-right" richColors />
        </body>
      </html>
    </ClerkProvider>
  );
}
