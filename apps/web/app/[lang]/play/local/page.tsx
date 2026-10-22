'use client';

import { Button, Flex, Heading, Text } from '@radix-ui/themes';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Emulator } from '@/components/Emulator';
import { LanguageSwitch } from '@/components/SiteHeader';
import { useI18n } from '@/app/providers';
import { localePath } from '@/lib/i18n';
import { errorHref, readRomError } from '@/lib/rom';

export default function LocalPlayPage() {
  const router = useRouter();
  const { locale, m } = useI18n();
  const [rom, setRom] = useState<ArrayBuffer | null>(null);
  const [title, setTitle] = useState(m.localRom);
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
        router.push(errorHref(locale, problem));
        return;
      }
      setTitle(file.name.replace(/\.nes$/i, ''));
      setRom(buffer);
    } catch {
      setError(m.readFileFailed);
    }
  }

  if (rom) {
    return (
      <Emulator
        rom={rom}
        title={title}
        onError={(message) => router.replace(errorHref(locale, message))}
      />
    );
  }

  return (
    <Flex className="page-shell" direction="column" gap="4" p="4">
      <Flex justify="between" align="center">
        <Heading size="6">{m.localRom}</Heading>
        <Flex align="center" gap="3">
          <LanguageSwitch />
          <Button asChild variant="soft" color="gray">
            <Link href={localePath(locale, '/')}>{m.back}</Link>
          </Button>
        </Flex>
      </Flex>
      <Text color="gray">{m.fileStaysLocal}</Text>
      <Flex align="center" gap="3">
        <Button asChild>
          <label>
            {m.pickNesFile}
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
