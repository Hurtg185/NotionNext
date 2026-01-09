import React from 'react';
import { Play, Lock, Star } from 'lucide-react';

// ==========================================
// 1. 核心组件：Premium3DBook
// ==========================================
function Premium3DBook({
  cover,
  title,
  subTitle,
  level = 'LV.1',
  rating = 4.9,
  isPremium = false,
  // 提示：如果封面是透明PNG，这个颜色会决定书脊和光晕的颜色
  color = 'from-blue-500 to-indigo-600', 
  onClick,
}) {
  return (
    <div className="flex flex-col gap-3 w-full" onClick={onClick}>
      
      {/* 
         === 3D 舞台 ===
         perspective-[600px]: 值越小，近大远小的透视感越强（看起来越立体）
      */}
      <div className="group relative cursor-pointer perspective-[600px] w-full aspect-[0.7/1] z-0">
        
        {/* 底部彩色氛围光 (随书本颜色变化) */}
        <div className={`absolute -bottom-4 left-4 right-4 h-6 rounded-full blur-xl opacity-40 group-active:opacity-70 transition-all duration-300 bg-gradient-to-r ${color}`} />

        {/* 
           === 3D 旋转容器 ===
           rotate-y-[-25deg]: 关键点！默认向左转25度，露出书脊和厚度，立体感瞬间拉满
        */}
        <div className="relative w-full h-full transform-style-3d transition-all duration-500 ease-out 
          rotate-y-[-25deg] rotate-x-[5deg] scale-90
          group-active:rotate-y-[-10deg] group-active:rotate-x-[0deg] group-active:scale-95">

          {/* --- A. 书页 (侧面厚度) --- */}
          <div className="absolute top-[3px] bottom-[3px] right-[-12px] w-[14px] z-0 rotate-y-[90deg] translate-x-[6px]">
            <div className="absolute inset-0 bg-[#fdfdfd] border-l border-gray-100 shadow-inner">
               {/* 纯CSS画出的书页纹理 */}
               <div className="w-full h-full opacity-20 bg-[repeating-linear-gradient(90deg,transparent,transparent_1px,#000_1px,#000_2px)]" />
            </div>
          </div>

          {/* --- B. 书脊 (左侧装订处) --- */}
          <div className="absolute top-[2px] bottom-[2px] left-[-8px] w-[10px] z-0 rotate-y-[-90deg] translate-x-[-4px]">
             {/* 书脊颜色跟随 props.color */}
            <div className={`absolute inset-0 bg-gradient-to-b ${color} brightness-90 shadow-md rounded-l-sm`} />
            <div className="absolute inset-0 bg-white/10" />
          </div>

          {/* --- C. 封底 (增加阴影层次) --- */}
          <div className="absolute inset-0 bg-white rounded-md translate-z-[-14px] shadow-2xl" />

          {/* --- D. 封面 (核心层) --- */}
          {/* bg-white: 关键！设置白色底色，这样透明PNG图片放上去背景就是白的，不会变黑 */}
          <div className="absolute inset-0 z-10 rounded-r-md rounded-l-sm overflow-hidden bg-white translate-z-[0px] shadow-[-1px_0_2px_rgba(0,0,0,0.1)]">
            
            {/* D1. 图片层 */}
            <img 
              src={cover} 
              alt={title} 
              className="w-full h-full object-cover z-0" 
              // 如果你的图是透明PNG，object-contain会保留完整比例，object-cover会填满
            />

            {/* D2. 纸张质感滤镜 (给白色背景增加一点纸的噪点，显得高级) */}
            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] pointer-events-none" />

            {/* D3. 左侧折痕阴影 (模拟翻开的地方) */}
            <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-r from-black/20 to-transparent pointer-events-none" />

            {/* D4. 表面高光 (反光) */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-active:opacity-100 transition-opacity pointer-events-none" />

            {/* D5. UI元素：左上角标签 */}
            <div className="absolute top-2 left-0 shadow-md">
               <div className={`px-2 py-0.5 rounded-r-md text-[9px] font-black text-white bg-gradient-to-r ${color}`}>
                 {level}
               </div>
            </div>

            {/* D6. UI元素：中心按钮 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center border border-white/40 shadow-[0_4px_10px_rgba(0,0,0,0.2)] group-active:scale-110 transition-transform">
                 {isPremium ? <Lock size={14} className="text-white" /> : <Play size={14} fill="white" className="text-white ml-0.5" />}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* === 外部信息区 === */}
      <div className="px-1">
        <div className="text-[12px] font-bold text-slate-800 leading-[1.3] line-clamp-2 min-h-[2.6em]">
          {title}
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-slate-400 truncate max-w-[4rem]">{subTitle}</span>
          <div className="flex items-center gap-0.5 bg-slate-100 px-1.5 py-0.5 rounded-full">
            <Star size={8} className="text-orange-400 fill-orange-400" />
            <span className="text-[9px] font-bold text-slate-600">{rating}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. 展示布局：BookGrid
// ==========================================
const booksData = [
  { 
    id: 1, 
    title: "React 进阶实战", 
    subTitle: "技术文档", 
    level: "高阶", 
    // 这是一个透明背景的 Logo 示例，你会看到它是白底的
    cover: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/1200px-React-icon.svg.png", 
    color: "from-cyan-500 to-blue-600",
    isPremium: false
  },
  { 
    id: 2, 
    title: "乔布斯传 (精装版)", 
    subTitle: "人物传记", 
    level: "畅销", 
    // 普通全屏图片
    cover: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400", 
    color: "from-gray-600 to-black",
    isPremium: true
  },
  { 
    id: 3, 
    title: "零基础学 Python", 
    subTitle: "编程入门", 
    level: "入门", 
    // 假设这图是白底或透明的
    cover: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Python-logo-notext.svg", 
    color: "from-yellow-500 to-orange-600",
    isPremium: false
  },
  { 
    id: 4, 
    title: "设计心理学", 
    subTitle: "Don Norman", 
    level: "经典", 
    cover: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=400", 
    color: "from-red-500 to-rose-700",
    isPremium: true
  },
  { 
    id: 5, 
    title: "三体：黑暗森林", 
    subTitle: "科幻巨著", 
    level: "必读", 
    cover: "https://images.unsplash.com/photo-1614726365723-49cfae9f0294?auto=format&fit=crop&q=80&w=400", 
    color: "from-slate-700 to-slate-900",
    isPremium: true
  },
  { 
    id: 6, 
    title: "极简主义生活", 
    subTitle: "生活方式", 
    level: "免费", 
    cover: "https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?auto=format&fit=crop&q=80&w=400", 
    color: "from-emerald-500 to-teal-600",
    isPremium: false
  },
];

export default function BookGrid() {
  return (
    <div className="bg-slate-50 min-h-screen pb-12 font-sans">
      {/* 顶部导航 */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200 px-4 py-3 mb-6">
        <h1 className="text-xl font-black text-slate-800 tracking-tight">书架展示</h1>
        <p className="text-xs text-slate-500">3D 立体 · 透明背景适配</p>
      </div>

      {/* Grid 容器：手机端 3 列，间距 gap-3 */}
      <div className="px-3">
        <div className="grid grid-cols-3 gap-x-3 gap-y-8">
          {booksData.map((book) => (
            <Premium3DBook 
              key={book.id} 
              {...book} 
              onClick={() => console.log("打开书本:", book.title)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
