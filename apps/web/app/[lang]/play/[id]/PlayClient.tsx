'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Emulator } from '@/components/Emulator';
import { PlayShell } from '@/components/PlayShell';
import { api, coverSrc, type GameItem } from '@/lib/api';
import { loadRom, peekGame, peekRom, rememberGame } from '@/lib/playCache';
import { trackEvent } from '@/lib/track';
import { errorHref, readRomError } from '@/lib/rom';
import { useI18n } from '@/app/providers';
import { API } from '@nes/shared';

function loadMessage(err: unknown): string {
  if (err instanceof Error) {
    if (!err.message || err.message === 'Failed to fetch') {
      return 'SERVER_UNREACHABLE';
    }
    return err.message;
  }
  return 'LOAD_FAILED';
}

export function PlayClient({ initialGame }: { initialGame: GameItem | null }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { locale } = useI18n();
  const id = params.id;
  const [rom, setRom] = useState<ArrayBuffer | null>(null);
  const [title, setTitle] = useState(initialGame?.title ?? '');
  const coverUrl = coverSrc(initialGame?.coverUrl ?? API.cover(id));
  const trackedPlay = useRef('');

  useEffect(() => {
    if (initialGame && initialGame.id === id) {
      rememberGame(initialGame);
      setTitle(initialGame.title);
    }
    let cancel = false;
    const known = peekGame(id);
    if (known?.title) {
      setTitle(known.title);
    }
    const cached = peekRom(id);
    if (cached) {
      const problem = readRomError(cached);
      if (problem) {
        router.replace(errorHref(locale, problem));
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
            throw new Error('GAME_NOT_FOUND');
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
        router.replace(errorHref(locale, loadMessage(err)));
      }
    });
    return () => {
      cancel = true;
    };
  }, [id, initialGame, locale, router]);

  if (!rom) {
    return <PlayShell title={title} coverUrl={coverUrl} />;
  }
  return (
    <Emulator
      rom={rom}
      title={title || 'NES'}
      coverUrl={coverUrl}
      onError={(message) => router.replace(errorHref(locale, message))}
    />
  );
}
