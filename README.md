# NES-Simulator

Web NES simulator library.

## Scripts

- `pnpm dev` — start playground
- `pnpm build` — build library (ESM + UMD + types)
- `pnpm typecheck` — TypeScript check

## Library

```ts
import { Main } from 'nes-simulator';

const nes = new Main();
document.body.appendChild(nes.inputComponent());
document.body.appendChild(nes.canvasComponent());
```

## Playground

Demo app lives in `playground/`. It imports the local library entry via the `nes-simulator` alias.
