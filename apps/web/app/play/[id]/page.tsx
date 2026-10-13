'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Emulator } from '@/components/Emulator';
import { Loading } from '@/components/Loading';
import { api, type GameItem } from '@/lib/api';
import { errorHref, readRomError } from '@/lib/rom';

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
  const [rom, setRom] = useState<ArrayBuffer | null>(null);
  const [title, setTitle] = useState('加载中');

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
      const problem = readRomError(buffer);
      if (problem) {
        throw new Error(problem);
      }
      if (!cancel) {
        setTitle(game.title);
        setRom(buffer);
      }
    })().catch((err: Error) => {
      if (!cancel) {
        router.replace(errorHref(loadMessage(err)));
      }
    });
    return () => {
      cancel = true;
    };
  }, [params.id, router]);

  if (!rom) {
    return <Loading label="正在加载游戏" />;
  }
  return (
    <Emulator
      rom={rom}
      title={title}
      onError={(message) => router.replace(errorHref(message))}
    />
  );
}
