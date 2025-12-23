import React, { useState, useEffect, useRef } from 'react';
import { 
  FaVolumeUp, FaChevronRight, FaTimes, 
  FaMagic, FaMicrophone, FaStop, FaPlay, FaRedo, FaArrowRight 
} from "react-icons/fa";
import { pinyin } from 'pinyin-pro';
import { Howl, Howler } from 'howler';

// ==========================================
// 1. 音频控制工具 (增强版 - 含音效)
// ==========================================

const stopAllAudio = () => {
  try { 
    Howler.unload(); 
    Howler.stop();
  } catch (e) {
    console.warn("Howler stop failed", e);
  }

  const audioElements = document.getElementsByTagName('audio');
  for (let i = 0; i < audioElements.length; i++) {
    try {
      audioElements[i].pause();
      audioElements[i].currentTime = 0;
    } catch (e) {}
  }
};

const playSFX = (type) => {
  const paths = {
    click: '/sounds/click.mp3',
    switch: '/sounds/switch-card.mp3'
  };
  if (!paths[type]) return;

  const sound = new Howl({
    src: [paths[type]],
    volume: 0.6,
    html5: true
  });
  sound.play();
};

const playR2Audio = (wordObj) => {
  stopAllAudio(); 
  
  if (wordObj && wordObj.id && wordObj.hsk_level) {
    const formattedId = String(wordObj.id).padStart(4, '0');
    const level = wordObj.hsk_level;
    const audioUrl = `https://audio.886.best/chinese-vocab-audio/hsk${level}/${formattedId}.mp3`;

    const sound = new Howl({
      src: [audioUrl],
      html5: true, 
      volume: 1.0,
      onloaderror: () => playTTS(wordObj.word || wordObj.chinese),
      onplayerror: () => playTTS(wordObj.word || wordObj.chinese)
    });
    sound.play();
  } else {
    const text = wordObj?.word || wordObj?.chinese || "Error";
    playTTS(text);
  }
};

const playSpellingAudio = (pyWithTone) => {
  return new Promise((resolve) => {
    const filename = encodeURIComponent(pyWithTone); 
    const url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${filename}.mp3`;
    
    const sound = new Howl({
      src: [url],
      html5: true,
      onend: resolve,
      onloaderror: resolve,
      onplayerror: resolve
    });
    sound.play();
  });
};

const playTTS = (text) => {
  stopAllAudio();
  if (!text) return;
  const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural`;
  const audio = new Audio(url);
  audio.play().catch(e => console.error("TTS error", e));
};

// ==========================================
// 2. 拼读弹窗组件 (浅色系优化)
// ==========================================

const SpellingModal = ({ wordObj, onClose }) => {
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const rawText = wordObj.word || wordObj.chinese || "";
  
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    stopAllAudio();
    let isCancelled = false;
    
    const runSequence = async () => {
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
    };
    runSequence();
    return () => {
      isCancelled = true;
      stopAllAudio();
    };
  }, [rawText, wordObj]);

  const startRecording = async () => {
    stopAllAudio();
    playSFX('click');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => { setAudioBlob(new Blob(audioChunksRef.current, { type: 'audio/webm' })); };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { alert("Microphone access denied"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const playUserAudio = () => {
    stopAllAudio();
    if (audioBlob) {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audio.play();
    }
  };

  return (
    // 浅色磨砂背景
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-xl p-6 transition-all duration-300" onClick={onClose}>
      <div className="w-full max-w-sm flex flex-col items-center relative" onClick={e => e.stopPropagation()}>
        
        {/* 关闭按钮 (柔和设计) */}
        <button 
          onClick={() => { playSFX('click'); onClose(); }}
          className="absolute -top-16 right-0 w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-400 transition-colors shadow-sm"
        >
            <FaTimes size={16}/>
        </button>
        
        <h3 className="text-sm font-bold text-slate-400 mb-8 tracking-[0.2em] font-['Padauk'] uppercase">Spelling Practice</h3>
        
        {/* 文字显示区 (浅色模式适配) */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {rawText.split('').map((char, idx) => {
             const py = pinyin(char, { toneType: 'symbol' });
             const isActive = idx === activeCharIndex || activeCharIndex === 'all';
             return (
               <div key={idx} className="flex flex-col items-center">
                 <span className={`text-xl font-mono mb-2 transition-colors ${isActive ? 'text-blue-500 font-bold' : 'text-slate-300'}`}>
                   {py}
                 </span>
                 <span className={`text-6xl font-black transition-all duration-300 ${isActive ? 'text-slate-800 scale-110 drop-shadow-lg' : 'text-slate-200 scale-100'}`}>
                   {char}
                 </span>
               </div>
             )
          })}
        </div>

        {/* 录音控制条 (浅色风格) */}
        <div className="flex items-center gap-10">
            {!isRecording ? (
                <button onClick={startRecording} className="flex flex-col items-center gap-2 group">
                    <div className="w-16 h-16 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center shadow-lg group-active:scale-95 transition-all text-red-500">
                        <FaMicrophone size={24} />
                    </div>
                    <span className="text-xs font-['Padauk'] text-slate-500 font-bold">Record</span>
                </button>
            ) : (
                <button onClick={stopRecording} className="flex flex-col items-center gap-2 group">
                    <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-500 flex items-center justify-center animate-pulse text-red-500">
                        <FaStop size={24} />
                    </div>
                    <span className="text-xs font-['Padauk'] text-red-500 font-bold">Stop</span>
                </button>
            )}

            {audioBlob && !isRecording && (
                <div className="flex items-center gap-6 animate-in fade-in slide-in-from-left duration-300">
                    <button onClick={playUserAudio} className="flex flex-col items-center gap-2 group">
                        <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-200 group-active:scale-95 transition-all text-white">
                            <FaPlay size={20} className="ml-1" />
                        </div>
                        <span className="text-xs font-['Padauk'] text-slate-500 font-bold">Play</span>
                    </button>
                    
                    <button onClick={() => setAudioBlob(null)} className="flex flex-col items-center gap-2 mt-6 text-slate-400 hover:text-slate-600">
                       <FaRedo size={16}/>
                       <span className="text-[10px] font-['Padauk']">Retry</span>
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. 例句组件 (带自动拼音 + 紧凑)
// ==========================================

const SimpleExampleRow = ({ text, translation }) => {
  // 自动生成拼音
  const textWithPinyin = text.split('').map((char, i) => {
    // 简单判断是否是中文字符
    if (/[\u4e00-\u9fa5]/.test(char)) {
      return { char, py: pinyin(char, { toneType: 'symbol' }) };
    }
    return { char, py: '' };
  });

  return (
    <div 
      className="flex flex-col items-center justify-center py-3 px-2 w-full text-center cursor-pointer active:opacity-60 transition-opacity"
      onClick={() => { playSFX('click'); playTTS(text); }}
    >
      {/* 拼音 + 汉字 组合 */}
      <div className="flex flex-wrap justify-center gap-x-1 mb-1 leading-none">
        {textWithPinyin.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center">
                {item.py && <span className="text-[0.65rem] text-slate-400 mb-[2px] font-mono select-none">{item.py}</span>}
                <span className="text-lg text-slate-800 font-medium">{item.char}</span>
            </div>
        ))}
      </div>
      
      {translation && (
        <div className="text-sm text-slate-500 font-['Padauk'] leading-tight mt-1">
          {translation}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 4. 主组件 (WordStudyPlayer)
// ==========================================

export default function WordStudyPlayer({ data, onNext, onPrev }) {
  if (!data || !data.words || data.words.length === 0) {
    return <div className="h-screen flex items-center justify-center text-slate-400">No Data</div>;
  }

  const words = data.words;
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
    playSFX('switch'); // 播放翻页音效
    stopAllAudio();
    if (index < total - 1) {
      setIndex(index + 1);
    } else {
      if (onNext) onNext();
    }
  };

  const displayWord = currentWord.word || currentWord.chinese;
  const displayPinyin = currentWord.pinyin || pinyin(displayWord, { toneType: 'symbol' });
  const progressPercent = ((index + 1) / total) * 100;

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      
      {/* 顶部极细进度条 */}
      <div className="w-full h-1 bg-slate-200/50">
        <div 
          className="h-full bg-indigo-500 transition-all duration-300 ease-out" 
          style={{ width: `${progressPercent}%` }}
        ></div>
      </div>

      {/* 核心内容区 */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 w-full max-w-md mx-auto relative z-10">
        
        {/* 1. 单词主体 */}
        <div className="w-full flex flex-col items-center text-center">
            
            {/* 拼音 */}
            <div className="text-xl text-slate-400 font-mono mb-2 tracking-wide">
              {displayPinyin}
            </div>
            
            {/* 汉字 */}
            <h1 
              className="text-7xl font-black text-slate-800 cursor-pointer active:scale-95 transition-transform select-none mb-3 tracking-tight"
              onClick={() => { playSFX('click'); playR2Audio(currentWord); }}
            >
              {displayWord}
            </h1>

            {/* 词性 & 解释 */}
            <div className="flex flex-col items-center gap-2 mb-2">
                {currentWord.pos && (
                  <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    {currentWord.pos}
                  </span>
                )}
                
                <div className="text-2xl font-bold text-slate-700 font-['Padauk'] leading-snug px-2">
                  {currentWord.definition || currentWord.burmese}
                </div>

                {/* 缅文谐音 */}
                {currentWord.sound_burmese && (
                  <div 
                    className="text-lg text-orange-500 font-['Padauk'] opacity-90 cursor-pointer hover:opacity-100"
                    onClick={() => { playSFX('click'); playR2Audio(currentWord); }}
                  >
                    ( {currentWord.sound_burmese} )
                  </div>
                )}
            </div>
        </div>

        {/* 2. 操作区 (更紧凑，贴近主体) */}
        <div className="flex items-center justify-center gap-4 w-full mt-4 mb-6">
           {/* 拼读按钮 (浅色系) */}
           <button 
              onClick={() => { playSFX('click'); setShowSpelling(true); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-full shadow-sm active:bg-slate-50 active:scale-95 transition-all"
           >
             <FaMagic className="text-indigo-500 text-sm" />
             <span className="text-sm font-bold font-['Padauk']">စာလုံးပေါင်း</span>
           </button>

           {/* 发音按钮 (浅色系) */}
           <button 
              onClick={() => { playSFX('click'); playR2Audio(currentWord); }}
              className="w-11 h-11 bg-white border border-slate-200 text-indigo-500 rounded-full flex items-center justify-center shadow-sm active:bg-indigo-50 active:scale-95 transition-all"
           >
             <FaVolumeUp size={18}/>
           </button>
        </div>

        {/* 3. 例句区 (紧凑分割线) */}
        {(currentWord.example || currentWord.example2) && (
            <div className="w-full border-t border-slate-100 pt-2 pb-4">
                {currentWord.example && (
                    <SimpleExampleRow text={currentWord.example} translation={currentWord.example_burmese} />
                )}
                {/* 极小的垂直间距 */}
                {currentWord.example && currentWord.example2 && <div className="h-2"></div>}
                
                {currentWord.example2 && (
                    <SimpleExampleRow text={currentWord.example2} translation={currentWord.example2_burmese} />
                )}
            </div>
        )}
      </div>

      {/* 底部按钮 (提高位置，浅色系) */}
      <div className="flex-none w-full px-6 pb-12 pt-2 max-w-md mx-auto z-20">
        <button 
          onClick={handleNext}
          className="w-full h-14 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-2xl font-bold text-lg shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-indigo-100"
        >
          <span className="font-['Padauk'] font-extrabold">
            {index === total - 1 ? "ပြီးပါပြီ" : "ရှေ့ဆက်"} {/* Continue */}
          </span> 
          <FaArrowRight size={16} />
        </button>
      </div>

      {/* 拼读弹窗 */}
      {showSpelling && <SpellingModal wordObj={currentWord} onClose={() => setShowSpelling(false)} />}
    </div>
  );
}
