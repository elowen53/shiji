import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, Sprout } from 'lucide-react'
import BrandMasthead from '@/components/BrandMasthead'
import FoodFormSheet from '@/components/FoodFormSheet'
import { useToast } from '@/lib/toast'
import type { FoodsApi } from '@/hooks/useFoods'
import { fmtKcal, fmtMacro } from '@/lib/format'
import type { Food } from '@/types'

interface FoodsPageProps {
  foodsApi: FoodsApi
}

export default function FoodsPage({ foodsApi }: FoodsPageProps) {
  const { foods, loading, error, refresh, addFood, updateFood, deleteFood } = foodsApi
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Food | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return foods
    return foods.filter((f) => f.name.toLowerCase().includes(q))
  }, [foods, query])

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (f: Food) => {
    setEditing(f)
    setFormOpen(true)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="page-header">
        <BrandMasthead />
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 text-[12px] text-ink-2">熟悉的食物，清楚的营养</p>
            <h1 className="editorial-title text-[34px] leading-tight text-ink">食物库</h1>
          </div>
          <button type="button" onClick={openAdd}
            className="flex h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-[14px] font-medium text-white active:bg-brand-press">
            <Plus size={18} strokeWidth={1.8} />新增
          </button>
        </div>
      </header>

      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto page-content pb-[112px]">
        <div className="search-field mb-4">
          <Search size={17} className="shrink-0 text-ink-2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索食物名称"
            aria-label="搜索食物"
            className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-2"
          />
        </div>

        <div className="section-heading">
          <h2>{query.trim() ? '搜索结果' : '全部食物'}</h2>
          <span className="tnum text-[11px] font-normal tracking-normal text-ink-2">{filtered.length} 种食物</span>
        </div>
        {loading ? (
          <div className="ios-card">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                {i > 0 && <div className="ios-separator" />}
                <div className="ios-row animate-pulse gap-3">
                  <div className="flex-1">
                    <div className="mb-2 h-4 w-28 rounded bg-fill" />
                    <div className="h-3 w-20 rounded bg-fill" />
                  </div>
                  <div className="h-4 w-14 rounded bg-fill" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="ios-card px-4 py-10 text-center">
            <p className="mb-4 text-[15px] text-ink-2">加载失败：{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-full bg-brand px-5 py-2 text-[15px] font-medium text-white active:bg-brand-press"
            >
              重试
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-symbol"><Sprout size={27} strokeWidth={1.3} /></div>
            <div className="mb-1 text-[17px] font-semibold text-ink">
              {foods.length === 0 ? '食物库还是空的' : '没有匹配的食物'}
            </div>
            <div className="text-[14px] text-ink-2">
              {foods.length === 0 ? '点右上角「新增」添加第一个食物' : '换个关键词试试'}
            </div>
          </div>
        ) : (
          <motion.div layout className="ios-card">
            {filtered.map((f, i) => (
              <div key={f.id}>
                {i > 0 && <div className="ios-separator" />}
                <button
                  type="button"
                  onClick={() => openEdit(f)}
                  className="ios-row w-full gap-3 text-left active:bg-grouped"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[16px] text-ink">{f.name}</div>
                    <div className="tnum mt-[1px] text-[13px] text-ink-2">
                      每{f.unit} · 蛋 {fmtMacro(f.protein)} · 脂 {fmtMacro(f.fat)} · 碳{' '}
                      {fmtMacro(f.carbs)}
                    </div>
                  </div>
                  <div className="tnum shrink-0 text-[15px] font-medium text-ink">
                    {fmtKcal(f.kcal)}
                    <span className="ml-[2px] text-[12px] font-normal text-ink-2">千卡</span>
                  </div>
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </main>

      <FoodFormSheet
        open={formOpen}
        food={editing}
        onClose={() => setFormOpen(false)}
        onSave={async (input) => {
          const ok = editing ? await updateFood(editing.id, input) : await addFood(input)
          toast(ok ? '已保存' : '保存失败，请检查网络', ok ? 'success' : 'error')
          return ok
        }}
        onDelete={
          editing
            ? async () => {
                const ok = await deleteFood(editing.id)
                toast(ok ? '已删除' : '删除失败，请检查网络', ok ? 'success' : 'error')
                return ok
              }
            : undefined
        }
      />
    </div>
  )
}
