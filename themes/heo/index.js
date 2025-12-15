"use client"

import { useState } from "react"

/* =============================
   主页面（可作为 index）
============================= */
export default function HomeLearnChinese() {
  return (
    <div className="flex h-screen w-screen bg-[#f5f7fb] dark:bg-[#121212]">

      {/* 左侧栏 */}
      <LeftSidebar />

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto px-8 py-10">
        <HeroSection />
        <PinyinToday />
        <PinyinGrid />
      </main>
    </div>
  )
}

/* =============================
   左侧侧边栏
============================= */
function LeftSidebar() {
  const menus = [
    { name: "学中文", active: true },
    { name: "拼音" },
    { name: "HSK" },
    { name: "口语" },
    { name: "收藏" }
  ]

  return (
    <aside className="w-56 bg-white dark:bg-[#1b1b1b] border-r border-gray-200 dark:border-gray-800 px-4 py-6">
      <div className="text-xl font-extrabold mb-8">
        Learn Chinese
      </div>

      <nav className="space-y-2">
        {menus.map((m, i) => (
          <div
            key={i}
            className={`px-4 py-2 rounded-xl cursor-pointer
              ${m.active
                ? "bg-blue-500 text-white"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
          >
            {m.name}
          </div>
        ))}
      </nav>
    </aside>
  )
}

/* =============================
   Hero：缅甸人专用文案
============================= */
function HeroSection() {
  return (
    <section className="mb-10">
      <h1 className="text-4xl font-extrabold mb-4">
        给缅甸人学的中文
      </h1>
      <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed">
        不背语法，不写作文
        <br />
        <strong>先听 · 先说 · 先敢开口</strong>
        <br /><br />
        从拼音开始，学真正能用的汉语。
      </p>
    </section>
  )
}

/* =============================
   今日拼音（无动画版）
============================= */
function PinyinToday() {
  const today = ["b", "p", "m", "f"]

  return (
    <section className="mb-10">
      <div className="text-2xl font-bold mb-4">
        🔊 今日拼音
      </div>

      <div className="flex gap-4">
        {today.map((py, i) => (
          <div
            key={i}
            className="w-24 h-24 rounded-2xl bg-white dark:bg-[#1e1e1e]
              shadow-lg flex flex-col items-center justify-center
              cursor-pointer active:scale-95 transition"
          >
            <div className="text-3xl font-bold mb-2">{py}</div>
            <div className="text-blue-500 text-sm">🔊</div>
          </div>
        ))}
      </div>

      <div className="text-gray-500 mt-3">
        点击听发音，跟着读
      </div>
    </section>
  )
}

/* =============================
   拼音表（声母）
============================= */
function PinyinGrid() {
  const initials = [
    "b","p","m","f",
    "d","t","n","l",
    "g","k","h",
    "j","q","x",
    "zh","ch","sh","r",
    "z","c","s"
  ]

  return (
    <section>
      <div className="text-2xl font-bold mb-4">
        拼音表（声母）
      </div>

      <div className="grid grid-cols-4 md:grid-cols-6 gap-4">
        {initials.map((py, i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#1e1e1e]
              rounded-xl py-4 text-center font-semibold
              cursor-pointer hover:shadow-md active:scale-95 transition"
          >
            {py}
          </div>
        ))}
      </div>
    </section>
  )
                 }
