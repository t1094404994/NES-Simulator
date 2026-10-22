'use client';

import { Heading } from '@radix-ui/themes';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useI18n } from '@/app/providers';
import { coverSrc, type GameItem } from '@/lib/api';
import { localePath } from '@/lib/i18n';
import { loadRom, prefetchEmulator, rememberGame } from '@/lib/playCache';

function warm(game: GameItem) {
  rememberGame(game);
  prefetchEmulator();
  void loadRom(game.id);
}

export function GameCard({ game }: { game: GameItem }) {
  const { locale } = useI18n();
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        warm(game);
      }
    }, { rootMargin: '240px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [game]);

  return (
    <Link
      ref={ref}
      href={localePath(locale, `/play/${game.id}`)}
      className="game-card"
      onPointerEnter={() => warm(game)}
      onPointerDown={() => warm(game)}
      onFocus={() => warm(game)}
    >
      <img className="cover" src={coverSrc(game.coverUrl)} alt={game.title} />
      <Heading className="game-title" as="h2" size="3">{game.title}</Heading>
    </Link>
  );
}
