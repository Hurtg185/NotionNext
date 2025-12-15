/**
 * 首页（入口页）
 * 只显示功能按钮，不显示内容
 */
const LayoutIndex = () => {
  const router = useRouter()

  const features = [
    {
      key: 'pinyin',
      title: '拼音',
      desc: '听音 · 跟读 · 纠音',
      icon: '🔊',
      color: 'from-blue-500 to-sky-500'
    },
    {
      key: 'hanzi',
      title: '汉字',
      desc: '笔顺动画 · 跟着写',
      icon: '✍️',
      color: 'from-emerald-500 to-teal-500'
    },
    {
      key: 'words',
      title: '单词',
      desc: '高频 · 好用 · 常见',
      icon: '📘',
      color: 'from-orange-500 to-amber-500'
    },
    {
      key: 'speaking',
      title: '口语',
      desc: '日常对话直接说',
      icon: '🗣️',
      color: 'from-purple-500 to-fuchsia-500'
    },
    {
      key: 'hsk',
      title: 'HSK',
      desc: '考试 · 词汇 · 语法',
      icon: '🎓',
      color: 'from-rose-500 to-pink-500'
    },
    {
      key: 'ai',
      title: 'AI 助手',
      desc: '随时问中文',
      icon: '🤖',
      color: 'from-gray-700 to-gray-900'
    }
  ]

  return (
    <div className="px-6 py-14 max-w-6xl mx-auto">
      
      {/* 顶部文案 */}
      <section className="text-center mb-14">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
          给缅甸人学的中文
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed">
          不讲语法，不背书
          <br />
          <span className="font-semibold">先听 · 先说 · 先敢开口</span>
        </p>
      </section>

      {/* 功能入口 */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {features.map(item => (
          <button
            key={item.key}
            onClick={() => router.push(`/?tab=${item.key}`)}
            className={`
              relative overflow-hidden rounded-2xl p-6 text-left
              text-white shadow-xl
              bg-gradient-to-br ${item.color}
              transition-all duration-300
              hover:scale-[1.03] hover:shadow-2xl
              active:scale-95
            `}
          >
            <div className="text-3xl mb-4">
              {item.icon}
            </div>

            <div className="text-xl font-bold mb-1">
              {item.title}
            </div>

            <div className="text-sm opacity-90">
              {item.desc}
            </div>
          </button>
        ))}
      </section>

      {/* 底部信心文案 */}
      <section className="mt-16 text-center text-gray-500 dark:text-gray-400">
        每天 10 分钟，也能慢慢学会中文
      </section>
    </div>
  )
}
