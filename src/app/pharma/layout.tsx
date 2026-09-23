'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './_components/Sidebar';
import { useAuth } from '@/context/auth-context';

export default function PharmaLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return null; // redirect is in flight
  }

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar
        brandName="Pharma"
        user={{ name: user.name, email: user.email }}
      />

      <main className="flex-1 p-6 pt-20 md:pt-6">
        {children}
      </main>
    </div>
  );
}