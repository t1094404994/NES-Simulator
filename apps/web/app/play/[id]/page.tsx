'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Emulator } from '@/components/Emulator';
import { PlayShell } from '@/components/PlayShell';
import { api, coverSrc, type GameItem } from '@/lib/api';
import { loadRom, peekGame, peekRom } from '@/lib/playCache';
import { trackEvent } from '@/lib/track';
import { errorHref, readRomError } from '@/lib/rom';
import { SITE_NAME } from '@/lib/seo';
import { API } from '@nes/shared';

function loadMessage(err: unknown): string {
  if (err instanceof Error) {
    if (!err.message || err.message === 'Failed to fetch') {
      return '无法连接服务器';
    }
    return err.message;
  }
  return '加载失败';
}

export default function PlayPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [rom, setRom] = useState<ArrayBuffer | null>(null);
  const [title, setTitle] = useState('');
  const coverUrl = coverSrc(API.cover(id));
  const pageTitle = title ? `${title} · ${SITE_NAME}` : '';
  const trackedPlay = useRef('');

  useEffect(() => {
    let cancel = false;
    const known = peekGame(id);
    setTitle(known?.title ?? '');
    const cached = peekRom(id);
    if (cached) {
      const problem = readRomError(cached);
      if (problem) {
        router.replace(errorHref(problem));
        return;
      }
      setRom(cached);
    } else {
      setRom(null);
    }
    (async () => {
      const [game, buffer] = await Promise.all([
        fetch(api.game(id)).then(async (response) => {
          if (!response.ok) {
            throw new Error('找不到这款游戏');
          }
          return response.json() as Promise<GameItem>;
        }),
        loadRom(id),
      ]);
      const problem = readRomError(buffer);
      if (problem) {
        throw new Error(problem);
      }
      if (!cancel) {
        setTitle(game.title);
        setRom(buffer);
        if (trackedPlay.current !== id) {
          trackedPlay.current = id;
          void trackEvent(api.trackPlay(), { gameId: id }).catch(() => {});
        }
      }
    })().catch((err: unknown) => {
      if (!cancel) {
        router.replace(errorHref(loadMessage(err)));
      }
    });
    return () => {
      cancel = true;
    };
  }, [id, router]);

  if (!rom) {
    return (
      <>
        {pageTitle ? <title>{pageTitle}</title> : null}
        <PlayShell title={title} coverUrl={coverUrl} />
      </>
    );
  }
  return (
    <>
      {pageTitle ? <title>{pageTitle}</title> : null}
      <Emulator
        rom={rom}
        title={title || 'NES'}
        coverUrl={coverUrl}
        onError={(message) => router.replace(errorHref(message))}
      />
    </>
  );
}
