import { keyframes } from '@emotion/react';
import { Box } from '@mui/material';
import { useEffect, useState } from 'react';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const shimmer = keyframes`
  from { background-position: 0% 0%; }
  to { background-position: 0% 100%; }
`;

const TONES = {
  gold: ['#fff7c2', '#fde047', '#f59e0b', '#b45309'],
  cyan: ['#ecfeff', '#67e8f9', '#0284c7', '#0c4a6e'],
  pink: ['#ffe4f1', '#f9a8d4', '#db2777', '#831843'],
  lime: ['#f7fee7', '#bef264', '#65a30d', '#365314'],
} as const;

export type ArtTone = keyof typeof TONES;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function RollingDigit({ value, delay, tone }: { value: number; delay: number; tone: ArtTone }) {
  const [reduced] = useState(prefersReducedMotion);
  const [current, setCurrent] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setCurrent(value);
      return;
    }
    const frame = requestAnimationFrame(() => setCurrent(value));
    return () => cancelAnimationFrame(frame);
  }, [reduced, value]);

  const colors = TONES[tone];
  const glyph = {
    height: '1em',
    lineHeight: 1,
    backgroundImage: `linear-gradient(180deg, ${colors[0]} 0%, ${colors[1]} 34%, ${colors[2]} 68%, ${colors[3]} 100%)`,
    backgroundSize: '100% 220%',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
    WebkitTextStroke: '0.6px rgba(15, 23, 42, 0.45)',
    animation: reduced ? 'none' : `${shimmer} 2.8s ease-in-out infinite alternate`,
  };

  return (
    <Box component="span" sx={{ display: 'inline-block', height: '1em', overflow: 'hidden' }}>
      <Box
        component="span"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          transform: `translateY(-${current}em)`,
          transition: reduced ? 'none' : `transform 900ms cubic-bezier(0.22, 1.15, 0.36, 1) ${delay}ms`,
        }}
      >
        {DIGITS.map((digit) => (
          <Box component="span" key={digit} sx={glyph}>{digit}</Box>
        ))}
      </Box>
    </Box>
  );
}

export function ArtNumber({
  value,
  tone = 'gold',
  size = 'lg',
}: {
  value: number;
  tone?: ArtTone;
  size?: 'lg' | 'md';
}) {
  const text = Math.max(0, Math.floor(value)).toLocaleString('zh-CN');
  const chars = text.split('');
  return (
    <Box
      component="span"
      aria-label={text}
      sx={{
        display: 'inline-flex',
        alignItems: 'flex-end',
        fontFamily: '"Arial Black", Impact, "PingFang SC", sans-serif',
        fontWeight: 900,
        fontSize: size === 'lg' ? { xs: 34, sm: 42 } : 22,
        letterSpacing: '0.04em',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        filter: size === 'lg'
          ? 'drop-shadow(0 2px 0 rgba(15, 23, 42, 0.55)) drop-shadow(0 8px 12px rgba(15, 23, 42, 0.18))'
          : 'drop-shadow(0 1px 0 rgba(15, 23, 42, 0.35))',
      }}
    >
      <Box component="span" aria-hidden sx={{ display: 'inline-flex', alignItems: 'flex-end' }}>
        {chars.map((char, index) => {
          const fromEnd = chars.length - index;
          if (char >= '0' && char <= '9') {
            return <RollingDigit key={`d-${fromEnd}`} value={Number(char)} delay={index * 70} tone={tone} />;
          }
          return (
            <Box
              component="span"
              key={`s-${fromEnd}`}
              sx={{
                height: '1em',
                lineHeight: 1,
                px: '0.04em',
                color: TONES[tone][2],
                WebkitTextStroke: '0.4px rgba(15, 23, 42, 0.35)',
              }}
            >
              {char}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
