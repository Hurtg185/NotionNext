import Link from 'next/link'
import { BookOpen, GraduationCap, Dumbbell } from 'lucide-react'

const HskQuickEntry = () => {
  return (
    <div className="grid grid-cols-3 gap-3 pb-24">

      {/* 生词 */}
      <Link
        href="/hsk/1/words"
        className="group flex flex-col items-center justify-center
                   rounded-2xl p-4
                   bg-blue-50 dark:bg-gray-800
                   border border-blue-100 dark:border-gray-700
                   hover:shadow-md hover:-translate-y-0.5
                   transition-all"
      >
        <div className="mb-2 p-3 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30">
          <BookOpen size={22} />
        </div>
        <span className="text-sm font-bold text-gray-800 dark:text-white">
          生词
        </span>
        <span className="text-xs text-gray-500 mt-0.5">
          Words
        </span>
      </Link>

      {/* 语法 */}
      <Link
        href="/hsk/1/grammar"
        className="group flex flex-col items-center justify-center
                   rounded-2xl p-4
                   bg-green-50 dark:bg-gray-800
                   border border-green-100 dark:border-gray-700
                   hover:shadow-md hover:-translate-y-0.5
                   transition-all"
      >
        <div className="mb-2 p-3 rounded-xl bg-green-100 text-green-600 dark:bg-green-900/30">
          <GraduationCap size={22} />
        </div>
        <span className="text-sm font-bold text-gray-800 dark:text-white">
          语法
        </span>
        <span className="text-xs text-gray-500 mt-0.5">
          Grammar
        </span>
      </Link>

      {/* 练习 */}
      <Link
        href="/hsk/1/practice"
        className="group flex flex-col items-center justify-center
                   rounded-2xl p-4
                   bg-orange-50 dark:bg-gray-800
                   border border-orange-100 dark:border-gray-700
                   hover:shadow-md hover:-translate-y-0.5
                   transition-all"
      >
        <div className="mb-2 p-3 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30">
          <Dumbbell size={22} />
        </div>
        <span className="text-sm font-bold text-gray-800 dark:text-white">
          练习
        </span>
        <span className="text-xs text-gray-500 mt-0.5">
          Practice
        </span>
      </Link>

    </div>
  )
}

export default HskQuickEntry
