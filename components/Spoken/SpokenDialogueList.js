import React, { useRef } from 'react';
import { Lock, Crown, ChevronLeft } from 'lucide-react';

export default function SpokenDialogueList({ phrases, bookName, isUnlocked, onShowVip, onBack }) {
  const scrollRef = useRef(null);

  // 滑动拦截
  const handleScroll = (e) => {
    if (isUnlocked) return;
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop + clientHeight > scrollHeight - 30) {
      onShowVip();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col max-w-md mx-auto animate-in slide-in-from-right duration-300">
      <div className="p-4 bg-white border-b flex items-center justify-between sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2"><ChevronLeft size={24} /></button>
        <h2 className="font-black text-slate-800 truncate px-4">{bookName}</h2>
        <div className="w-8" />
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        {phrases.map((item, index) => {
          // 渐进式模糊逻辑
          let blurStyle = {};
          let isLocked = false;
          if (!isUnlocked) {
            if (index === 4) blurStyle = { filter: 'blur(1px)' };
            if (index === 5) blurStyle = { filter: 'blur(2.5px)' };
            if (index >= 6) { blurStyle = { filter: 'blur(6px)', opacity: 0.5 }; isLocked = true; }
          }

          return (
            <div 
              key={item.id} 
              onClick={() => isLocked ? onShowVip() : null}
              className="relative bg-white p-5 rounded-2xl border border-slate-100 shadow-sm"
              style={blurStyle}
            >
              <p className="text-[10px] text-slate-400 mb-1">{item.pinyin}</p>
              <h3 className="text-lg font-bold text-slate-800 mb-2">{item.chinese}</h3>
              <p className="text-sm text-blue-600 font-medium">{item.burmese}</p>
              {isLocked && <div className="absolute inset-0 flex items-center justify-center"><Lock className="text-slate-400/40" size={30} /></div>}
            </div>
          );
        })}
      </div>

      {!isUnlocked && (
        <div className="absolute bottom-8 left-6 right-6 p-4 bg-slate-900 rounded-2xl shadow-2xl flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-amber-500 rounded-lg text-white"><Crown size={16} /></div>
             <div>
               <p className="text-xs font-bold">激活完整内容</p>
               <p className="text-[10px] text-slate-400">滑动查看更多</p>
             </div>
          </div>
          <button onClick={onShowVip} className="px-4 py-2 bg-blue-600 rounded-xl text-xs font-bold active:scale-90 transition-all">激活</button>
        </div>
      )}
    </div>
  );
}
