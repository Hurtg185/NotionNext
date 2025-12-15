import { useState, useRef } from 'react'
import CategoryBar from './CategoryBar'

export default function HomeNew(props) {
  const [open, setOpen] = useState(false)
  const startX = useRef(0)

  /* 拖拽逻辑（Telegram 风格） */
  const onTouchStart = e => {
    startX.current = e.touches[0].clientX
  }

  const onTouchMove = e => {
    const diff = e.touches[0].clientX - startX.current
    if (diff > 80) setOpen(true)
    if (diff < -80) setOpen(false)
  }

  return (
    <div
      className="relative flex h-screen bg-[#f7f9fe] dark:bg-[#18171d]"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
    >
      {/* 侧边栏 */}
      <aside
        className={`
          fixed z-40 top-0 left-0 h-full w-64
          bg-white dark:bg-[#1e1e1e]
          border-r dark:border-gray-700
          transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-5 text-xl font-bold">
          学中文
        </div>

        <nav className="px-3 space-y-2">
          {['拼音', 'HSK', '口语', '句型', '收藏'].map(item => (
            <div
              key={item}
              className="px-4 py-2 rounded-lg cursor-pointer
              hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {item}
            </div>
          ))}
        </nav>
      </aside>

      {/* 遮罩 */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 主区 */}
      <main className="flex-1 w-full overflow-y-auto px-5 md:px-10 py-8">
        {/* 顶部按钮 */}
        <div className="mb-6">
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white"
          >
            ☰ 菜单
          </button>
        </div>

        {/* Hero */}
        <section className="mb-8">
          <h1 className="text-4xl font-extrabold mb-3">
            给缅甸人学的中文
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            不背语法 · 先敢开口  
            <br />
            从拼音开始学真正能用的汉语
          </p>
        </section>

        {/* 🔖 标签栏（和你旧代码风格一致） */}
        <div className="mb-8">
          <CategoryBar {...props} />
        </div>

        {/* 拼音入口 */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['b p m f', 'd t n l', 'g k h', 'j q x'].map(row => (
            <div
              key={row}
              className="bg-white dark:bg-[#1e1e1e]
              rounded-xl p-5 text-center
              hover:shadow cursor-pointer"
            >
              <div className="text-xl font-bold">{row}</div>
              <div className="text-sm text-gray-500 mt-2">
                点击学习
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
