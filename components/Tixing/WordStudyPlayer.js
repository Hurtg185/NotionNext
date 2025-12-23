import React, { useState, useEffect, useRef } from 'react';
import { 
  FaVolumeUp, FaChevronRight, FaTimes, 
  FaMagic, FaMicrophone, FaStop, FaPlay, FaRedo 
} from "react-icons/fa";
import { pinyin } from 'pinyin-pro';
import { Howl, Howler } from 'howler';

// ==========================================
// 1. 音频控制工具 (纯逻辑 - 严格单音频模式)
// ==========================================

const stopAllAudio = () => {
  // 1. 卸载 Howler (R2 音频)
  try { 
    Howler.unload(); 
    Howler.stop();
  } catch (e) {
    console.warn("Howler stop failed", e);
  }

  // 2. 暂停并重置所有原生 Audio 元素 (TTS / 录音回放)
  const audioElements = document.getElementsByTagName('audio');
  for (let i = 0; i < audioElements.length; i++) {
    try {
      audioElements[i].pause();
      audioElements[i].currentTime = 0;
    } catch (e) {}
  }
};

const playR2Audio = (wordObj) => {
  stopAllAudio(); // 强制停止其他声音
  
  if (wordObj && wordObj.id && wordObj.hsk_level) {
    const formattedId = String(wordObj.id).padStart(4, '0');
    const level = wordObj.hsk_level;
    const audioUrl = `https://audio.886.best/chinese-vocab-audio/hsk${level}/${formattedId}.mp3`;

    const sound = new Howl({
      src: [audioUrl],
      html5: true, 
      volume: 1.0,
      onloaderror: () => {
        playTTS(wordObj.word || wordObj.chinese);
      },
      onplayerror: () => {
        playTTS(wordObj.word || wordObj.chinese);
      }
    });
    sound.play();
  } else {
    const text = wordObj?.word || wordObj?.chinese || "Error";
    playTTS(text);
  }
};

const playSpellingAudio = (pyWithTone) => {
  // 注意：拼读是连续播放，所以在序列开始前外部会调用 stopAllAudio，
  // 单个字播放时不要在这里调用 stopAllAudio，否则会打断上一个音的尾音（如果连得很紧）。
  // 但为了防止和主音频冲突，这里仅在Promise开始时确保环境干净。
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
  stopAllAudio(); // 强制停止其他声音
  if (!text) return;
  
  const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural`;
  const audio = new Audio(url);
  audio.play().catch(e => console.error("TTS error", e));
};

// ==========================================
// 2. 拼读弹窗组件 (带录音 - 缅语界面)
// ==========================================

const SpellingModal = ({ wordObj, onClose }) => {
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const rawText = wordObj.word || wordObj.chinese || "";
  
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    stopAllAudio(); // 打开弹窗时停止背景声音
    let isCancelled = false;
    
    const runSequence = async () => {
      const chars = rawText.split('');
      for (let i = 0; i < chars.length; i++) {
        if (isCancelled) return;
        setActiveCharIndex(i);
        const charPinyin = pinyin(chars[i], { toneType: 'symbol' });
        // 播放单字
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-6" onClick={onClose}>
      <div className="w-full max-w-sm flex flex-col items-center relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-12 right-0 text-white/70 hover:text-white p-2">
            <FaTimes size={28}/>
        </button>
        
        <h3 className="text-sm font-bold text-white/50 mb-10 tracking-[0.2em] font-['Padauk']">စာလုံးပေါင်း (Spelling)</h3>
        
        <div className="flex flex-wrap justify-center gap-4 mb-10">
          {rawText.split('').map((char, idx) => {
             const py = pinyin(char, { toneType: 'symbol' });
             const isActive = idx === activeCharIndex || activeCharIndex === 'all';
             return (
               <div key={idx} className="flex flex-col items-center">
                 <span className={`text-xl font-mono mb-2 ${isActive ? 'text-orange-400 font-bold' : 'text-slate-500'}`}>{py}</span>
                 <span className={`text-6xl font-black transition-all duration-300 ${isActive ? 'text-white scale-110' : 'text-slate-600 scale-100'}`}>{char}</span>
               </div>
             )
          })}
        </div>

        {/* 录音控制条 */}
        <div className="flex items-center gap-8">
            {!isRecording ? (
                <button onClick={startRecording} className="flex flex-col items-center gap-2 text-white/80 hover:text-white">
                    <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 active:scale-95 transition-all">
                        <FaMicrophone size={24} />
                    </div>
                    <span className="text-xs font-['Padauk']">အသံသွင်းရန်</span>
                </button>
            ) : (
                <button onClick={stopRecording} className="flex flex-col items-center gap-2 text-white/80 hover:text-white">
                    <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center animate-pulse border-2 border-red-500">
                        <FaStop size={24} />
                    </div>
                    <span className="text-xs font-['Padauk']">ရပ်ရန်</span>
                </button>
            )}

            {audioBlob && !isRecording && (
                <div className="flex items-center gap-6 animate-in fade-in slide-in-from-left duration-300">
                    <button onClick={playUserAudio} className="flex flex-col items-center gap-2 text-white/80 hover:text-white">
                        <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30 active:scale-95 transition-all">
                            <FaPlay size={22} className="ml-1" />
                        </div>
                        <span className="text-xs font-['Padauk']">ပြန်နားထောင်</span>
                    </button>
                    
                    <button onClick={() => setAudioBlob(null)} className="flex flex-col items-center gap-2 text-slate-500 hover:text-slate-300 mt-6">
                       <FaRedo size={16}/>
                       <span className="text-[10px] font-['Padauk']">ပြန်စ</span>
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. 例句组件 (极简紧凑)
// ==========================================

const SimpleExampleRow = ({ text, translation }) => {
  return (
    <div 
      className="flex flex-col items-center justify-center py-2 px-1 w-full text-center cursor-pointer active:opacity-60 transition-opacity"
      onClick={() => playTTS(text)}
    >
      <div className="text-lg text-slate-800 font-medium leading-tight mb-1">
        {text}
      </div>
      {translation && (
        <div className="text-sm text-slate-500 font-['Padauk'] leading-tight">
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
    return <div className="h-screen flex items-center justify-center">No Data</div>;
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
    stopAllAudio();
    if (index < total - 1) {
      setIndex(index + 1);
    } else {
      if (onNext) onNext();
    }
  };

  const displayWord = currentWord.word || currentWord.chinese;
  const displayPinyin = currentWord.pinyin || pinyin(displayWord, { toneType: 'symbol' });

  // 计算进度百分比 (用于极简进度指示)
  const progressPercent = ((index + 1) / total) * 100;

  return (
    // 容器：全屏，无滚动，内容垂直分布
    <div className="w-full h-[100dvh] flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      
      {/* 极细的顶部进度条 */}
      <div className="w-full h-1 bg-slate-200">
        <div 
          className="h-full bg-blue-500 transition-all duration-300 ease-out" 
          style={{ width: `${progressPercent}%` }}
        ></div>
      </div>

      {/* 核心内容区：Flex 1 自动占据剩余空间，居中对齐 */}
      <div className="flex-1 flex flex-col items-center justify-evenly px-4 py-2 w-full max-w-md mx-auto">
        
        {/* 1. 单词主体区 */}
        <div className="w-full flex flex-col items-center text-center space-y-2">
            
            {/* 拼音 */}
            <div className="text-lg text-slate-400 font-mono">
              {displayPinyin}
            </div>
            
            {/* 汉字 - 点击播放 */}
            <h1 
              className="text-6xl font-black text-slate-800 cursor-pointer active:scale-95 transition-transform select-none"
              onClick={() => playR2Audio(currentWord)}
            >
              {displayWord}
            </h1>

            {/* 词性 */}
            {currentWord.pos && (
              <div className="text-xs text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded">
                {currentWord.pos}
              </div>
            )}

            {/* 缅文释义 */}
            <div className="text-2xl font-bold text-blue-900 font-['Padauk'] pt-2 leading-snug">
              {currentWord.definition || currentWord.burmese}
            </div>

            {/* 缅文谐音 (无标签，仅文本) */}
            {currentWord.sound_burmese && (
              <div 
                className="text-lg text-orange-600 font-['Padauk'] font-medium opacity-90 pt-1"
                onClick={() => playR2Audio(currentWord)}
              >
                ( {currentWord.sound_burmese} )
              </div>
            )}
        </div>

        {/* 2. 操作按钮区 (紧凑) */}
        <div className="flex items-center justify-center gap-6 w-full pt-2">
           <button 
              onClick={() => setShowSpelling(true)}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-full shadow-sm active:bg-slate-50 transition-all"
           >
             <FaMagic className="text-blue-500" />
             <span className="text-sm font-bold font-['Padauk']">စာလုံးပေါင်း</span> {/* Spelling */}
           </button>

           <button 
              onClick={() => playR2Audio(currentWord)}
              className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-200 active:scale-95 transition-all"
           >
             <FaVolumeUp size={20}/>
           </button>
        </div>

        {/* 3. 例句区 (紧凑列表) */}
        {(currentWord.example || currentWord.example2) && (
            <div className="w-full flex flex-col items-center border-t border-slate-200/60 pt-4 mt-2">
                {currentWord.example && (
                    <SimpleExampleRow text={currentWord.example} translation={currentWord.example_burmese} />
                )}
                {/* 如果屏幕高度允许，或者有第二个例句，加上微小间距 */}
                {currentWord.example2 && <div className="h-2"></div>}
                {currentWord.example2 && (
                    <SimpleExampleRow text={currentWord.example2} translation={currentWord.example2_burmese} />
                )}
            </div>
        )}
      </div>

      {/* 底部按钮 (固定高度，不覆盖内容) */}
      <div className="flex-none w-full px-6 pb-8 pt-2 bg-slate-50 max-w-md mx-auto">
        <button 
          onClick={handleNext}
          className="w-full h-14 bg-slate-900 text-white rounded-xl font-bold text-lg shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-3"
        >
          <span className="font-['Padauk']">
            {index === total - 1 ? "ပြီးပါပြီ" : "ရှေ့ဆက်"} {/* Finished : Next */}
          </span> 
          <FaChevronRight size={14} className="text-slate-400" />
        </button>
      </div>

      {/* 拼读弹窗 */}
      {showSpelling && <SpellingModal wordObj={currentWord} onClose={() => setShowSpelling(false)} />}
    </div>
  );
}
