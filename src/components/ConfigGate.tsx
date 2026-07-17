import { Database, KeyRound, Link2 } from 'lucide-react'

/**
 * 环境变量未配置时展示的引导页，避免白屏报错。
 */
export default function ConfigGate() {
  return (
    <div className="app-shell items-center justify-center px-8">
      <div className="flex w-full flex-col items-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[22px] bg-white shadow-sm">
          <Database size={36} className="text-[#007AFF]" strokeWidth={1.6} />
        </div>
        <h1 className="mb-2 text-[28px] font-bold tracking-tight text-[#1C1C1E]">
          连接你的数据库
        </h1>
        <p className="mb-8 text-[15px] leading-relaxed text-[#8E8E93]">
          「食记」使用 Supabase 存储数据。请在项目根目录的{' '}
          <code className="rounded bg-[#E5E5EA] px-1.5 py-0.5 text-[13px] text-[#1C1C1E]">
            .env.local
          </code>{' '}
          中填入以下两个值，然后重启开发服务器：
        </p>

        <div className="ios-card w-full text-left">
          <div className="ios-row gap-3" style={{ minHeight: 56 }}>
            <Link2 size={20} className="shrink-0 text-[#007AFF]" />
            <div className="min-w-0">
              <div className="tnum text-[13px] text-[#8E8E93]">VITE_SUPABASE_URL</div>
              <div className="truncate text-[15px] text-[#1C1C1E]">
                Supabase 项目的 Project URL
              </div>
            </div>
          </div>
          <div className="ios-separator" />
          <div className="ios-row gap-3" style={{ minHeight: 56 }}>
            <KeyRound size={20} className="shrink-0 text-[#007AFF]" />
            <div className="min-w-0">
              <div className="tnum text-[13px] text-[#8E8E93]">
                VITE_SUPABASE_ANON_KEY
              </div>
              <div className="truncate text-[15px] text-[#1C1C1E]">
                Supabase 项目的 anon public key
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-[13px] leading-relaxed text-[#AEAEB2]">
          首次使用请先在 Supabase SQL Editor 执行项目根目录的 setup.sql
        </p>
      </div>
    </div>
  )
}
