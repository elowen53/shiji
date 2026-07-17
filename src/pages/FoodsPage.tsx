import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search } from 'lucide-react'
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
      <header className="safe-top shrink-0 px-4 pb-2 pt-2">
        <div className="flex h-11 items-center justify-end">
          <button
            type="button"
            onClick={openAdd}
            className="flex h-9 items-center gap-1 rounded-full bg-[#007AFF]/10 px-3.5 text-[15px] font-medium text-[#007AFF] active:bg-[#007AFF]/20"
          >
            <Plus size={17} strokeWidth={2.4} />
            新增
          </button>
        </div>
        <h1 className="mt-1 text-[34px] font-bold leading-tight tracking-tight text-[#1C1C1E]">
          食物库
        </h1>
      </header>

      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[110px]">
        <div className="mb-4 flex h-10 items-center gap-2 rounded-xl bg-[#E5E5EA] px-3">
          <Search size={17} className="shrink-0 text-[#8E8E93]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索"
            className="w-full bg-transparent text-[16px] text-[#1C1C1E] outline-none placeholder:text-[#8E8E93]"
          />
        </div>

        {loading ? (
          <div className="ios-card">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                {i > 0 && <div className="ios-separator" />}
                <div className="ios-row animate-pulse gap-3">
                  <div className="flex-1">
                    <div className="mb-2 h-4 w-28 rounded bg-[#E5E5EA]" />
                    <div className="h-3 w-20 rounded bg-[#E5E5EA]" />
                  </div>
                  <div className="h-4 w-14 rounded bg-[#E5E5EA]" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="ios-card px-4 py-10 text-center">
            <p className="mb-4 text-[15px] text-[#8E8E93]">加载失败：{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-full bg-[#007AFF] px-5 py-2 text-[15px] font-medium text-white active:bg-[#0066D6]"
            >
              重试
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <div className="mb-4 text-[52px] leading-none">🥗</div>
            <div className="mb-1 text-[17px] font-semibold text-[#1C1C1E]">
              {foods.length === 0 ? '食物库还是空的' : '没有匹配的食物'}
            </div>
            <div className="text-[14px] text-[#8E8E93]">
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
                  className="ios-row w-full gap-3 text-left active:bg-[#F2F2F7]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[16px] text-[#1C1C1E]">{f.name}</div>
                    <div className="tnum mt-[1px] text-[13px] text-[#8E8E93]">
                      每{f.unit} · 蛋 {fmtMacro(f.protein)} · 脂 {fmtMacro(f.fat)} · 碳{' '}
                      {fmtMacro(f.carbs)}
                    </div>
                  </div>
                  <div className="tnum shrink-0 text-[15px] font-medium text-[#1C1C1E]">
                    {fmtKcal(f.kcal)}
                    <span className="ml-[2px] text-[12px] font-normal text-[#8E8E93]">千卡</span>
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
