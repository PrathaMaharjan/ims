'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './_components/Sidebar';
import { useAuth } from '@/context/auth-context';

export default function PharmaLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [brandName, setBrandName] = useState("pharma");
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    const updateBrand = () => {
      try {
        const savedName = localStorage.getItem("pharma_business_name");
        const savedLogo = localStorage.getItem("pharma_logo");
        if (savedName) setBrandName(savedName);
        if (savedLogo) setLogoUrl(savedLogo);
        else setLogoUrl(undefined);
      } catch (e) {
        console.error(e);
      }
    };

    updateBrand();
    window.addEventListener("pharma_org_updated", updateBrand);
    window.addEventListener("storage", updateBrand);
    return () => {
      window.removeEventListener("pharma_org_updated", updateBrand);
      window.removeEventListener("storage", updateBrand);
    };
  }, []);

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
        brandName={brandName}
        logoUrl={logoUrl}
        user={{ name: user.name, email: user.email }}
      />

      <main className="flex-1 p-6 pt-20 md:pt-6">
        {children}
      </main>
    </div>
  );
}