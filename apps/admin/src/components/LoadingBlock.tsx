import { CircularProgress, Stack, Typography } from '@mui/material';

export function LoadingBlock({ label }: { label?: string }) {
  return (
    <Stack spacing={2} sx={{ alignItems: 'center', justifyContent: 'center', minHeight: 240, py: 8 }}>
      <CircularProgress />
      {label ? <Typography color="text.secondary">{label}</Typography> : null}
    </Stack>
  );
}
