'use client';

import { Theme } from '@radix-ui/themes';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <Theme appearance="dark" accentColor="orange" grayColor="sand" radius="medium">
      {children}
    </Theme>
  );
}
