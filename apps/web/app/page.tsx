'use client';

import { Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { API_BASE, api, coverSrc, type GameItem } from '@/lib/api';

export default function HomePage() {
  const [games, setGames] = useState<GameItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
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
          setError(err.message || '无法连接后台');
        }
      });
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <Flex direction="column" gap="4" p="4">
      <Flex justify="between" align="center">
        <Heading size="6">游戏列表</Heading>
        <Button asChild>
          <Link href="/play/local">选择本地 ROM</Link>
        </Button>
      </Flex>
      {error ? <Text color="red">{error}。请先启动后台（默认 {API_BASE}）。</Text> : null}
      {!error && games.length === 0 ? <Text color="gray">还没有游戏。可以在管理页上传，或直接选择本地 ROM。</Text> : null}
      <div className="game-grid">
        {games.map((game) => (
          <Card key={game.id}>
            <Flex direction="column" gap="3">
              <img className="cover" src={coverSrc(game.coverUrl)} alt="" />
              <Heading size="3">{game.title}</Heading>
              <Button asChild>
                <Link href={`/play/${game.id}`}>开始游戏</Link>
              </Button>
            </Flex>
          </Card>
        ))}
      </div>
    </Flex>
  );
}
