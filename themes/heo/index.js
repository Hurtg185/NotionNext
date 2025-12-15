/**
 * 首页（第一阶段）
 * 目标：极简入口页，只放核心功能按钮
 */
const LayoutIndex = () => {
  return (
    <div className="w-full px-6 py-16">
      {/* 中央容器 */}
      <div className="max-w-4xl mx-auto">
        
        {/* 标题 */}
        <h1 className="text-3xl md:text-4xl font-bold text-center text-gray-800 dark:text-gray-100">
          汉语学习工具
        </h1>
        <p className="mt-3 text-center text-gray-500 dark:text-gray-400">
          拼音 · HSK · 汉字
        </p>

        {/* 功能入口 */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6">
          
          {/* 拼音 */}
          <div className="group cursor-pointer rounded-2xl bg-white dark:bg-[#1f1f26] p-8 shadow-sm hover:shadow-md transition">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              拼音
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              拼音表 · 发音 · 声调
            </p>
          </div>

          {/* HSK */}
          <div className="group cursor-pointer rounded-2xl bg-white dark:bg-[#1f1f26] p-8 shadow-sm hover:shadow-md transition">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              HSK
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              HSK 词汇 · 语法 · 句型
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
