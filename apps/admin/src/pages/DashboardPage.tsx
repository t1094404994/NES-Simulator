import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import TodayIcon from '@mui/icons-material/Today';
import VideogameAssetIcon from '@mui/icons-material/VideogameAsset';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { AdminStats } from '@nes/shared';
import { formatDateTime, loadStats } from '../api';
import { Chart } from '../charts/Chart';
import { playBarOption, playPieOption } from '../charts/options';
import { ArtNumber, type ArtTone } from '../components/ArtNumber';
import { LoadingBlock } from '../components/LoadingBlock';

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: ReactNode; tone: ArtTone }) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Box
              sx={{
                mt: 1.25,
                display: 'inline-flex',
                px: 1.25,
                py: 0.75,
                borderRadius: 1.5,
                background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 8px 16px rgba(15, 23, 42, 0.12)',
              }}
            >
              <ArtNumber value={value} tone={tone} />
            </Box>
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ChartPanel({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <Card sx={{ bgcolor: '#0b1220', color: '#e2e8f0', borderColor: '#1e293b', overflow: 'hidden' }}>
      <CardContent>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5, mb: 1 }}>{hint}</Typography>
        {children}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const barOption = useMemo(() => (stats ? playBarOption(stats.gameStats) : null), [stats]);
  const pieOption = useMemo(() => (stats ? playPieOption(stats.gameStats) : null), [stats]);

  useEffect(() => {
    document.title = '概览 · NES 管理后台';
  }, []);

  useEffect(() => {
    let cancel = false;
    loadStats()
      .then((next) => {
        if (!cancel) {
          setStats(next);
          setError('');
        }
      })
      .catch((err: unknown) => {
        if (!cancel) {
          setError(err instanceof Error ? err.message : '统计加载失败');
        }
      })
      .finally(() => {
        if (!cancel) {
          setLoading(false);
        }
      });
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5">概览</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          访问按上海时区统计，同一浏览器每天计为 1 人。游玩次数按成功打开游戏页面计算，本地 ROM 不计入。
        </Typography>
      </Box>
      {loading ? <LoadingBlock label="正在加载统计" /> : null}
      {!loading && error ? <Alert severity="error">{error}</Alert> : null}
      {stats ? (
        <>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' },
            }}
          >
            <StatCard label="累计访问人数" value={stats.visitors.total} icon={<PeopleAltIcon />} tone="gold" />
            <StatCard label="今日访问人数" value={stats.visitors.today} icon={<TodayIcon />} tone="cyan" />
            <StatCard label="累计游玩次数" value={stats.plays.total} icon={<SportsEsportsIcon />} tone="pink" />
            <StatCard label="游戏数量" value={stats.games} icon={<VideogameAssetIcon />} tone="lime" />
          </Box>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1.5fr 1fr' } }}>
            <ChartPanel title="游玩对比" hint="柱形图展示游玩次数最高的 10 款游戏，对比游玩次数和游玩人数。">
              {barOption && stats.gameStats.length > 0 ? (
                <Chart option={barOption} height={440} />
              ) : (
                <Box sx={{ height: 440, display: 'grid', placeItems: 'center' }}>
                  <Typography sx={{ color: '#94a3b8' }}>还没有游戏。</Typography>
                </Box>
              )}
            </ChartPanel>
            <ChartPanel title="游玩占比" hint="饼图按游玩次数占比，最多展示 6 款，其余计入其他。">
              {pieOption ? (
                <Chart option={pieOption} height={440} />
              ) : (
                <Box sx={{ height: 440, display: 'grid', placeItems: 'center' }}>
                  <Typography sx={{ color: '#94a3b8' }}>还没有游玩记录。</Typography>
                </Box>
              )}
            </ChartPanel>
          </Box>
          <Card>
            <CardContent sx={{ pb: 1 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>游戏游玩统计</Typography>
              <TableContainer>
                <Table size="small" sx={{ whiteSpace: 'nowrap' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>游戏</TableCell>
                      <TableCell align="right">游玩次数</TableCell>
                      <TableCell align="right">游玩人数</TableCell>
                      <TableCell>最近游玩</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.gameStats.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Typography color="text.secondary">还没有游戏。</Typography>
                        </TableCell>
                      </TableRow>
                    ) : stats.gameStats.map((game) => (
                      <TableRow key={game.id} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                            <Box
                              component="img"
                              src={game.coverUrl}
                              alt=""
                              sx={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 1, bgcolor: 'action.hover' }}
                            />
                            <Typography variant="body2">{game.title}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="right"><ArtNumber value={game.plays} tone="cyan" size="md" /></TableCell>
                        <TableCell align="right"><ArtNumber value={game.players} tone="pink" size="md" /></TableCell>
                        <TableCell>{formatDateTime(game.lastPlayedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      ) : null}
    </Stack>
  );
}
