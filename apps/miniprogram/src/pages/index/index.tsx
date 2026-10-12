import { Image, Text, View } from '@tarojs/components';
import { API, apiUrl, coverSrc, type GameItem } from '@nes/shared';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import './index.css';

export default function IndexPage() {
  const [games, setGames] = useState<GameItem[]>([]);
  const [error, setError] = useState('');

  useDidShow(() => {
    Taro.request<GameItem[]>({ url: apiUrl(API_BASE, API.games) })
      .then((response) => {
        if (response.statusCode !== 200 || !Array.isArray(response.data)) {
          throw new Error('游戏列表加载失败');
        }
        setError('');
        setGames(response.data);
      })
      .catch(() => {
        setError('无法连接后台。请确认已启动，并在开发者工具里关闭合法域名校验。');
      });
  });

  return (
    <View className="page">
      <Text className="hint">从列表选择游戏</Text>
      {error ? <Text className="hint">{error}</Text> : null}
      {!error && games.length === 0 ? <Text className="hint">列表是空的。先在网页管理页上传游戏。</Text> : null}
      {games.map((game) => (
        <View
          key={game.id}
          className="card"
          onClick={() => {
            void Taro.navigateTo({ url: `/pages/play/index?id=${game.id}` });
          }}
        >
          <Image className="cover" src={coverSrc(API_BASE, game.coverUrl)} mode="aspectFill" />
          <View className="meta">
            <Text className="title">{game.title}</Text>
            <Text className="play">开始游戏</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
