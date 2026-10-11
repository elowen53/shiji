// 线上权限回归检查：不修改业务数据，仅创建并撤销一个测试登录会话。
// SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... SHIJI_OWNER_PASSWORD=... node scripts/check-access.mjs
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const password = process.env.SHIJI_OWNER_PASSWORD;
assert.ok(url && key && password, '需要 SUPABASE_URL、SUPABASE_PUBLISHABLE_KEY 和 SHIJI_OWNER_PASSWORD');
const tables = ['foods', 'entries', 'daily_metrics', 'macro_targets'];
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const read = (table, token, limit = 0) => fetch(`${url}/rest/v1/${table}?select=*&limit=${limit}`, {
  headers: { apikey: key, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
});

for (const table of tables) {
  const response = await read(table);
  assert.ok([401, 403].includes(response.status), `${table} 必须拒绝匿名读取，实际 HTTP ${response.status}`);
}
console.log('PASS 四张表均拒绝匿名访问');

const { data, error } = await client.auth.signInWithPassword({ email: 'owner@shiji.local', password });
assert.equal(error, null, '专用账号必须能够登录');
const token = data.session.access_token;
try {
  const access = await client.rpc('shiji_has_access');
  assert.equal(access.error, null);
  assert.equal(access.data, true, '有效专用会话应获得权限');
  for (const table of tables) assert.equal((await read(table, token)).status, 200, `${table} 应允许专用账号读取`);
  console.log('PASS 专用账号能访问四张表');
} finally {
  const logout = await client.auth.signOut({ scope: 'local' });
  assert.equal(logout.error, null, '测试会话必须成功退出');
}

const revoked = await fetch(`${url}/rest/v1/rpc/shiji_has_access`, {
  method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}',
});
// Auth 可直接拒绝旧令牌，或 RLS helper 返回 false；两种方式都不能放行。
if (revoked.ok) assert.equal(await revoked.json(), false, '退出后的旧令牌必须立即失去权限');
else assert.ok([401, 403].includes(revoked.status));
for (const table of tables) {
  const response = await read(table, token, 1);
  if (response.ok) assert.equal((await response.json()).length, 0, `${table} 不得向已退出会话返回数据`);
  else assert.ok([401, 403].includes(response.status));
}
console.log('PASS 退出后旧令牌无法读取数据');
