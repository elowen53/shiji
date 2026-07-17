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
const sql = readFileSync(join(here, '..', 'setup.sql'), 'utf8');

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

// 通过 PostgREST 验证两张表已出现在 schema cache
console.log('→ 等待 schema cache 刷新并验证表结构 ...');
await new Promise((r) => setTimeout(r, 2000));

const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (anonKey) {
  for (const table of ['foods', 'entries']) {
    const check = await fetch(
      `https://${PROJECT_REF}.supabase.co/rest/v1/${table}?select=*&limit=0`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
    );
    console.log(
      check.ok ? `✅ 表 ${table} 可访问` : `❌ 表 ${table} 验证失败 (HTTP ${check.status})`
    );
    if (!check.ok) process.exit(1);
  }
}
console.log('🎉 全部完成，应用可以直接使用了');
