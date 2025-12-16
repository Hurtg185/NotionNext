import { useRouter } from 'next/router'
import Link from 'next/link'
import {
  BookOpen,
  GraduationCap,
  Dumbbell
} from 'lucide-react'

const vibrate = () => {
  if (navigator.vibrate) navigator.vibrate(15)
}

const HskLevelHome = () => {
  const router = useRouter()
  const { level } = router.query

  if (!level) return null

  return (
    <div className="min-h-screen px-4 pt-8 animate-fade-in-up">

      {/* ===== 标题区 ===== */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black tracking-tight">
          HSK {level}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          汉语水平考试 · 第 {level} 级
        </p>
      </div>

      {/* ===== 三卡入口 ===== */}
      <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">

        {/* 生词 */}
        <Link
          href={`/hsk/${level}/words`}
          onClick={vibrate}
          className="active:scale-95 transition-all
                     flex flex-col items-center justify-center
                     rounded-2xl p-4
                     bg-blue-50
                     border border-blue-100
                     shadow-sm"
        >
          <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
            <BookOpen size={22} />
          </div>
          <div className="mt-2 text-sm font-bold">生词</div>
          <div className="text-xs text-gray-500">စာလုံး</div>
        </Link>

        {/* 语法 */}
        <Link
          href={`/hsk/${level}/grammar`}
          onClick={vibrate}
          className="active:scale-95 transition-all
                     flex flex-col items-center justify-center
                     rounded-2xl p-4
                     bg-green-50
                     border border-green-100
                     shadow-sm"
        >
          <div className="p-3 rounded-xl bg-green-100 text-green-600">
            <GraduationCap size={22} />
          </div>
          <div className="mt-2 text-sm font-bold">语法</div>
          <div className="text-xs text-gray-500">သဒ္ဒါ</div>
        </Link>

        {/* 练习 */}
        <Link
          href={`/hsk/${level}/practice`}
          onClick={vibrate}
          className="active:scale-95 transition-all
                     flex flex-col items-center justify-center
                     rounded-2xl p-4
                     bg-orange-50
                     border border-orange-100
                     shadow-sm"
        >
          <div className="p-3 rounded-xl bg-orange-100 text-orange-600">
            <Dumbbell size={22} />
          </div>
          <div className="mt-2 text-sm font-bold">练习</div>
          <div className="text-xs text-gray-500">လေ့ကျင့်ခန်း</div>
        </Link>

      </div>
    </div>
  )
}

export default HskLevelHome
