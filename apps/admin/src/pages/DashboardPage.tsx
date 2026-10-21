import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import TodayIcon from '@mui/icons-material/Today';
import VideogameAssetIcon from '@mui/icons-material/VideogameAsset';
import {
  Alert,
  Box,
  Button,
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
import { GlChart } from '../charts/GlChart';
import { playBarOption, playPieOption } from '../charts/options';
import { LoadingBlock } from '../components/LoadingBlock';

function StatCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="h4" sx={{ mt: 1 }}>{value.toLocaleString('zh-CN')}</Typography>
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
            <StatCard label="累计访问人数" value={stats.visitors.total} icon={<PeopleAltIcon />} />
            <StatCard label="今日访问人数" value={stats.visitors.today} icon={<TodayIcon />} />
            <StatCard label="累计游玩次数" value={stats.plays.total} icon={<SportsEsportsIcon />} />
            <StatCard label="游戏数量" value={stats.games} icon={<VideogameAssetIcon />} />
          </Box>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1.5fr 1fr' } }}>
            <ChartPanel title="游玩对比" hint="拖动旋转，滚轮缩放。柱高分别是游玩次数和游玩人数。">
              {barOption && stats.gameStats.length > 0 ? (
                <GlChart option={barOption} height={440} />
              ) : (
                <Box sx={{ height: 440, display: 'grid', placeItems: 'center' }}>
                  <Typography sx={{ color: '#94a3b8' }}>还没有游戏。</Typography>
                </Box>
              )}
            </ChartPanel>
            <ChartPanel title="游玩占比" hint="扇区高度随游玩次数变化。">
              {pieOption ? (
                <GlChart option={pieOption} height={440} />
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
                        <TableCell align="right">{game.plays.toLocaleString('zh-CN')}</TableCell>
                        <TableCell align="right">{game.players.toLocaleString('zh-CN')}</TableCell>
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
