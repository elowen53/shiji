# 食记

一个专为 iPhone 16 Pro 设计的个人饮食记录网页应用，iOS 原生级 UI 体验，数据存储在云端 Supabase。

**线上地址**：https://shiji-rho.vercel.app

> 在 iPhone Safari 打开后，分享 →「添加到主屏幕」，即可获得全屏无浏览器框的原生 App 体验。

## 功能

- **每日饮食记录**：不分餐次，从食物库选择食物 + 填写数量（支持 0.5 步进），自动累加当日总热量与蛋白质 / 脂肪 / 碳水
- **食物库自维护**：食物名称、自定义单位（100g / 1份 / 1碗…）、每单位三大营养素含量均由自己维护；**热量按 `蛋白质×4 + 脂肪×9 + 碳水×4`（千卡/克）自动计算**
- **每日指标**：记录每日体重（kg）与总消耗（千卡），自动显示净摄入（总摄入 − 总消耗）
- **历史不受删改影响**：每条记录保存时冗余营养快照，之后修改或删除食物库中的食物不影响已保存的记录
- **交互**：iOS 风格左滑删除、底部弹簧 Sheet、毛玻璃底栏、灵动岛 / Home 指示条安全区适配

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

1. **SQL Editor**：在 Supabase 控制台 SQL Editor 整段执行根目录的 `setup.sql`（幂等，可重复执行）
2. **脚本**：在 <https://supabase.com/dashboard/account/tokens> 生成 Personal Access Token 后运行：

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx VITE_SUPABASE_ANON_KEY=你的key node scripts/setup-db.mjs
```

## 数据模型

| 表 | 说明 |
|---|---|
| `foods` | 食物库：名称、单位、每单位热量 / 蛋白质 / 脂肪 / 碳水 |
| `entries` | 每日记录：日期 + 数量 + 按数量折算后的营养快照（删食物不影响历史） |
| `daily_metrics` | 每日指标：一天一行（日期主键），体重与总消耗 |

三张表均已关闭 RLS（单人使用，anon key 即访问凭证，请勿泄露）。

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
