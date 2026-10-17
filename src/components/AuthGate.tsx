import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LockKeyhole } from 'lucide-react'
import AnimatedGroup from '@/components/motion/AnimatedGroup'
import { OWNER_EMAIL } from '@/lib/auth'
import { AccessContext } from '@/lib/access'
import { supabase } from '@/lib/supabase'
import { verifySessionAccess, type AccessStatus } from '@/lib/session-access'

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [locking, setLocking] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const { data: { subscription } } = supabase!.auth.onAuthStateChange(
      (_event, next) => setSession(next),
    )
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return <GateShell><p>正在恢复登录…</p></GateShell>
  if (!session) return <PasswordForm notice={notice} />
  const lock = async () => {
    if (locking) return
    setLocking(true)
    setNotice('')
    try {
      const { error } = await supabase!.auth.signOut({ scope: 'local' })
      // SDK 即使服务端退出失败也会清除本地会话；提示必须保留在登录页。
      if (error) setNotice('此设备已锁定，服务器退出未完成。')
    } catch {
      setNotice('锁定未完成，请检查网络后重试。')
    } finally {
      setLocking(false)
    }
  }
  return <AccessContext.Provider value={{ lock, locking }}><SessionGate key={session.user.id} session={session}>{children}</SessionGate></AccessContext.Provider>
}

function SessionGate({ session, children }: { session: Session; children: ReactNode }) {
  const [result, setResult] = useState<{ token: string; status: AccessStatus } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const status = result?.token === session.access_token ? result.status : 'checking'

  useEffect(() => {
    let active = true
    // 先验证专用账号和仍有效的服务端会话，再挂载任何数据 hooks。
    verifySessionAccess(supabase!, session).then(status => {
      if (!active) return
      setResult({ token: session.access_token, status })
    })
    return () => { active = false }
  }, [session, attempt])

  if (status === 'allowed') return children
  if (status === 'denied') return <PasswordForm notice="登录已失效，请重新输入密码。" />
  return (
    <GateShell>
      <p role={status === 'error' ? 'alert' : 'status'}>
        {status === 'error' ? '暂时无法验证登录，请检查网络后重试。' : '正在验证登录…'}
      </p>
      {status === 'error' && <button className="mt-5 rounded-full bg-brand px-6 py-3 text-white" onClick={() => { setResult(null); setAttempt(n => n + 1) }}>重试</button>}
    </GateShell>
  )
}

function GateShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell safe-top safe-bottom-pad items-center justify-center overflow-y-auto px-8 text-center">
      <AnimatedGroup className="my-8 w-full">
        <div className="mb-6 text-[11px] tracking-[0.2em] text-brand">食记 · THE DAILY JOURNAL</div>
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[22px] bg-surface shadow-[var(--shadow-float)]">
          <LockKeyhole size={32} className="text-brand" strokeWidth={1.6} />
        </div>
        {children}
      </AnimatedGroup>
    </div>
  )
}

function PasswordForm({ notice }: { notice?: string }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !password) return
    setBusy(true)
    setError('')
    try {
      const { error: authError } = await supabase!.auth.signInWithPassword({ email: OWNER_EMAIL, password })
      if (authError) {
        setError(authError.status === 429 ? '尝试次数较多，请稍后再试。' : authError.code === 'invalid_credentials' ? '密码不正确，请重新输入。' : '暂时无法登录，请检查网络后重试。')
      } else {
        setPassword('')
      }
    } catch {
      setError('暂时无法登录，请检查网络后重试。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <GateShell>
      <h1 className="editorial-title mb-3 text-[28px] text-ink">打开你的食记</h1>
      <p className="mb-7 text-[14px] leading-relaxed text-ink-2">输入访问密码，继续记录每一天。</p>
      <form onSubmit={submit} className="text-left">
        <input type="text" name="username" autoComplete="username" value={OWNER_EMAIL} readOnly hidden />
        <label htmlFor="access-password" className="mb-2 block text-[13px] font-medium text-ink-2">访问密码</label>
        <input id="access-password" name="password" type="password" autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} required disabled={busy} value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-2xl border border-brand/20 bg-surface px-4 py-3.5 text-[16px] text-ink" />
        {(error || notice) && <p role="alert" className="mt-3 text-[13px] text-danger">{error || notice}</p>}
        <button type="submit" disabled={busy || !password} className="pressable mt-5 w-full rounded-2xl bg-brand py-3.5 text-[16px] font-medium text-white disabled:opacity-50">{busy ? '正在打开…' : '打开食记'}</button>
      </form>
      <p className="mt-5 text-[12px] leading-relaxed text-ink-2">此设备会记住登录。主动锁定或清除浏览器数据后，需要重新输入密码。</p>
    </GateShell>
  )
}
