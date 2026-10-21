'use client';

import { Button, Flex, Heading, Text } from '@radix-ui/themes';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Loading } from '@/components/Loading';
import { API_BASE, api, coverSrc, type GameItem } from '@/lib/api';
import { loadRom, prefetchEmulator, rememberGame } from '@/lib/playCache';

function GameCard({ game }: { game: GameItem }) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        rememberGame(game);
        prefetchEmulator();
        void loadRom(game.id);
      }
    }, { rootMargin: '240px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [game]);

  return (
    <Link
      ref={ref}
      href={`/play/${game.id}`}
      className="game-card"
      onPointerEnter={() => {
        rememberGame(game);
        prefetchEmulator();
        void loadRom(game.id);
      }}
      onPointerDown={() => {
        rememberGame(game);
        prefetchEmulator();
        void loadRom(game.id);
      }}
      onFocus={() => {
        rememberGame(game);
        prefetchEmulator();
        void loadRom(game.id);
      }}
    >
      <img className="cover" src={coverSrc(game.coverUrl)} alt="" />
      <Heading className="game-title" size="3">{game.title}</Heading>
    </Link>
  );
}

export default function HomePage() {
  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    prefetchEmulator();
    let cancel = false;
    fetch(api.games())
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('游戏列表加载失败');
        }
        return response.json() as Promise<GameItem[]>;
      })
      .then((list) => {
        if (!cancel) {
          setGames(list);
        }
      })
      .catch((err: Error) => {
        if (!cancel) {
          setError(err.message && err.message !== 'Failed to fetch' ? err.message : '无法连接后台');
        }
      })
      .finally(() => {
        if (!cancel) {
          setLoading(false);
        }
      });
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <Flex className="page-shell" direction="column" gap="4" p="4">
      <Flex justify="between" align="center">
        <Heading size="6">游戏列表</Heading>
        <Button asChild>
          <Link href="/play/local">选择本地 ROM</Link>
        </Button>
      </Flex>
      {loading ? <Loading label="正在加载游戏列表" /> : null}
      {!loading && error ? <Text color="red">{error}。请先启动后台（默认 {API_BASE}）。</Text> : null}
      {!loading && !error && games.length === 0 ? <Text color="gray">还没有游戏。可以直接选择本地 ROM。</Text> : null}
      <div className="game-grid">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </Flex>
  );
}
