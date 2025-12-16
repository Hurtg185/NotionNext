import React from 'react'
import { BookOpen, GraduationCap, Dumbbell, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const HskLevelHome = () => {
  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* ===== 顶部 HSK 等级标题 ===== */}
      <div className="rounded-3xl p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
        <h1 className="text-3xl font-black italic">HSK 1</h1>
        <p className="mt-2 text-sm text-blue-100">
          基础入门 · 150 个常用词
        </p>
      </div>

      {/* ===== 语法入口卡片 ===== */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <GraduationCap className="text-green-500" />
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">
            核心语法
          </h2>
        </div>

        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 mb-4">
          <li>• 是 + 名词</li>
          <li>• 吗 疑问句</li>
          <li>• 基本语序</li>
        </ul>

        <Link
          href="/hsk/1/grammar"
          className="inline-flex items-center gap-2 text-sm font-bold text-green-600 hover:underline"
        >
          进入语法学习
          <ChevronRight size={16} />
        </Link>
      </div>

      {/* ===== 练习入口区域 ===== */}
      <div className="grid grid-cols-1 gap-4 pb-20">

        {/* 生词 */}
        <Link
          href="/hsk/1/words"
          className="group bg-gradient-to-br from-blue-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-2xl p-5 border border-blue-100 dark:border-gray-600 hover:shadow-md transition"
        >
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="text-blue-500" />
                <h3 className="font-bold text-gray-800 dark:text-white">
                  生词学习
                </h3>
              </div>
              <p className="text-xs text-gray-500">听发音 · 看例句</p>
            </div>
            <ChevronRight className="text-gray-400 group-hover:translate-x-1 transition" />
          </div>
        </Link>

        {/* 语法练习 */}
        <Link
          href="/hsk/1/grammar-practice"
          className="group bg-gradient-to-br from-green-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-2xl p-5 border border-green-100 dark:border-gray-600 hover:shadow-md transition"
        >
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className="text-green-500" />
                <h3 className="font-bold text-gray-800 dark:text-white">
                  语法练习
                </h3>
              </div>
              <p className="text-xs text-gray-500">选词 · 造句</p>
            </div>
            <ChevronRight className="text-gray-400 group-hover:translate-x-1 transition" />
          </div>
        </Link>

        {/* 综合练习 */}
        <Link
          href="/hsk/1/practice"
          className="group bg-gradient-to-br from-orange-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-2xl p-5 border border-orange-100 dark:border-gray-600 hover:shadow-md transition"
        >
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Dumbbell className="text-orange-500" />
                <h3 className="font-bold text-gray-800 dark:text-white">
                  综合练习
                </h3>
              </div>
              <p className="text-xs text-gray-500">单词 + 语法</p>
            </div>
            <ChevronRight className="text-gray-400 group-hover:translate-x-1 transition" />
          </div>
        </Link>

      </div>
    </div>
  )
}

export default HskLevelHome
