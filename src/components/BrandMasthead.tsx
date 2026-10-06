/** Shared wordmark; purely presentational so navigation stays in the existing tab bar. */
export default function BrandMasthead() {
  return (
    <div className="mb-4 flex items-center gap-2.5 text-brand" aria-label="食记">
      <span className="editorial-title flex h-7 w-7 items-center justify-center rounded-[9px] bg-brand text-[17px] text-white" aria-hidden="true">食</span>
      <span className="text-[13px] font-semibold tracking-[0.18em]">食记</span>
      <span className="ml-auto text-[9px] font-medium tracking-[0.22em] text-ink-2" aria-hidden="true">THE DAILY JOURNAL</span>
    </div>
  )
}
