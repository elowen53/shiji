// 「食记」一键建表脚本
// 通过 Supabase Management API 执行 setup.sql，无需手动打开 SQL Editor
// 用法: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/setup-db.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PROJECT_REF = 'rlnbofvezgatfbmxgmlm';

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('❌ 缺少 SUPABASE_ACCESS_TOKEN 环境变量');
  console.error('   获取方式: https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, '..', 'setup.sql'), 'utf8') + '\n' +
  readFileSync(join(here, '..', 'supabase/migrations/20261011_private_access.sql'), 'utf8') + '\n' +
  readFileSync(join(here, '..', 'supabase/migrations/20261014_analysis_reader.sql'), 'utf8');

console.log(`→ 正在项目 ${PROJECT_REF} 上执行建表 SQL ...`);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  }
);

const text = await res.text();
if (!res.ok) {
  console.error(`❌ 建表失败 (HTTP ${res.status}):`, text);
  process.exit(1);
}

console.log('✅ SQL 执行成功:', text);

// 未登录请求必须被数据库拒绝；publishable key 不是访问凭证。
console.log('→ 等待 schema cache 刷新并验证匿名访问已关闭 ...');
await new Promise((r) => setTimeout(r, 2000));

const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (anonKey) {
  for (const table of ['foods', 'entries', 'daily_metrics', 'macro_targets']) {
    const check = await fetch(
      `https://${PROJECT_REF}.supabase.co/rest/v1/${table}?select=*&limit=0`,
      { headers: { apikey: anonKey } }
    );
    console.log(
      [401, 403].includes(check.status) ? `✅ 表 ${table} 拒绝匿名访问` : `❌ 表 ${table} 权限验证失败 (HTTP ${check.status})`
    );
    if (![401, 403].includes(check.status)) process.exit(1);
  }
}
console.log('🎉 数据库初始化完成；专用账号配置见 README。');
