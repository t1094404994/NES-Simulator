import AddIcon from '@mui/icons-material/Add';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { type FormEvent, useEffect, useState } from 'react';
import type { GameItem } from '@nes/shared';
import { createGame, formatDateTime, listGames, removeGame, updateCover } from '../api';
import { LoadingBlock } from '../components/LoadingBlock';

export function GamesPage() {
  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [coverVersion, setCoverVersion] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [coverGame, setCoverGame] = useState<GameItem | null>(null);
  const [deleteGame, setDeleteGame] = useState<GameItem | null>(null);

  useEffect(() => {
    document.title = '游戏管理 · NES 管理后台';
  }, []);

  async function load() {
    try {
      setGames(await listGames());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '游戏列表加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2 }}
      >
        <Box>
          <Typography variant="h5">游戏管理</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            新增、删除游戏，或更换封面。
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          新增游戏
        </Button>
      </Stack>
      {loading ? <LoadingBlock label="正在加载游戏" /> : null}
      {!loading && error ? (
        <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>重试</Button>}>
          {error}
        </Alert>
      ) : null}
      {!loading && !error ? (
        <TableContainer sx={{ bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
          <Table sx={{ whiteSpace: 'nowrap' }}>
            <TableHead>
              <TableRow>
                <TableCell>封面</TableCell>
                <TableCell>标题</TableCell>
                <TableCell>创建时间</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {games.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography color="text.secondary">还没有游戏。</Typography>
                  </TableCell>
                </TableRow>
              ) : games.map((game) => (
                <TableRow key={game.id} hover>
                  <TableCell>
                    <Box
                      component="img"
                      src={`${game.coverUrl}?v=${coverVersion}`}
                      alt=""
                      sx={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 1, bgcolor: 'action.hover', display: 'block' }}
                    />
                  </TableCell>
                  <TableCell>{game.title}</TableCell>
                  <TableCell>{formatDateTime(game.createdAt)}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setCoverGame(game)}>更换封面</Button>
                    <Button size="small" color="error" onClick={() => setDeleteGame(game)}>删除</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
      {createOpen ? (
        <CreateDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            setNotice('已新增游戏');
            void load();
          }}
        />
      ) : null}
      {coverGame ? (
        <CoverDialog
          game={coverGame}
          onClose={() => setCoverGame(null)}
          onSaved={() => {
            setCoverGame(null);
            setCoverVersion((value) => value + 1);
            setNotice('已更换封面');
            void load();
          }}
        />
      ) : null}
      {deleteGame ? (
        <DeleteDialog
          game={deleteGame}
          onClose={() => setDeleteGame(null)}
          onDeleted={() => {
            setDeleteGame(null);
            setNotice('已删除游戏');
            void load();
          }}
        />
      ) : null}
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={3000}
        onClose={() => setNotice('')}
        message={notice}
      />
    </Stack>
  );
}

function FileField({
  label,
  accept,
  file,
  onChange,
}: {
  label: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
      <Button variant="outlined" component="label">
        {label}
        <input
          hidden
          type="file"
          accept={accept}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
      </Button>
      <Typography variant="body2" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
        {file ? file.name : '未选择'}
      </Typography>
    </Stack>
  );
}

function CreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [rom, setRom] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = title.trim();
    if (!name || name.length > 80) {
      setError('标题必填，且不超过 80 个字');
      return;
    }
    if (!rom || !cover) {
      setError('请同时选择 ROM 和封面');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createGame({ title: name, rom, cover });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={(event) => void submit(event)}>
        <DialogTitle>新增游戏</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField
              label="标题"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              autoFocus
              fullWidth
            />
            <FileField label="选择 ROM" accept=".nes,application/octet-stream" file={rom} onChange={setRom} />
            <FileField label="选择封面" accept="image/jpeg,image/png,image/webp,image/gif" file={cover} onChange={setCover} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>取消</Button>
          <Button type="submit" variant="contained" disabled={saving}>{saving ? '保存中' : '保存'}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function CoverDialog({
  game,
  onClose,
  onSaved,
}: {
  game: GameItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cover, setCover] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!cover) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(cover);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!cover) {
      setError('请选择封面图片');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateCover(game.id, cover);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={(event) => void submit(event)}>
        <DialogTitle>更换封面</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">{game.title}</Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Box
              component="img"
              src={preview || game.coverUrl}
              alt=""
              sx={{ width: 160, height: 120, objectFit: 'cover', borderRadius: 1, bgcolor: 'action.hover' }}
            />
            <FileField label="选择封面" accept="image/jpeg,image/png,image/webp,image/gif" file={cover} onChange={setCover} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>取消</Button>
          <Button type="submit" variant="contained" disabled={saving}>保存</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function DeleteDialog({
  game,
  onClose,
  onDeleted,
}: {
  game: GameItem;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    setError('');
    try {
      await removeGame(game.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>删除游戏</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Typography>确定删除「{game.title}」？删除后不能恢复。</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>取消</Button>
        <Button color="error" variant="contained" onClick={() => void confirm()} disabled={saving}>
          {saving ? '删除中' : '删除'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
