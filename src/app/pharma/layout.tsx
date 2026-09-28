'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './_components/Sidebar';
import { useAuth } from '@/context/auth-context';
import { api } from '@/lib/api-client';

export default function PharmaLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [brandName, setBrandName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("pharma_business_name") || "";
    }
    return "";
  });
  const [logoUrl, setLogoUrl] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("pharma_logo") || undefined;
    }
    return undefined;
  });

  const updateBrand = useCallback(() => {
    try {
      const savedName = localStorage.getItem("pharma_business_name");
      const savedLogo = localStorage.getItem("pharma_logo");
      if (savedName) setBrandName(savedName);
      if (savedLogo) setLogoUrl(savedLogo);
      else setLogoUrl(undefined);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    updateBrand();
    window.addEventListener("pharma_org_updated", updateBrand);
    window.addEventListener("storage", updateBrand);
    return () => {
      window.removeEventListener("pharma_org_updated", updateBrand);
      window.removeEventListener("storage", updateBrand);
    };
  }, [updateBrand]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    async function loadOrg() {
      try {
        const res = await api.get('/api/organization');
        const org = res.data?.organization;
        if (!isMounted || !org) return;

        if (org.businessName) {
          setBrandName(org.businessName);
          localStorage.setItem("pharma_business_name", org.businessName);
        }
        if (org.logoUrl) {
          setLogoUrl(org.logoUrl);
          localStorage.setItem("pharma_logo", org.logoUrl);
        } else {
          setLogoUrl(undefined);
          localStorage.removeItem("pharma_logo");
        }
      } catch (err) {
        console.error("Failed to load organization for layout:", err);
      }
    }

    loadOrg();

    return () => {
      isMounted = false;
    };
  }, [user]);

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
    <div className="flex min-h-screen bg-zinc-50 print:bg-white print:min-h-0 print:block">
      <Sidebar
        brandName={brandName}
        logoUrl={logoUrl}
        user={{ name: user.name, email: user.email }}
      />

      <main className="flex-1 min-w-0 p-3.5 sm:p-5 md:p-6 pt-[4.5rem] md:pt-6 print:p-0 print:pt-0 print:m-0 print:w-full">
        {children}
      </main>
    </div>
  );
}