import '@radix-ui/themes/styles.css';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { JsonLd } from '@/components/JsonLd';
import { htmlLang, isLocale, messagesFor, ogLocale, resolveLocale } from '@/lib/i18n';
import { languageAlternates, SITE_NAME, SITE_URL } from '@/lib/seo';
import { TrackVisit } from '@/components/TrackVisit';
import { Providers } from '../providers';
import '../globals.css';

type LangLayoutProps = {
  children: ReactNode;
  params: Promise<{ lang: string }>;
};

export function generateStaticParams() {
  return [{ lang: 'zh' }, { lang: 'en' }];
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#111111',
};

export async function generateMetadata({ params }: LangLayoutProps): Promise<Metadata> {
  const locale = resolveLocale((await params).lang);
  const messages = messagesFor(locale);
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: SITE_NAME,
    keywords: messages.keywords,
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '48x48' },
        { url: '/icon.svg', type: 'image/svg+xml' },
      ],
      apple: [{ url: '/apple-icon', type: 'image/png' }],
    },
    title: {
      default: messages.homeTitle,
      template: `%s · ${SITE_NAME}`,
    },
    description: messages.siteDescription,
    alternates: {
      canonical: locale === 'en' ? '/en' : '/',
      languages: languageAlternates('/'),
    },
    openGraph: {
      type: 'website',
      locale: ogLocale(locale),
      alternateLocale: locale === 'zh' ? ['en_US'] : ['zh_CN'],
      siteName: SITE_NAME,
      title: messages.homeTitle,
      description: messages.siteDescription,
      url: locale === 'en' ? '/en' : '/',
      images: [{ url: '/icon.svg', alt: SITE_NAME }],
    },
    twitter: {
      card: 'summary',
      title: messages.homeTitle,
      description: messages.siteDescription,
      images: ['/icon.svg'],
    },
  };
}

export default async function LangLayout({ children, params }: LangLayoutProps) {
  const { lang } = await params;
  if (!isLocale(lang)) {
    notFound();
  }
  const messages = messagesFor(lang);
  return (
    <html lang={htmlLang(lang)}>
      <body>
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE_NAME,
            url: lang === 'en' ? `${SITE_URL}/en` : SITE_URL,
            description: messages.siteDescription,
            inLanguage: htmlLang(lang),
          }}
        />
        <Providers locale={lang}>
          <TrackVisit />
          {children}
        </Providers>
      </body>
    </html>
  );
}
