'use client';

import { Button, Card, Flex, Heading, Text, TextField } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { api, coverSrc, type GameItem } from '@/lib/api';

const TOKEN_KEY = 'nes-admin-token';

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [title, setTitle] = useState('');
  const [cover, setCover] = useState<File | null>(null);
  const [rom, setRom] = useState<File | null>(null);
  const [games, setGames] = useState<GameItem[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function reload() {
    const response = await fetch(api.games());
    if (!response.ok) {
      throw new Error('列表加载失败');
    }
    setGames((await response.json()) as GameItem[]);
  }

  useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN_KEY);
    if (saved) {
      setToken(saved);
    }
    reload().catch((err: Error) => setError(err.message));
  }, []);

  async function upload() {
    setError('');
    setMessage('');
    if (!title.trim() || !cover || !rom) {
      setError('请填写标题、封面和 ROM');
      return;
    }
    window.localStorage.setItem(TOKEN_KEY, token);
    const body = new FormData();
    body.set('title', title.trim());
    body.set('cover', cover);
    body.set('rom', rom);
    const response = await fetch(api.adminGames(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: '上传失败' }));
      setError(payload.error || '上传失败');
      return;
    }
    setTitle('');
    setCover(null);
    setRom(null);
    setMessage('已保存');
    await reload();
  }

  async function remove(id: string) {
    setError('');
    const response = await fetch(api.adminGame(id), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok && response.status !== 204) {
      const payload = await response.json().catch(() => ({ error: '删除失败' }));
      setError(payload.error || '删除失败');
      return;
    }
    await reload();
  }

  return (
    <Flex direction="column" gap="4" p="4" style={{ maxWidth: 720 }}>
      <Heading size="6">游戏管理</Heading>
      <Text color="gray">上传封面和 NES ROM。管理口令默认是 dev-admin-token，可用环境变量 ADMIN_TOKEN 修改。</Text>
      <TextField.Root
        placeholder="管理口令"
        type="password"
        value={token}
        onChange={(event) => setToken(event.target.value)}
      />
      <TextField.Root
        placeholder="游戏标题"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <Flex direction="column" gap="2">
        <Text size="2">封面（jpg / png / webp / gif）</Text>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => setCover(event.target.files?.[0] || null)}
        />
      </Flex>
      <Flex direction="column" gap="2">
        <Text size="2">ROM（.nes）</Text>
        <input
          type="file"
          accept=".nes,.NES,application/octet-stream"
          onChange={(event) => setRom(event.target.files?.[0] || null)}
        />
      </Flex>
      <Button onClick={() => void upload()}>保存到列表</Button>
      {message ? <Text color="green">{message}</Text> : null}
      {error ? <Text color="red">{error}</Text> : null}
      <div className="game-grid">
        {games.map((game) => (
          <Card key={game.id}>
            <Flex direction="column" gap="2">
              <img className="cover" src={coverSrc(game.coverUrl)} alt="" />
              <Text>{game.title}</Text>
              <Button color="red" variant="soft" onClick={() => void remove(game.id)}>删除</Button>
            </Flex>
          </Card>
        ))}
      </div>
    </Flex>
  );
}
