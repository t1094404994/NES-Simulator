'use client';

import { Button, Flex, Heading, Text } from '@radix-ui/themes';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Emulator } from '@/components/Emulator';
import { errorHref, readRomError } from '@/lib/rom';

export default function LocalPlayPage() {
  const router = useRouter();
  const [rom, setRom] = useState<ArrayBuffer | null>(null);
  const [title, setTitle] = useState('本地 ROM');
  const [error, setError] = useState('');

  async function onFile(file: File | undefined) {
    if (!file) {
      return;
    }
    setError('');
    try {
      const buffer = await file.arrayBuffer();
      const problem = readRomError(buffer);
      if (problem) {
        router.push(errorHref(problem));
        return;
      }
      setTitle(file.name.replace(/\.nes$/i, ''));
      setRom(buffer);
    } catch {
      setError('读取文件失败');
    }
  }

  if (rom) {
    return (
      <Emulator
        rom={rom}
        title={title}
        onError={(message) => router.replace(errorHref(message))}
      />
    );
  }

  return (
    <Flex className="page-shell" direction="column" gap="4" p="4">
      <Flex justify="between" align="center">
        <Heading size="6">本地 ROM</Heading>
        <Button asChild variant="soft" color="gray">
          <Link href="/">返回</Link>
        </Button>
      </Flex>
      <Text color="gray">文件只在浏览器里运行，不会上传。</Text>
      <Flex align="center" gap="3">
        <Button asChild>
          <label>
            选择 .nes 文件
            <input
              type="file"
              accept=".nes,.NES,application/octet-stream"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void onFile(file);
              }}
            />
          </label>
        </Button>
        {error ? <Text color="red">{error}</Text> : null}
      </Flex>
    </Flex>
  );
}
