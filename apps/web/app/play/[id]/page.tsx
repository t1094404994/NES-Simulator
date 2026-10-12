'use client';

import { Flex, Text } from '@radix-ui/themes';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Emulator } from '@/components/Emulator';
import { api, type GameItem } from '@/lib/api';

export default function PlayPage() {
  const params = useParams<{ id: string }>();
  const [rom, setRom] = useState<ArrayBuffer | null>(null);
  const [title, setTitle] = useState('加载中');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancel = false;
    const id = params.id;
    (async () => {
      const gameResponse = await fetch(api.game(id));
      if (!gameResponse.ok) {
        throw new Error('找不到这款游戏');
      }
      const game = (await gameResponse.json()) as GameItem;
      const romResponse = await fetch(api.rom(id));
      if (!romResponse.ok) {
        throw new Error('ROM 下载失败');
      }
      const buffer = await romResponse.arrayBuffer();
      if (!cancel) {
        setTitle(game.title);
        setRom(buffer);
      }
    })().catch((err: Error) => {
      if (!cancel) {
        setError(err.message || '加载失败');
      }
    });
    return () => {
      cancel = true;
    };
  }, [params.id]);

  if (error) {
    return (
      <Flex p="4">
        <Text color="red">{error}</Text>
      </Flex>
    );
  }
  if (!rom) {
    return (
      <Flex p="4">
        <Text>正在加载游戏…</Text>
      </Flex>
    );
  }
  return <Emulator rom={rom} title={title} />;
}
