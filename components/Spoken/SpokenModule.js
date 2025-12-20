import React, { useState, useEffect } from 'react';
import { FaVolumeUp, FaChevronLeft, FaChevronRight, FaTimes, FaMagic } from "react-icons/fa";
import { pinyin } from 'pinyin-pro';
// ✅ 修复点1：引入 Howler 全局对象
import { Howl, Howler } from 'howler';

// --- 1. 音频控制工具 ---

// 停止所有正在播放的声音
const stopAllAudio = () => {
  // ✅ 修复点2：使用 Howler.unload() 而不是 Howl.unload()
  try {
    Howler.unload(); 
  } catch (e) {
    console.warn("Howler unload failed:", e);
  }

  // 停止所有原生 Audio 元素
  const audioElements = document.getElementsByTagName('audio');
  for (let i = 0; i < audioElements.length; i++) {
    try {
      audioElements[i].pause();
      audioElements[i].currentTime = 0;
    } catch (e) {}
  }
};

// 播放单词 R2 音频
const playR2Audio = (wordObj) => {
  stopAllAudio();
  
  // 1. 检查数据，如果没有 HSK 等级或 ID，回退到 TTS
  if (!wordObj || !wordObj.id || !wordObj.hsk_level) {
    const text = wordObj?.word || wordObj?.chinese;
    if (text) playTTS(text);
    return;
  }

  // 2. 构建 R2 URL
  const formattedId = String(wordObj.id).padStart(4, '0');
  const level = wordObj.hsk_level;
  const audioUrl = `https://audio.886.best/chinese-vocab-audio/hsk${level}/${formattedId}.mp3`;

  // 3. 播放
  const sound = new Howl({
    src: [audioUrl],
    html5: true, 
    volume: 1.0,
    onloaderror: (id, err) => {
      console.warn("R2 Audio missing, fallback to TTS:", err);
      // 如果加载失败，播放 TTS
      playTTS(wordObj.word || wordObj.chinese);
    },
    onplayerror: (id, err) => {
      console.warn("R2 Audio play error:", err);
      playTTS(wordObj.word || wordObj.chinese);
    }
  });
  
  sound.play();
};

// 播放拼读单字音频
const playSpellingAudio = (pyWithTone) => {
  return new Promise((resolve) => {
    const filename = encodeURIComponent(pyWithTone); 
    const url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${filename}.mp3`;
    
    const sound = new Howl({
      src: [url],
      html5: true,
      onend: resolve,
      onloaderror: () => {
        resolve(); 
      },
      onplayerror: () => {
        resolve();
      }
    });
    sound.play();
  });
};

// 播放 TTS (微软语音库)
const playTTS = (text) => {
  if (!text) return;
  // 不要在 TTS 前强制 stopAllAudio，因为原生 Audio 和 Howler 有时会冲突
  // 让 stopAllAudio 在 playR2Audio 里处理即可，或者只停止 Howler
  try {
    Howler.unload(); 
  } catch(e){}

  const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural`;
  const audio = new Audio(url);
  audio.play().catch(e => console.error("TTS play failed", e));
};

// --- 2. 拼读弹窗组件 ---
const SpellingModal = ({ wordObj, onClose }) => {
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const rawText = wordObj.word || wordObj.chinese || "";

  useEffect(() => {
    let isCancelled = false;

    const runSpellingSequence = async () => {
      const chars = rawText.split('');
      
      for (let i = 0; i < chars.length; i++) {
        if (isCancelled) return;
        setActiveCharIndex(i);
        
        const charPinyin = pinyin(chars[i], { toneType: 'symbol' });
        await playSpellingAudio(charPinyin);
        await new Promise(r => setTimeout(r, 150));
      }

      if (isCancelled) return;

      setActiveCharIndex('all');
      playR2Audio(wordObj);

      setTimeout(() => {
        if (!isCancelled) onClose();
      }, 1500);
    };

    runSpellingSequence();

    return () => {
      isCancelled = true;
      stopAllAudio();
    };
  }, [rawText, wordObj, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm flex flex-col items-center relative">
        <button onClick={onClose} className="absolute -top-16 right-0 text-slate-400 p-2 hover:text-slate-600">
            <FaTimes size={28}/>
        </button>
        <h3 className="text-sm font-bold text-slate-400 mb-10 tracking-[0.3em] uppercase">Spelling Mode</h3>
        
        <div className="flex flex-wrap justify-center gap-6">
          {rawText.split('').map((char, idx) => {
             const py = pinyin(char, { toneType: 'symbol' });
             const isActive = idx === activeCharIndex || activeCharIndex === 'all';
             return (
               <div key={idx} className="flex flex-col items-center transition-all duration-200">
                 <span className={`text-2xl font-mono mb-3 transition-colors ${isActive ? 'text-orange-500 font-bold' : 'text-slate-300'}`}>
                   {py}
                 </span>
                 <span className={`text-7xl font-black transition-all transform ${isActive ? 'text-blue-600 scale-110' : 'text-slate-800 scale-100'}`}>
                   {char}
                 </span>
               </div>
             )
          })}
        </div>
        <div className="mt-12 text-slate-400 text-sm animate-pulse font-medium">
            {activeCharIndex === 'all' ? '完整朗读' : '拼读中...'}
        </div>
      </div>
    </div>
  );
};

// --- 3. 主组件 ---
export default function WordStudyPlayer({ data, onNext, onPrev, isFirstBlock }) {
  if (!data) return <div className="p-10 text-center text-red-500">Error: No Data</div>;

  const words = data.words || [];
  if (words.length === 0) return <div className="p-10 text-center text-slate-400">No words found.</div>;

  const [index, setIndex] = useState(0);
  const [showSpelling, setShowSpelling] = useState(false);

  const currentWord = words[index];
  const total = words.length;

  useEffect(() => {
    if (currentWord) {
      const timer = setTimeout(() => {
        playR2Audio(currentWord);
      }, 500); 
      return () => clearTimeout(timer);
    }
  }, [index, currentWord]);

  const handleNext = () => {
    if (index < total - 1) setIndex(index + 1);
    else onNext && onNext();
  };

  const handlePrev = () => {
    if (index > 0) setIndex(index - 1);
    else onPrev && onPrev();
  };

  if (!currentWord) return <div className="p-10 text-center text-slate-400">Loading...</div>;

  // 属性名兼容
  const rawText = currentWord.word || currentWord.chinese || currentWord.hanzi;
  if (!rawText) return <div className="p-10 text-center text-red-400">Word data missing field</div>;

  const displayPinyin = currentWord.pinyin || pinyin(rawText, { toneType: 'symbol' });
  const displayWord = rawText;

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-white text-slate-800 relative overflow-hidden">
      
      {/* 顶部 */}
      <div className="flex-none h-14 px-6 flex items-center justify-end z-10">
        <div className="text-slate-300 text-xs font-bold font-mono bg-slate-50 px-2 py-1 rounded">
          {index + 1} / {total}
        </div>
      </div>

      {/* 主内容 */}
      <div className="flex-1 flex flex-col items-center w-full px-6 overflow-y-auto pb-32 no-scrollbar">
        <div className="w-full flex flex-col items-center pt-4 pb-8">
          
          <div className="text-xl text-orange-500 font-medium font-mono mb-2">{displayPinyin}</div>
          
          <h1 
            className="text-7xl font-black text-slate-900 tracking-tight leading-none mb-4 cursor-pointer active:scale-95 transition-transform" 
            onClick={() => playR2Audio(currentWord)}
          >
            {displayWord}
          </h1>

          {currentWord.similar_sound && (
            <div className="mb-6 px-3 py-1 bg-yellow-50 text-yellow-600 text-sm font-bold rounded-full border border-yellow-100">
              谐音: {currentWord.similar_sound}
            </div>
          )}

          <div className="text-center w-full max-w-md mb-8">
             {currentWord.burmese && (
               <div className="text-2xl font-bold text-slate-800 mb-2 font-['Padauk'] leading-snug">
                 {currentWord.burmese}
               </div>
             )}
             <div className="text-slate-500 text-base leading-relaxed space-y-1">
               {currentWord.explanation && <p>{currentWord.explanation}</p>}
               {currentWord.definition && <p className="text-slate-400 text-sm">{currentWord.definition}</p>}
             </div>
          </div>

          <div className="flex items-center gap-4 mb-8">
             <button 
                onClick={(e) => { e.stopPropagation(); setShowSpelling(true); }}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:scale-105 active:scale-95 transition-all font-bold"
             >
               <FaMagic className="animate-pulse" /> 拼读演示
             </button>

             <button 
                onClick={() => playR2Audio(currentWord)} 
                className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors"
             >
               <FaVolumeUp size={20} />
             </button>
          </div>
        </div>

        <div className="w-24 h-px bg-slate-100 mb-8 flex-none"></div>

        <div className="w-full max-w-lg space-y-6 text-center">
            {currentWord.example && (
              <ExampleRow 
                text={currentWord.example} 
                translation={currentWord.example_burmese} 
              />
            )}
            {currentWord.example2 && (
              <ExampleRow 
                text={currentWord.example2} 
                translation={currentWord.example2_burmese} 
              />
            )}
        </div>
      </div>

      {/* 底部导航 - 已修改：移除上一个，改为浅色系“继续” */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-20 bg-white/90 backdrop-blur-md border-t border-slate-50 px-6 pt-4"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-6 max-w-md mx-auto">
            {/* 上一个按钮已移除 */}

            <button 
              onClick={handleNext}
              className="flex-1 h-14 bg-white text-slate-700 border-2 border-slate-100 rounded-full font-bold text-lg hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              {index === total - 1 ? "完成" : "继续"} <FaChevronRight size={14} className="text-slate-400" />
            </button>
        </div>
      </div>

      {showSpelling && (
        <SpellingModal wordObj={currentWord} onClose={() => setShowSpelling(false)} />
      )}
    </div>
  );
}

// 辅助组件：例句行
const ExampleRow = ({ text, translation }) => {
  const py = pinyin(text, { toneType: 'symbol' });
  
  return (
    <div 
      className="flex flex-col items-center py-2 cursor-pointer group active:scale-[0.99] transition-transform"
      onClick={() => playTTS(text)}
    >
      <div className="text-sm text-orange-400 mb-1 font-mono leading-none opacity-80 group-hover:opacity-100">
        {py}
      </div>
      <div className="text-xl text-slate-700 font-medium leading-relaxed">
        {text}
      </div>
      {translation && (
        <div className="text-base text-slate-400 mt-1 font-['Padauk']">
          {translation}
        </div>
      )}
      <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400 text-xs flex items-center gap-1">
        <FaVolumeUp /> 点击朗读
      </div>
    </div>
  );
};
