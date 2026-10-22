'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { PlayShell } from '@/components/PlayShell';
import { stripLocale } from '@/lib/i18n';
import { coverSrc } from '@/lib/api';
import { peekGame } from '@/lib/playCache';
import { API } from '@nes/shared';

function playId(pathname: string): string {
  const parts = stripLocale(pathname).split('/').filter(Boolean);
  if (parts[0] !== 'play' || !parts[1] || parts[1] === 'local') {
    return '';
  }
  return parts[1];
}

export default function PlayLoading() {
  const pathname = usePathname();
  const id = playId(pathname);
  const [title, setTitle] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(id ? coverSrc(API.cover(id)) : null);

  useEffect(() => {
    const known = peekGame(id);
    if (!known) {
      return;
    }
    setTitle(known.title);
    if (!id) {
      setCoverUrl(coverSrc(known.coverUrl));
    }
  }, [id]);

  return <PlayShell title={title} coverUrl={coverUrl} />;
}
