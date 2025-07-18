// app/layout.tsx
'use client';

import './globals.css';
import { ReactNode } from 'react';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import supabase from '@/lib/supabaseClient';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionContextProvider supabaseClient={supabase}>
          {children}
        </SessionContextProvider>
      </body>
    </html>
  );
}
