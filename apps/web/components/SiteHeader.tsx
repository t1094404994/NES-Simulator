'use client';

import { Flex, Heading } from '@radix-ui/themes';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, type CSSProperties, type ReactNode } from 'react';
import { localePath, stripLocale, type Locale } from '@/lib/i18n';
import { useI18n } from '@/app/providers';
import { HardLink } from './HardLink';

const logoStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8 };

function Logo() {
  return (
    <>
      <img src="/icon.svg" alt="" width={28} height={28} />
      NES
    </>
  );
}

function NavLink({ href, reload, children, style, current }: {
  href: string;
  reload: boolean;
  children: ReactNode;
  style?: CSSProperties;
  current?: boolean;
}) {
  const className = current === undefined ? undefined : current ? 'lang-link is-current' : 'lang-link';
  if (reload) {
    return <HardLink href={href} style={style} current={current} className={className}>{children}</HardLink>;
  }
  return (
    <Link href={href} style={style} aria-current={current ? 'page' : undefined} className={className}>
      {children}
    </Link>
  );
}

function LangSwitch({ reload }: { reload: boolean }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const { locale, m } = useI18n();
  const bare = stripLocale(pathname);
  const query = search.toString();
  const hrefFor = (target: Locale) => {
    const path = localePath(target, bare);
    return query ? `${path}?${query}` : path;
  };
  return (
    <span className="lang-switch">
      <NavLink href={hrefFor('zh')} reload={reload} current={locale === 'zh'}>{m.chinese}</NavLink>
      <NavLink href={hrefFor('en')} reload={reload} current={locale === 'en'}>{m.english}</NavLink>
    </span>
  );
}

export function LanguageSwitch({ reload = false }: { reload?: boolean }) {
  return (
    <Suspense fallback={null}>
      <LangSwitch reload={reload} />
    </Suspense>
  );
}

export function SiteHeader({ reload = false }: { reload?: boolean }) {
  const { locale, m } = useI18n();
  return (
    <Flex className="site-header" align="center" justify="between" px="4" py="3" style={{ borderBottom: '1px solid #333' }}>
      <Heading as="h2" size="5">
        <NavLink href={localePath(locale, '/')} reload={reload} style={logoStyle}>
          <Logo />
        </NavLink>
      </Heading>
      <Flex gap="4" align="center">
        <LanguageSwitch reload={reload} />
        <NavLink href={localePath(locale, '/play/local')} reload={reload}>{m.localRom}</NavLink>
      </Flex>
    </Flex>
  );
}
