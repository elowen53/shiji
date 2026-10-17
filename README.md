# 食记

一个专为 iPhone 16 Pro 设计的个人饮食记录网页应用，iOS 原生级 UI 体验，数据存储在云端 Supabase。

**线上地址**：https://shiji-rho.vercel.app

> 在 iPhone Safari 打开后，分享 →「添加到主屏幕」，即可获得全屏无浏览器框的原生 App 体验。

## 功能

- **每日饮食记录**：不分餐次，从食物库选择食物 + 填写数量（支持 0.1 起步进）；外食等偶尔吃一次的食物可「临时记录」，只记入当天不进食物库；自动累加当日总热量与蛋白质 / 脂肪 / 碳水
- **食物库自维护**：食物名称、自定义单位（100g / 1份 / 1碗…）、每单位三大营养素含量均由自己维护；**热量按 `蛋白质×4 + 脂肪×9 + 碳水×4`（千卡/克）自动计算**
- **每日指标**：记录每日体重（kg）、腰围（cm）与总消耗（千卡），自动显示净摄入（总摄入 − 总消耗）
- **热量收支**：趋势页按日展示热量缺口 / 盈余（摄入 − 总消耗，只统计饮食与消耗都记录了的已结束日子）与 7 日均值；并将按热量推算的预期体重变化（÷ 7700 千卡/kg）与 7 日均重的实际变化对照，估算记录偏差
- **营养目标**：蛋白质 / 脂肪 / 碳水目标各自按「克 / 公斤体重」手动设置，每日目标 = 系数 × 最近一次体重，并显示完成进度
- **历史不受删改影响**：每条记录保存时冗余营养快照，之后修改或删除食物库中的食物不影响已保存的记录
- **交互**：iOS 风格左滑删除、底部弹簧 Sheet、毛玻璃底栏、灵动岛 / Home 指示条安全区适配
- **密码访问**：使用 Supabase Auth 验证访问密码；登录在当前设备持久保存并自动续期，顶部「锁定」会退出当前设备。

## AI 历史数据分析

已提供供 Claude Code / Codex 使用的只读 MCP 服务，以及共用查询逻辑的 HTTP API，支持数据概况、每日历史、饮食明细分页、周/月汇总和当前营养目标。使用独立分析 Token 与 PostgreSQL 只读角色，保留现有网页认证。

配置、数据库迁移、本地启动与客户端示例见 [AI 分析接口文档](docs/analysis-api.md)。本地开发使用 Node.js 22；`npm run test:analysis` 运行离线集成测试，`npm run analysis:dev` 启动分析服务。

## 技术栈

- **前端**：React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + framer-motion
- **数据库**：Supabase（PostgreSQL，前端通过 PostgREST 直连）
- **部署**：Vercel（静态站点，环境变量注入 Supabase 配置）

## 本地开发

```bash
npm install
cp .env.example .env.local   # 填入下面两个变量
npm run dev                  # 默认 3000 端口，支持 -- --port <N>
```

`.env.local` 需要的变量（Supabase 控制台 → Settings → API 获取）：

```
VITE_SUPABASE_URL=https://你的项目.supabase.co
VITE_SUPABASE_ANON_KEY=你的 publishable key
```

未配置时应用会显示配置引导页而不是报错。

## 数据库初始化

两种方式任选其一：

1. **SQL Editor**：依次执行根目录的 `setup.sql`、`supabase/migrations/20261011_private_access.sql` 和 `supabase/migrations/20261014_analysis_reader.sql`（幂等，可重复执行；分析角色默认未启用登录）
2. **脚本**：在 <https://supabase.com/dashboard/account/tokens> 生成 Personal Access Token 后运行：

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx VITE_SUPABASE_ANON_KEY=你的key node scripts/setup-db.mjs
```

## 数据模型

| 表 | 说明 |
|---|---|
| `foods` | 食物库：名称、单位、每单位热量 / 蛋白质 / 脂肪 / 碳水 |
| `entries` | 每日记录：日期 + 数量 + 按数量折算后的营养快照（删食物不影响历史） |
| `daily_metrics` | 每日指标：一天一行（日期主键），体重、腰围与总消耗 |
| `macro_targets` | 营养目标：单行表（id = 1），蛋白质 / 脂肪 / 碳水的 g/kg 系数，空值为未设置 |

四张表均启用 RLS，撤销匿名访问，只允许 `owner@shiji.local` 的有效登录会话执行增删改查。公开的 publishable / anon key 不能访问数据；即使另一个账号登录也没有数据权限。锁定时会撤销当前会话，旧访问令牌也无法继续读写这些表。

独立的 `shiji_analysis_reader` 数据库角色仅允许读取这四张表，供分析服务使用；不属于浏览器的 `authenticated` 登录体系，需另行配置凭证后启用。

## 访问账号与 iPhone 登录

首次部署时，由管理员在服务端通过 Supabase Auth Admin API 创建 `owner@shiji.local`，设定访问密码并确认邮箱（`email_confirm: true`）。这个地址仅作为内部账号标识，不发送邮件。密码和 service role / secret key 不得放入前端环境变量、源码或 Git；前端仅使用公开 API key。

输入一次密码后，Supabase 将会话保存在当前浏览器并自动刷新。默认会话没有固定到期时间；清除网站数据、使用无痕浏览、手动锁定或管理员撤销会话后需重新登录。iPhone 上尽量固定使用 Safari 或主屏幕入口，同一入口可复用登录；不同入口可能使用不同的网站存储。登录页面支持系统密码自动填充。

生产项目应在 Authentication → Sign In / Providers 关闭新用户注册。不要为其他账号添加放宽访问的策略。重新执行建表脚本不会关闭 RLS。

权限回归检查可运行 `npm run test:access`，通过本地环境变量提供 `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY` 和 `SHIJI_OWNER_PASSWORD`。它检查匿名访问被拒绝、专用账号可读取、退出后旧令牌失效；不会修改业务数据。不要把密码写入提交的文件。

## 部署

项目已关联 Vercel 项目 `shiji`。更新代码后：

```bash
vercel deploy --prod --token <VERCEL_TOKEN>
```

生产环境变量（`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`）已在 Vercel 项目配置中设置，CLI 部署会自动使用。

## 目录结构

```
src/
  pages/       DiaryPage（记录页）、FoodsPage（食物库页）
  components/  BottomSheet、AddEntrySheet、FoodFormSheet、MetricsSheet、EntryRow 等
  hooks/       useEntries、useFoods、useMetrics
  lib/         supabase 客户端、日期 / 格式化工具、toast
  types.ts     Food / Entry / DailyMetric 类型定义
scripts/
  setup-db.mjs 一键建表脚本（Management API）
setup.sql      数据库建表脚本（可重复执行）
```
