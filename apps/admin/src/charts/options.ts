import type { GameStat } from '@nes/shared';
import type { EChartsCoreOption } from 'echarts';

const FONT = '"Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

const COLORS = ['#22d3ee', '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#fbbf24', '#34d399', '#a3e635', '#94a3b8'];

const BAR_LIMIT = 10;
const PIE_LIMIT = 6;

function shortTitle(title: string): string {
  return title.length > 8 ? `${title.slice(0, 8)}…` : title;
}

function topGames(games: GameStat[]): GameStat[] {
  return games.slice(0, BAR_LIMIT);
}

interface PieSlice {
  name: string;
  value: number;
  color: string;
}

function pieSlices(games: GameStat[]): PieSlice[] {
  const played = games.filter((game) => game.plays > 0);
  const head = played.slice(0, PIE_LIMIT);
  const rest = played.slice(PIE_LIMIT).reduce((sum, game) => sum + game.plays, 0);
  const slices = head.map((game, index) => ({
    name: game.title,
    value: game.plays,
    color: COLORS[index % COLORS.length],
  }));
  if (rest > 0) {
    slices.push({ name: '其他', value: rest, color: COLORS[COLORS.length - 1] });
  }
  return slices;
}

const tooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.92)',
  borderColor: '#334155',
  textStyle: { color: '#e2e8f0', fontFamily: FONT },
};

function verticalGradient(from: string, to: string) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: from },
      { offset: 1, color: to },
    ],
  };
}

export function playBarOption(games: GameStat[]): EChartsCoreOption {
  const rows = topGames(games);
  return {
    backgroundColor: 'transparent',
    animationDuration: 900,
    animationEasing: 'cubicOut',
    animationDelay: (index: number) => index * 40,
    textStyle: { fontFamily: FONT },
    legend: {
      top: 4,
      textStyle: { color: '#cbd5e1', fontFamily: FONT },
      data: ['游玩次数', '游玩人数'],
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      ...tooltipStyle,
      formatter: (raw: unknown) => {
        const items = (Array.isArray(raw) ? raw : [raw]) as Array<{
          dataIndex?: number;
          seriesName?: string;
          value?: number;
          marker?: string;
        }>;
        const game = rows[items[0]?.dataIndex ?? -1];
        if (!game) {
          return '';
        }
        const lines = items.map((item) => (
          `${item.marker ?? ''}${item.seriesName}：${Number(item.value ?? 0).toLocaleString('zh-CN')}`
        ));
        return `${game.title}<br/>${lines.join('<br/>')}`;
      },
    },
    grid: { left: 48, right: 16, top: 48, bottom: rows.length > 6 ? 64 : 36 },
    xAxis: {
      type: 'category',
      data: rows.map((game) => shortTitle(game.title)),
      axisTick: { alignWithLabel: true },
      axisLabel: {
        interval: 0,
        color: '#e2e8f0',
        fontSize: 12,
        rotate: rows.length > 6 ? 28 : 0,
      },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        name: '游玩次数',
        type: 'bar',
        barMaxWidth: 22,
        data: rows.map((game) => game.plays),
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: verticalGradient('#67e8f9', '#0e7490'),
        },
      },
      {
        name: '游玩人数',
        type: 'bar',
        barMaxWidth: 22,
        data: rows.map((game) => game.players),
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: verticalGradient('#e9d5ff', '#7c3aed'),
        },
      },
    ],
  };
}

export function playPieOption(games: GameStat[]): EChartsCoreOption | null {
  const slices = pieSlices(games);
  if (slices.length === 0) {
    return null;
  }
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  return {
    backgroundColor: 'transparent',
    animationDuration: 900,
    animationEasing: 'cubicOut',
    textStyle: { fontFamily: FONT },
    tooltip: {
      trigger: 'item',
      ...tooltipStyle,
      formatter: (raw: unknown) => {
        const item = raw as { name?: string; value?: number; percent?: number };
        const value = Number(item.value ?? 0).toLocaleString('zh-CN');
        const percent = item.percent ?? Math.round((Number(item.value ?? 0) / total) * 1000) / 10;
        return `${item.name ?? ''}<br/>游玩 ${value} 次 · ${percent}%`;
      },
    },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 'middle',
      textStyle: { color: '#cbd5e1', fontFamily: FONT },
    },
    series: [
      {
        type: 'pie',
        radius: ['46%', '72%'],
        center: ['36%', '54%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#0b1220', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 8,
          itemStyle: { shadowBlur: 16, shadowColor: 'rgba(0, 0, 0, 0.35)' },
        },
        data: slices.map((slice) => ({
          name: slice.name,
          value: slice.value,
          itemStyle: { color: slice.color },
        })),
      },
    ],
  };
}
