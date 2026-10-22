'use client';

import { useEffect } from 'react';
import { prefetchEmulator } from '@/lib/playCache';

export function WarmEmulator() {
  useEffect(() => {
    prefetchEmulator();
  }, []);
  return null;
}
