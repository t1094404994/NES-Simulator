# NES-Simulator

NES 模拟器。模拟器在 `core/nes`，网页和小程序在 `apps`，游戏列表的类型和数据库分别在 `packages/shared`、`packages/db`。

## Scripts

- `pnpm dev` — playground
- `pnpm build` — 打包模拟器库
- `pnpm typecheck` — 各包类型检查
- `pnpm server` — 游戏列表后台（默认 `http://127.0.0.1:8787`）
- `pnpm web` — Next.js 网页壳
- `docker compose up --build` — 同时启动后台和网页。游戏数据在卷 `server-data`。管理令牌用环境变量 `ADMIN_TOKEN`（默认 `dev-admin-token`）。网页和后台只绑定 `127.0.0.1`（3000、8787）。浏览器直接访问后台，改地址时设置 `NEXT_PUBLIC_API_BASE` 后重新构建网页镜像。
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build` — 正式环境。域名是 `https://www.nes-simulator.com`，对外只开 HTTP 和 HTTPS。nginx 把页面转到本机网页，把 `/api` 转到本机后台。别的机器上的服务也写在 `deploy/nginx/www.nes-simulator.com.conf` 里转发，不要另开端口。

后台用 Prisma 和 SQLite，库文件在 `apps/server/data/games.db`（容器里是 `/data/games.db`）。启动时会把仓库 `source` 目录中的 `.nes` 写入数据库。已经导入过的 ROM 会保留，封面按 `source/covers` 里的同名图片更新，没有专属封面时用 `default.png`。

## Library

```ts
import { Nes } from 'nes-simulator';

const nes = new Nes();
nes.onFrame = (frame) => {
  // frame.rgba 为 256×240
};
nes.onAudio = (audio) => {
  // audio.samples 为 44100Hz 单声道
};
```

浏览器演示仍可用 `Main`，playground 在 `core/nes/playground/`。
