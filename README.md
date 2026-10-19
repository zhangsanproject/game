# Age of Wind Web

原创的低多边形 3D 海战游戏 MVP，项目代号 **Age of Wind Web**。使用 Vite + TypeScript + Three.js（稳定 `WebGLRenderer`）实现，所有船模、港口、岛屿、海面与特效均由基础几何体和自定义着色器程序化生成，不依赖外部模型、付费资源、在线 API 或后端。

画面风格参考开发环境中的 `demo.png`：明亮的热带浅海、白沙滩与绿岛、较远距离的斜俯视镜头、清晰的白色船尾航迹。该图片只作为本地视觉参考，不进入构建产物、不随仓库分发，也不会作为纹理加载；游戏中的内容全部原创程序化生成。

> 当前版本是**浏览器网页 MVP**。代码通过 `Platform` 接口隔离了浏览器能力，但**尚未实现也没有声称已经可以直接运行在抖音小游戏环境**。适配注意事项见文末。

---

## 快速开始

环境要求：Node.js ≥ 20.19（开发时使用 Node 24.21 / npm 11.19）。

```bash
npm install
npm run dev
```

打开终端打印的地址（默认 `http://localhost:5173`）。

如果 npm 官方源下载缓慢或出现 `ECONNRESET`，可临时使用镜像：

```bash
npm install --registry=https://registry.npmmirror.com
```

### 命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 先做 TypeScript 类型检查，再输出生产构建到 `dist/` |
| `npm run preview` | 预览生产构建 |
| `npm test` | 运行全部 Vitest 单元测试（单次） |
| `npm run test:watch` | 监听模式运行测试 |
| `npm run deploy:cf` | 构建并用 Wrangler 直接上传到 Cloudflare Pages |

### 浏览器验证建议

1. 打开页面，确认开始面板显示金币与强化等级。
2. 点击「开始航行」，用 `WASD` / 方向键航行，`Space` 持续开炮，`Esc` 暂停。
3. 观察敌舰追近、开炮、船体血量与命中反馈；击沉后金币增加。
4. 驶入港口金色环带，点击「停靠 · E」，购买三类强化并「再次出海」。
5. 刷新页面，确认金币与强化等级仍然存在。
6. 用浏览器 DevTools 的设备模拟（触屏 + 竖屏）或直接使用手机访问，确认虚拟摇杆和独立开炮按钮可用。
7. 也可以访问 `?touch=1` 强制显示触屏控件，便于桌面调试。

---

## 部署到 Cloudflare Pages

本项目是纯静态前端，没有服务器、数据库或环境变量，构建产物是完整的 `dist/` 目录，因此最适合直接使用 **Cloudflare Pages**（免费计划即可，自动提供 HTTPS 和 `*.pages.dev` 域名）。

### 构建参数（Git 集成 / CI 通用）

| 参数 | 值 |
| --- | --- |
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Node version | `22`（仓库内已提供 `.nvmrc`；也可在 Pages 环境变量中设置 `NODE_VERSION=22`） |

`vite.config.ts` 使用相对 `base: './'`，因此无论部署在 `*.pages.dev` 子域还是自定义域名根路径都能正确加载资源。项目没有前端路由，不需要额外 SPA rewrite。

### 方式一：连接 Git 自动部署（推荐）

1. 将项目提交并推送到 GitHub / GitLab。仓库中**不要提交** `node_modules/` 和 `dist/`（`.gitignore` 已配置），Cloudflare 会自行安装和构建。如果当前还不是 Git 仓库：

   ```bash
   git init
   git add .
   git commit -m "feat: Age of Wind Web MVP"
   git branch -M main
   git remote add origin <你的仓库地址>
   git push -u origin main
   ```

2. 打开 Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
3. 选择仓库，填写上表的构建参数，设置 `NODE_VERSION=22`。
4. 点击部署。之后每次推送都会自动构建，非生产分支会得到独立的 Preview URL。

### 方式二：Wrangler 命令行直接上传

无需 Git，第一次会要求浏览器登录 Cloudflare：

```bash
npx wrangler@latest login
npm run deploy:cf
```

等价于：

```bash
npm run build
npx wrangler@latest pages deploy dist --project-name age-of-wind-web
```

如果项目名已被占用，把 `--project-name` 换成自己的名字。首次部署时可以按提示创建项目，或者先在 Dashboard 创建同名 Pages 项目。

在 CI 中可改用 API Token：

```bash
export CLOUDFLARE_API_TOKEN=你的Token
export CLOUDFLARE_ACCOUNT_ID=你的AccountID
npx wrangler@latest pages deploy dist --project-name age-of-wind-web
```

### 方式三：Dashboard 手动上传

1. 本地执行 `npm run build`。
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Upload assets**（Direct Upload）。
3. 上传整个 `dist/` 目录并部署。
4. 之后更新需要重新构建并再次上传。

### 缓存与自定义域名

- `public/_headers` 会被 Vite 复制到 `dist/_headers`：`/assets/*` 使用一年 immutable 缓存，`index.html` 每次校验更新。
- Pages 项目 → **Custom domains** 可绑定自己的域名，DNS 和证书由 Cloudflare 处理。
- 不建议把 `dist/` 提交到 Git；直接上传模式的构建结果也不会自动更新，需重新部署。

> 本项目不需要 Cloudflare Workers、Pages Functions、D1、R2 或其他绑定。若未来增加在线排行榜/账号等后端能力，再考虑 Workers 或 D1。

---

## 操作说明

### 电脑

- `W` / `↑`：前进加速
- `S` / `↓`：减速 / 倒船
- `A` / `←`：左转
- `D` / `→`：右转
- `Space`：开炮（按住连续射击，受冷却限制）
- `E`：在港口水域内停靠
- `Esc` / `P`：暂停 / 继续
- 右上角暂停按钮同样可用

### 手机 / 触屏

- 左下角虚拟摇杆：向上推前进、左右推转向（支持多点触控）
- 右下角「开炮」按钮：按住连射
- 港口提示出现时点击「停靠 · E」
- 右上角暂停按钮

---

## 已实现功能

### 场景与视觉

- 明亮的热带海面：自定义着色器叠加多组正弦波、细节法线与高光；深海蓝绿到浅海绿松石色自然过渡。
- 岛屿浅水系统：海面着色器根据港口与三座装饰岛屿的中心/半径绘制宽阔的绿松石浅水架、动态白色拍岸泡沫和柔和岛屿阴影。
- 三座程序化热带岛屿 + 港口岛：宽阔白沙滩、草地、圆冠树、灌木、灰色礁石，港口另含木栈桥、灯塔、瞭望塔、房屋、灯柱、木箱与旗帜。
- 较远距离的斜俯视跟随镜头：船只在画面中保持可读的小比例，镜头平滑跟随、随航速轻微变化 FOV，命中时屏震。
- 程序化战船：挤出船体、船首、甲板、船舱、桅杆、横桁、三面帆、旗帜、舷炮、栏杆、灯笼。玩家为木质船体 + 奶油色帆，敌舰为深色船体 + 近黑色帆，辨识度高。
- 船尾软泡沫航迹：运行时生成的柔和泡沫纹理 + 固定容量粒子池，随船速拉出连续白色尾迹；另有命中水花、火花、烟雾、炮口闪光。
- 船体浮沉 / 侧倾、沉船冒烟与下沉动画、炮弹弧线与烟迹。
- 渐变天空、远云、雾、半球光 / 平行光 / 环境光；不使用实时阴影、后处理或昂贵海面模拟。

### 玩法

- 渐进式航行：加速度、最高航速、减速惯性、速度相关的转向效率、倒船速度限制、圆形海域边界。
- 战斗：双方 HP、炮弹飞行、分段碰撞检测、射击冷却、命中反馈、沉没。
- 敌船 AI：远距离追击、中距离舷侧环绕、过近时拉开、提前量瞄准、简单分离、世界边界与岛屿规避。
- 击沉奖励：每艘敌舰 25 金币，`RewardSystem` 按敌舰 ID 去重，重复的沉没事件不会重复发钱。
- 港口：范围内停靠，免费修理，打开升级面板。
- 三类升级（各 5 级）：
  - 船体耐久：最大 HP +25 / 级
  - 航速强化：最高航速 +1.4、加速 +0.35 / 级
  - 火炮伤害：单发伤害 +6 / 级
- 航程目标：初始击沉 5 艘；胜利后可继续航行（目标 +5）或重新开始。
- 失败与重开：玩家沉没后显示结果面板，金币与升级保留。
- 敌舰会持续补充，场上最多 3 艘；被击沉的敌舰在动画结束后从场景与模拟数组中移除。

### HUD 与界面

- 船体 HP 条、航速、击沉进度、金币、敌舰数量与逐舰 HP 条。
- 火炮冷却条与「火炮就绪」提示。
- 港口交互提示、伤害红晕、金币 toast。
- 开始页、暂停 / 继续、港口升级、胜利 / 沉没结果与重开入口。
- 响应式布局，适配桌面、手机竖屏和较矮的横屏；控制区使用 `safe-area-inset-*`，不阻塞指针操作的 HUD 区域设置了 `pointer-events: none`。
- 所有文字使用系统中文字体，无外部字体请求。

### 存档

- `SaveManager` + `StorageAdapter`：网页端由 `WebStorage` 使用 `localStorage`。
- 存档字段：版本、金币、三项升级等级、累计击沉数。
- 版本号：`SAVE_CONFIG.version = 1`。
- 无效 JSON、未知版本、非对象数据会安全回退到默认存档；数值会被裁剪到合法范围。
- 写入失败（隐私模式、配额不足等）不会抛出异常，并在游戏内提示。
- 开始页、暂停页、港口面板均提供「重置存档」（需二次点击确认）。

---

## 目录结构

```text
src/
  main.ts                     启动、渲染器失败兜底
  game/
    Game.ts                   场景 / 系统 / UI 总装
    GameLoop.ts               requestAnimationFrame + delta clamp
    config.ts                 集中数值配置
    types.ts                  纯类型
    math.ts                   角度、距离、线段碰撞等纯函数
    entities/
      Ship.ts                 纯航行实体
      PlayerShip.ts
      EnemyShip.ts
      Projectile.ts
    systems/
      MovementSystem.ts       移动、边界、软碰撞、岛屿避障
      CombatSystem.ts         开炮、冷却、炮弹、命中、沉没事件
      EnemyAISystem.ts        敌舰决策
      RewardSystem.ts         击沉奖励去重
      UpgradeSystem.ts        价格、扣款、属性推导
    world/
      Sea.ts                  海面着色器（波浪、浅水、拍岸泡沫）
      Environment.ts          天空、雾、光照、云
      Harbor.ts               程序化港口岛
      Archipelago.ts          三座装饰性热带岛屿
      IslandDecor.ts          共享树木 / 灌木 / 礁石资源
      CameraController.ts     跟随摄像机
    view/
      ShipAssets.ts           共享几何体与材质
      ShipView.ts             船模搭建与动画
      Effects.ts              固定容量粒子池
      ProjectileViewPool.ts   炮弹网格池
  input/
    InputManager.ts           键盘 + 触控统一快照
    KeyboardInput.ts
    TouchInput.ts
  platform/
    Platform.ts               平台能力接口
    web/WebPlatform.ts        WebGL / RAF / resize / visibility
    web/WebStorage.ts         localStorage 适配
  save/
    Storage.ts
    SaveData.ts               数据结构、版本标记、校验
    SaveManager.ts            读写、重置、错误隔离
  ui/
    HUD.ts                    HUD / 开始 / 暂停 / 结果界面
    HarborUI.ts               港口升级面板
    showFatalError.ts
  styles/main.css
tests/
```

---

## 架构与解耦

- **规则层**（`entities`、`systems`、`config`、`math`、`save`）不引用 Three.js、DOM、`window` 或 `localStorage`，可在 Node 中直接进行单元测试。
- **渲染层**（`world`、`view`）只负责 Three.js 对象与视觉反馈。
- **交互层**（`input`、`ui`）处理 DOM / 键盘 / Pointer 事件。
- **平台层**（`platform/Platform.ts`）注入：
  - `storage`
  - `requestFrame` / `cancelFrame` / `now`
  - `getViewport`
  - `createRenderer`
  - `onResize` / `onVisibilityChange`
  - `isTouch`
- `Game` 只做编排：读取输入快照 → 更新纯逻辑 → 广播事件 → 同步视图与 UI。金币和升级会立即通过 `SaveManager` 持久化。

### 游戏循环

- 使用 `requestAnimationFrame`（由 Platform 提供）。
- 每帧 delta 由 `clampDelta` 限制在 **50 ms** 以内，避免切后台回来时物理瞬移。
- 暂停 / 港口 / 结果显示时停止模拟，但继续渲染场景与粒子衰减。
- 窗口尺寸与方向变化会更新相机宽高比、渲染尺寸，并限制设备像素比（桌面 ≤ 2，触屏 ≤ 1.75）。
- 页面隐藏时自动暂停（若正在航行）。
- `Game.dispose()` 会停止循环、移除监听、取消 UI 定时器、释放几何体 / 材质 / 渲染器。

### 资源管理

- 船的几何体与材质由 `ShipAssets` 共享，所有敌舰与玩家共用。
- 炮弹、烟雾、水花、火花、炮口闪光、航迹均为固定容量对象池，循环复用，不会无限增长。
- 被击沉的敌舰在动画结束后移除网格与模拟数据。
- 无实时阴影、无后处理、无逐帧新建几何体 / 材质。
- 岛屿几何体、树木与礁石在各自模块内共享；岛屿数量与浅水半径集中在 `GAME_CONFIG`。
- 生产 JS 约 638 kB（gzip ≈ 165 kB），主要来自 Three.js；构建时的大小警告不影响运行。

---

## 测试

```bash
npm test
```

当前共 6 个测试文件、27 个测试用例：

- `movement.test.ts`：加速上限、惯性减速、倒船上限、速度相关转向、异常帧间隔裁剪。
- `combat.test.ts`：冷却、炮弹命中、伤害、升级后伤害、沉没事件只发一次、冷却恢复。
- `reward.test.ts`：同一敌舰只奖励一次、无效金额、会话重置。
- `upgrade.test.ts`：扣款、余额不足、满级、属性推导、成本递增。
- `save.test.ts`：默认值、往返序列化、损坏 JSON、版本不匹配、非法字段清洗、重置、写入失败。
- `enemyAI.test.ts`：远距离追击、射程内开火、冷却期间不开火。

构建：

```bash
npm run build
```

实测通过（Vite 8 / TypeScript 7 / Three.js 0.186.1 / Vitest 5）。

---

## 已知限制与实现假设

- 当前只实现了 `WebPlatform`。没有抖音小游戏工程、没有 `tt` API 调用、没有小游戏分包或审核配置。
- UI 基于 DOM / CSS；抖音小游戏通常没有 DOM，需要单独适配（见下文）。
- 没有音效与背景音乐（避免引入外部音频资源与自动播放限制）。
- 战斗为前向炮击；敌舰 AI 的炮弹会直接朝预判点飞行，没有真实弹道下坠与风偏。
- 港口与三座装饰岛屿使用圆形软碰撞体；炮弹不与岛屿、栈桥、礁石发生碰撞。
- 船只之间只做软分离，不产生碰撞伤害。
- 海面浅水与岛屿阴影由解析着色器近似，不是真实水深、折射或阴影贴图。
- 航行区域边界为不可见圆形，越界时会被推回并损失速度。
- 入港会免费修复船体；升级会立即作用于当前船只。
- 重开一局保留金币与升级（元进度），只重置航程、击杀数、敌舰与玩家船。
- HUD 的「节」按内部速度 × 1.9 显示，仅为可读性转换，不是真实物理单位。
- 玩家初始位置面向港口；需要转向后出海。
- 存档在击沉、购买升级与重置时写入；如果浏览器完全禁用存储，进度只在当前页面会话中保留。
- 使用当前浏览器存档键 `age-of-wind-web-save`；修改版本号会让旧存档安全回退为默认值。

---

## 后续抖音小游戏适配注意事项

1. **新增 `DouyinPlatform`**：实现 `Platform` 接口。
   - `storage`：包装 `tt.getStorageSync` / `tt.setStorageSync` / `tt.removeStorageSync`。
   - `requestFrame` / `cancelFrame`：使用小游戏提供的帧回调对象。
   - `createRenderer`：用 `tt.createCanvas()` 获取画布并把 canvas 交给 `THREE.WebGLRenderer`；确认目标基础库支持 WebGL。
   - `getViewport`：使用 `tt.getSystemInfoSync()` 的屏幕尺寸与像素比，并按性能进一步限制 DPR。
   - `onVisibilityChange`：接入 `tt.onHide` / `tt.onShow`，在后台暂停模拟并清空按键状态。
2. **替换 DOM 输入层**：`KeyboardInput`、`TouchInput`、`HUD`、`HarborUI` 都依赖浏览器 DOM。小游戏端需要把触摸事件映射为 `InputSnapshot`，并用 Canvas / 小游戏 UI 方案重写 HUD 与面板。核心模拟与 `SaveManager` 不需要改动。
3. **移除浏览器全局对象**：不要在游戏规则层直接使用 `window`、`document`、`performance`、`localStorage`。当前代码已通过 Platform 隔离，但 `WebPlatform` 本身仍是浏览器专属。
4. **UI 尺寸与安全区**：小游戏设备碎片化更明显，需要重新验证竖屏布局、触控热区和刘海 / 圆角安全区。
5. **性能预算**：当前海面网格约 1.4 万四边形，粒子为固定池。低端机可进一步降低海面细分、粒子上限与 DPR。
6. **资源打包**：当前全部为程序化资源，无需下载模型；若未来加入纹理 / 音频，需要纳入小游戏分包与缓存策略。
7. **存档版本迁移**：保持 `SAVE_CONFIG.version` 与 `sanitizeSaveData` 的兼容逻辑，新增字段时提供迁移而不是直接丢弃旧存档。
8. **不要默认可以直接发布**：需要实际的抖音开发者工具、真机测试、隐私与内容审核流程后才能宣称兼容。

---

## 原创声明

项目代码、程序化船模、港口、岛屿、海面与界面均为本次 MVP 原创实现。没有复制 Age of Wind 2 或其他商业游戏的代码、商标、模型或美术素材。`demo.png` 是用户提供的视觉风格参考，仅用于本地对照，不参与构建、不加载为游戏纹理。项目代号仅用于本次开发任务。
