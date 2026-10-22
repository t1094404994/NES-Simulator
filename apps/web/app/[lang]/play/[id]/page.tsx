import { JsonLd } from '@/components/JsonLd';
import { coverSrc } from '@/lib/api';
import { fetchGame } from '@/lib/games';
import { messagesFor, resolveLocale } from '@/lib/i18n';
import { absoluteUrl } from '@/lib/seo';
import { PlayClient } from './PlayClient';

type PlayPageProps = {
  params: Promise<{ lang: string; id: string }>;
};

export default async function PlayPage({ params }: PlayPageProps) {
  const { lang, id } = await params;
  const locale = resolveLocale(lang);
  const messages = messagesFor(locale);
  let game = null;
  try {
    game = await fetchGame(id);
  } catch {
    game = null;
  }
  const description = game ? messages.playDescription(game.title) : messages.playGeneric;

  return (
    <>
      {game ? (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'VideoGame',
            name: game.title,
            description,
            url: absoluteUrl(locale, `/play/${game.id}`),
            image: coverSrc(game.coverUrl),
            applicationCategory: 'Game',
            operatingSystem: 'Web',
            inLanguage: locale === 'zh' ? 'zh-CN' : 'en',
          }}
        />
      ) : null}
      <PlayClient initialGame={game} />
    </>
  );
}
