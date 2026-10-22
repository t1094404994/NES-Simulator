import { SiteHeader } from '@/components/SiteHeader';
import type { ReactNode } from 'react';

export default function BrowseLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
