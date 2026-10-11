import { LockKeyhole } from 'lucide-react'
import { useAccess } from '@/lib/access'

export default function BrandMasthead() {
  const { lock, locking } = useAccess()
  return (
    <div className="mb-4 flex items-center gap-2.5 text-brand" aria-label="食记">
      <span className="editorial-title flex h-7 w-7 items-center justify-center rounded-[9px] bg-brand text-[17px] text-white" aria-hidden="true">食</span>
      <span className="text-[13px] font-semibold tracking-[0.18em]">食记</span>
      <button onClick={lock} disabled={locking} aria-label="锁定食记" className="ml-auto flex min-h-11 items-center gap-1.5 px-2 text-[12px] text-ink-2 disabled:opacity-50"><LockKeyhole size={14} />{locking ? '锁定中…' : '锁定'}</button>
    </div>
  )
}
