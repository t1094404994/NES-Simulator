import { Button, Flex, Heading, Text } from '@radix-ui/themes';
import Link from 'next/link';
import { GameCard } from '@/components/GameCard';
import { JsonLd } from '@/components/JsonLd';
import { WarmEmulator } from '@/components/WarmEmulator';
import { API_BASE } from '@/lib/api';
import { fetchGames } from '@/lib/games';
import { htmlLang, localePath, messagesFor, resolveLocale } from '@/lib/i18n';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type HomePageProps = {
  params: Promise<{ lang: string }>;
};

export default async function HomePage({ params }: HomePageProps) {
  const locale = resolveLocale((await params).lang);
  const messages = messagesFor(locale);
  const games = await fetchGames();
  const list = games ?? [];
  const homeUrl = absoluteUrl(locale, '/');

  return (
    <Flex className="page-shell" direction="column" gap="4" p="4">
      <WarmEmulator />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: messages.gameListName,
          description: messages.siteDescription,
          url: homeUrl,
          inLanguage: htmlLang(locale),
          numberOfItems: list.length,
          itemListElement: list.map((game, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: game.title,
            url: absoluteUrl(locale, `/play/${game.id}`),
          })),
        }}
      />
      <Flex justify="between" align="center">
        <Heading size="6" as="h1">{messages.gameList}</Heading>
        <Button asChild>
          <Link href={localePath(locale, '/play/local')}>{messages.pickLocalRom}</Link>
        </Button>
      </Flex>
      <Text color="gray">{messages.siteDescription}</Text>
      {games === null ? <Text color="red">{messages.gameListFailed(API_BASE)}</Text> : null}
      {games !== null && games.length === 0 ? <Text color="gray">{messages.noGames}</Text> : null}
      <div className="game-grid">
        {list.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </Flex>
  );
}
