import type { GameStat } from '@nes/shared';
import type { EChartsCoreOption } from 'echarts';

const FONT = '"Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

const COLORS = ['#22d3ee', '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#fbbf24', '#34d399', '#a3e635', '#94a3b8'];

const BAR_LIMIT = 10;
const PIE_LIMIT = 6;

function shortTitle(title: string): string {
  return title.length > 8 ? `${title.slice(0, 8)}…` : title;
}

export function topGames(games: GameStat[]): GameStat[] {
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

interface ParametricEquation {
  u: { min: number; max: number; step: number };
  v: { min: number; max: number; step: number };
  x: (u: number, v: number) => number;
  y: (u: number, v: number) => number;
  z: (u: number, v: number) => number;
}

/** ECharts GL 的参数方程立体饼图。高度按数值拉开。 */
function pieEquation(startRatio: number, endRatio: number, height: number): ParametricEquation {
  const startRadian = startRatio * Math.PI * 2;
  const endRadian = endRatio * Math.PI * 2;
  const k = 1 / 3;
  const hoverRate = 1;
  return {
    u: { min: -Math.PI, max: Math.PI * 3, step: Math.PI / 32 },
    v: { min: 0, max: Math.PI * 2, step: Math.PI / 20 },
    x(u, v) {
      const angle = u < startRadian ? startRadian : u > endRadian ? endRadian : u;
      return Math.cos(angle) * (1 + Math.cos(v) * k) * hoverRate;
    },
    y(u, v) {
      const angle = u < startRadian ? startRadian : u > endRadian ? endRadian : u;
      return Math.sin(angle) * (1 + Math.cos(v) * k) * hoverRate;
    },
    z(u, v) {
      if (u < -Math.PI * 0.5) {
        return Math.sin(u);
      }
      if (u > Math.PI * 2.5) {
        return Math.sin(u) * height * 0.1;
      }
      return Math.sin(v) > 0 ? height * 0.1 : -1;
    },
  };
}

export function playBarOption(games: GameStat[]): EChartsCoreOption {
  const rows = topGames(games);
  const maxValue = Math.max(1, ...rows.flatMap((game) => [game.plays, game.players]));
  const bar = {
    type: 'bar3D',
    shading: 'lambert',
    barSize: 7,
    bevelSize: 0.3,
    bevelSmoothness: 3,
    minHeight: 0,
    label: { show: false },
    emphasis: { itemStyle: { color: '#f8fafc' } },
  };
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: FONT },
    legend: {
      top: 8,
      textStyle: { color: '#cbd5e1', fontFamily: FONT },
      data: ['游玩次数', '游玩人数'],
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontFamily: FONT },
      formatter: (raw: unknown) => {
        const item = raw as { value?: number[]; seriesName?: string };
        const value = item.value;
        const game = value ? rows[value[0]] : undefined;
        if (!value || !game) {
          return '';
        }
        return `${game.title}<br/>${item.seriesName}：${value[2].toLocaleString('zh-CN')}`;
      },
    },
    xAxis3D: {
      type: 'category',
      data: rows.map((game) => shortTitle(game.title)),
      name: '',
      axisLabel: { interval: 0, margin: 12, color: '#e2e8f0', fontSize: 12 },
      axisLine: { lineStyle: { color: '#64748b' } },
    },
    yAxis3D: {
      type: 'category',
      data: ['次数', '人数'],
      name: '',
      axisLabel: { margin: 12, color: '#e2e8f0', fontSize: 12 },
      axisLine: { lineStyle: { color: '#64748b' } },
    },
    zAxis3D: {
      type: 'value',
      min: 0,
      max: maxValue,
      name: '',
      axisLabel: { color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#64748b' } },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    grid3D: {
      top: 28,
      boxWidth: 200,
      boxDepth: 64,
      environment: '#0b1220',
      axisPointer: { show: false },
      light: {
        main: { intensity: 1.4, shadow: true, shadowQuality: 'high', alpha: 40, beta: 50 },
        ambient: { intensity: 0.42 },
      },
      viewControl: {
        projection: 'perspective',
        autoRotate: rows.length > 1,
        autoRotateSpeed: 6,
        distance: 230,
        alpha: 20,
        beta: 18,
        minDistance: 140,
        maxDistance: 380,
      },
    },
    series: [
      {
        ...bar,
        name: '游玩次数',
        itemStyle: { color: '#22d3ee', opacity: 0.95 },
        data: rows.map((game, index) => [index, 0, game.plays]),
      },
      {
        ...bar,
        name: '游玩人数',
        itemStyle: { color: '#c084fc', opacity: 0.95 },
        data: rows.map((game, index) => [index, 1, game.players]),
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
  const max = Math.max(...slices.map((slice) => slice.value));
  let cursor = 0;
  const series = slices.map((slice) => {
    const start = cursor / total;
    cursor += slice.value;
    const end = cursor / total;
    const height = 10 + (slice.value / max) * 26;
    return {
      name: slice.name,
      type: 'surface',
      parametric: true,
      wireframe: { show: false },
      itemStyle: { color: slice.color, opacity: 0.96 },
      parametricEquation: pieEquation(start, end, height),
    };
  });
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: FONT },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontFamily: FONT },
      formatter: (raw: unknown) => {
        const item = raw as { seriesName?: string };
        const slice = slices.find((entry) => entry.name === item.seriesName);
        if (!slice) {
          return '';
        }
        const percent = Math.round((slice.value / total) * 1000) / 10;
        return `${slice.name}<br/>游玩 ${slice.value.toLocaleString('zh-CN')} 次 · ${percent}%`;
      },
    },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 'middle',
      textStyle: { color: '#cbd5e1', fontFamily: FONT },
      data: slices.map((slice) => slice.name),
    },
    xAxis3D: { min: -1.4, max: 1.4 },
    yAxis3D: { min: -1.4, max: 1.4 },
    zAxis3D: { min: -1.4, max: 1.4 },
    grid3D: {
      show: false,
      boxHeight: 18,
      left: '-8%',
      environment: '#0b1220',
      viewControl: {
        alpha: 32,
        beta: 40,
        distance: 180,
        autoRotate: true,
        autoRotateSpeed: 10,
        rotateSensitivity: 1,
        zoomSensitivity: 1,
        panSensitivity: 0,
      },
      light: {
        main: { intensity: 1.3, shadow: true, alpha: 40, beta: 30 },
        ambient: { intensity: 0.45 },
      },
    },
    series,
  };
}
