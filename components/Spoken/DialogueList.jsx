import React, { useState, useRef, useMemo } from 'react';
import { ChevronLeft, Lock, Crown, PlayCircle, Loader2 } from 'lucide-react';
import { GlobalAudio } from './audio-manager';

export default function DialogueList({ phrases, book, isUnlocked, onShowVip, onBack }) {
  const [playingId, setPlayingId] = useState(null);
  const scrollRef = useRef(null);
  const chapterRefs = useRef({});

  // 1. 提取所有不重复的小主题
  const chapters = useMemo(() => {
    return Array.from(new Set(phrases.map(p => p.chapter)));
  }, [phrases]);

  // 2. 跳转到对应小主题
  const scrollToChapter = (chapter) => {
    const element = chapterRefs.current[chapter];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePlay = (item) => {
    if (playingId === item.id) {
      GlobalAudio.stop();
      setPlayingId(null);
      return;
    }
    setPlayingId(item.id);
    GlobalAudio.play(item.chinese, () => setPlayingId(null));
  };

  return (
    <div className="fixed inset-0 z-[500] bg-slate-50 flex flex-col max-w-md mx-auto animate-in slide-in-from-right duration-300">
      {/* 顶部导航 */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="p-4 flex items-center justify-between">
          <button onClick={onBack} className="p-2 -ml-2"><ChevronLeft size={24} /></button>
          <h2 className="font-black text-slate-800 text-sm truncate">{book.title}</h2>
          <div className="w-8" />
        </div>
        
        {/* 小主题快捷跳转标签 */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {chapters.map(ch => (
            <button 
              key={ch}
              onClick={() => scrollToChapter(ch)}
              className="px-4 py-1.5 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 whitespace-nowrap active:bg-blue-600 active:text-white"
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4 pb-32"
        onScroll={(e) => {
          if (!isUnlocked && e.target.scrollTop + e.target.clientHeight > e.target.scrollHeight - 50) {
            onShowVip();
          }
        }}
      >
        {phrases.map((item, index) => {
          const isLocked = !isUnlocked && index >= 6;
          const showChapterHeader = index === 0 || phrases[index-1].chapter !== item.chapter;

          return (
            <div key={item.id} ref={el => { if (showChapterHeader) chapterRefs.current[item.chapter] = el; }}>
              {/* 小主题标题隔离 */}
              {showChapterHeader && (
                <div className="py-2 px-1 mb-2 text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                  <div className="h-[1px] bg-blue-100 flex-1"></div>
                  {item.chapter}
                  <div className="h-[1px] bg-blue-100 flex-1"></div>
                </div>
              )}

              <div 
                onClick={() => isLocked ? onShowVip() : handlePlay(item)}
                className={`relative bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm transition-all ${isLocked ? 'blur-[5px] opacity-60' : ''}`}
              >
                <div className="absolute top-4 right-4">
                  {playingId === item.id ? <Loader2 size={16} className="animate-spin text-blue-500" /> : <PlayCircle size={16} className="text-slate-200" />}
                </div>
                <p className="text-[9px] text-slate-400 mb-1 font-mono">{item.pinyin}</p>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{item.chinese}</h3>
                <p className="text-sm text-blue-600 font-medium mb-3">{item.burmese}</p>
                <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black rounded-full">{item.xieyin}</span>
                {isLocked && <div className="absolute inset-0 flex items-center justify-center bg-transparent"><Lock className="text-slate-400/40" size={30} /></div>}
              </div>
            </div>
          );
        })}
      </div>

      {!isUnlocked && (
        <div className="absolute bottom-8 left-6 right-6 p-4 bg-slate-900 rounded-2xl shadow-2xl flex items-center justify-between text-white max-w-sm mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 rounded-lg"><Crown size={16} /></div>
            <div><p className="text-xs font-bold">激活特训包</p><p className="text-[10px] text-slate-400">解锁 10,000+ 内容</p></div>
          </div>
          <button onClick={onShowVip} className="px-4 py-2 bg-blue-600 rounded-xl text-xs font-bold">立即激活</button>
        </div>
      )}
    </div>
  );
}
