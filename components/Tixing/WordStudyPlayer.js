import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  FaVolumeUp, FaChevronRight, FaTimes, 
  FaMagic, FaMicrophone, FaStop, FaPlay, FaRedo, FaArrowRight 
} from "react-icons/fa";
import { pinyin } from 'pinyin-pro';
import { Howl, Howler } from 'howler';

// ==========================================
// 1. 全局音频管理器 (防止音频重叠与内存泄漏)
// ==========================================

const audioManager = {
  currentHowl: null,
  currentTTS: null,
  currentUserAudio: null,

  stopAll: function() {
    this.stopVoice();
    this.stopTTS();
    this.stopUser();
  },

  stopVoice: function() {
    if (this.currentHowl) {
      this.currentHowl.stop();
      this.currentHowl.unload();
      this.currentHowl = null;
    }
  },

  stopTTS: function() {
    if (this.currentTTS) {
      this.currentTTS.pause();
      this.currentTTS.currentTime = 0;
      this.currentTTS = null;
    }
  },

  stopUser: function() {
    if (this.currentUserAudio) {
      this.currentUserAudio.pause();
      this.currentUserAudio.currentTime = 0;
      if (this.currentUserAudio.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.currentUserAudio.src);
      }
      this.currentUserAudio = null;
    }
  }
};

// 辅助音效
const playSFX = (type) => {
  const paths = {
    click: '/sounds/click.mp3',
    switch: '/sounds/switch-card.mp3'
  };
  if (!paths[type]) return;
  new Howl({ src: [paths[type]], volume: 0.4 }).play();
};

// ==========================================
// 2. 拼读弹窗组件 (优化逻辑与兼容性)
// ==========================================

const SpellingModal = ({ wordObj, onClose }) => {
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const rawText = wordObj.word || wordObj.chinese || "";

  // 播放序列：拼读 -> 完整单词音频
  useEffect(() => {
    audioManager.stopAll();
    let isCancelled = false;
    
    const runSequence = async () => {
      const chars = rawText.split('');
      for (let i = 0; i < chars.length; i++) {
        if (isCancelled) return;
        setActiveCharIndex(i);
        
        const py = pinyin(chars[i], { toneType: 'symbol' });
        await new Promise((resolve) => {
          const sound = new Howl({
            src: [`https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodeURIComponent(py)}.mp3`],
            html5: true,
            onend: resolve,
            onloaderror: resolve,
            onplayerror: resolve
          });
          audioManager.currentHowl = sound;
          sound.play();
        });
        await new Promise(r => setTimeout(r, 100));
      }
      
      if (isCancelled) return;
      setActiveCharIndex('all');
      
      // 播放最终完整单词
      const formattedId = String(wordObj.id).padStart(4, '0');
      const url = `https://audio.886.best/chinese-vocab-audio/hsk${wordObj.hsk_level}/${formattedId}.mp3`;
      const finalSound = new Howl({
        src: [url],
        html5: true,
        onloaderror: () => playTTS(rawText),
        onplayerror: () => playTTS(rawText)
      });
      audioManager.currentHowl = finalSound;
      finalSound.play();
    };

    runSequence();
    return () => { isCancelled = true; audioManager.stopAll(); };
  }, [rawText, wordObj.id]);

  const startRecording = async () => {
    audioManager.stopAll();
    playSFX('click');
    chunksRef.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 兼容性 mimeType 探测
      const options = MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' } : undefined;
      const mr = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = () => setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }));
      
      mr.start();
      setIsRecording(true);
    } catch (err) { alert("麦克风权限被拒绝 (Microphone access denied)"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const playUserAudio = () => {
    audioManager.stopUser();
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioManager.currentUserAudio = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play();
    }
  };

  const playTTS = (text) => {
    audioManager.stopTTS();
    const a = new Audio(`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural`);
    audioManager.currentTTS = a;
    a.play().catch(e => console.error(e));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 backdrop-blur-xl p-6" onClick={onClose}>
      <div className="w-full max-w-sm flex flex-col items-center relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-16 right-0 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 shadow-sm"><FaTimes size={16}/></button>
        <h3 className="text-sm font-bold text-slate-400 mb-8 tracking-widest uppercase font-['Padauk']">Spelling Practice</h3>
        
        <div className="flex flex-wrap justify-center gap-5 mb-12">
          {rawText.split('').map((char, idx) => {
             const py = pinyin(char, { toneType: 'symbol' });
             const isActive = idx === activeCharIndex || activeCharIndex === 'all';
             return (
               <div key={idx} className="flex flex-col items-center">
                 <span className={`text-xl font-mono mb-2 ${isActive ? 'text-indigo-500 font-bold' : 'text-slate-300'}`}>{py}</span>
                 <span className={`text-6xl font-black transition-all duration-300 ${isActive ? 'text-slate-800 scale-110 drop-shadow-md' : 'text-slate-200'}`}>{char}</span>
               </div>
             )
          })}
        </div>

        <div className="flex items-center gap-10">
            {!isRecording ? (
                <button onClick={startRecording} className="flex flex-col items-center gap-2 group">
                    <div className="w-16 h-16 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center shadow-lg text-red-500 group-active:scale-95 transition-all"><FaMicrophone size={24} /></div>
                    <span className="text-xs font-['Padauk'] text-slate-500 font-bold">မှတ်တမ်းတင်မည်</span>
                </button>
            ) : (
                <button onClick={stopRecording} className="flex flex-col items-center gap-2 group">
                    <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-500 flex items-center justify-center animate-pulse text-red-500"><FaStop size={24} /></div>
                    <span className="text-xs font-['Padauk'] text-red-500 font-bold">ရပ်တန့်မည်</span>
                </button>
            )}

            {audioBlob && !isRecording && (
                <div className="flex items-center gap-6 animate-in fade-in slide-in-from-left">
                    <button onClick={playUserAudio} className="flex flex-col items-center gap-2 group">
                        <div className="w-16 h-16 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg text-white group-active:scale-95 transition-all"><FaPlay size={20} className="ml-1" /></div>
                        <span className="text-xs font-['Padauk'] text-slate-500 font-bold">နားထောင်မည်</span>
                    </button>
                    <button onClick={() => setAudioBlob(null)} className="flex flex-col items-center gap-2 mt-6 text-slate-400 hover:text-slate-600"><FaRedo size={16}/><span className="text-[10px]">တစ်ဖန်ပြန်လုပ်</span></button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. 例句组件
// ==========================================

const SimpleExampleRow = ({ text, translation }) => {
  const playExample = () => {
    audioManager.stopTTS();
    const a = new Audio(`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural`);
    audioManager.currentTTS = a;
    a.play();
  };

  const chars = text.split('').map(char => ({
    char,
    py: /[\u4e00-\u9fa5]/.test(char) ? pinyin(char, { toneType: 'symbol' }) : ''
  }));

  return (
    <div className="flex flex-col items-center justify-center py-3 px-2 w-full text-center cursor-pointer active:opacity-60 transition-opacity" onClick={playExample}>
      <div className="flex flex-wrap justify-center gap-x-1 mb-1 leading-none">
        {chars.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center">
                {item.py && <span className="text-[0.6rem] text-slate-400 mb-[1px] font-mono select-none">{item.py}</span>}
                <span className="text-lg text-slate-800 font-medium">{item.char}</span>
            </div>
        ))}
      </div>
      {translation && <div className="text-sm text-slate-500 font-['Padauk'] leading-tight mt-1">{translation}</div>}
    </div>
  );
};

// ==========================================
// 4. 主组件 (WordStudyPlayer)
// ==========================================

export default function WordStudyPlayer({ data, onNext, onPrev }) {
  const [index, setIndex] = useState(0);
  const [showSpelling, setShowSpelling] = useState(false);
  
  if (!data || !data.words || data.words.length === 0) {
    return <div className="h-screen flex items-center justify-center text-slate-400">ဒေတာမရှိပါ</div>;
  }

  const currentWord = data.words[index];
  const total = data.words.length;

  // 切换单词自动播放
  useEffect(() => {
    audioManager.stopAll();
    const timer = setTimeout(() => {
      const formattedId = String(currentWord.id).padStart(4, '0');
      const sound = new Howl({
        src: [`https://audio.886.best/chinese-vocab-audio/hsk${currentWord.hsk_level}/${formattedId}.mp3`],
        html5: true,
        onloaderror: () => playTTS(currentWord.word || currentWord.chinese),
        onplayerror: () => playTTS(currentWord.word || currentWord.chinese)
      });
      audioManager.currentHowl = sound;
      sound.play();
    }, 400);
    return () => clearTimeout(timer);
  }, [index, currentWord.id]);

  const playTTS = (text) => {
    audioManager.stopTTS();
    const a = new Audio(`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural`);
    audioManager.currentTTS = a;
    a.play().catch(e => console.error(e));
  };

  const handleNext = () => {
    playSFX('switch');
    audioManager.stopAll();
    if (index < total - 1) {
      setIndex(index + 1);
    } else if (onNext) {
      onNext();
    }
  };

  const progressPercent = ((index + 1) / total) * 100;

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      
      {/* 顶部进度条 */}
      <div className="w-full h-1 bg-slate-200/50 shrink-0">
        <div className="h-full bg-indigo-500 transition-all duration-300 ease-out" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* 核心内容区 */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 w-full max-w-md mx-auto relative z-10 overflow-y-auto pt-4 pb-2">
        
        {/* 单词显示 */}
        <div className="w-full flex flex-col items-center text-center">
            <div className="text-xl text-slate-400 font-mono mb-2 tracking-wide">
              {currentWord.pinyin || pinyin(currentWord.word || currentWord.chinese, { toneType: 'symbol' })}
            </div>
            
            <h1 
              className="text-7xl font-black text-slate-800 cursor-pointer active:scale-95 transition-transform select-none mb-3 tracking-tight"
              onClick={() => { playSFX('click'); playTTS(currentWord.word || currentWord.chinese); }}
            >
              {currentWord.word || currentWord.chinese}
            </h1>

            <div className="flex flex-col items-center gap-2 mb-2">
                {currentWord.pos && (
                  <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    {currentWord.pos}
                  </span>
                )}
                <div className="text-2xl font-bold text-slate-700 font-['Padauk'] leading-snug px-2">
                  {currentWord.definition || currentWord.burmese}
                </div>
                {currentWord.sound_burmese && (
                  <div className="text-lg text-orange-500 font-['Padauk'] opacity-90">( {currentWord.sound_burmese} )</div>
                )}
            </div>
        </div>

        {/* 操作区 */}
        <div className="flex items-center justify-center gap-5 w-full mt-5 mb-8">
           <button 
              onClick={() => { playSFX('click'); setShowSpelling(true); }}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-full shadow-sm active:scale-95 transition-all"
           >
             <FaMagic className="text-indigo-500 text-sm" />
             <span className="text-sm font-bold font-['Padauk']">စာလုံးပေါင်း</span>
           </button>

           <button 
              onClick={() => { playSFX('click'); playTTS(currentWord.word || currentWord.chinese); }}
              className="w-12 h-12 bg-white border border-slate-200 text-indigo-500 rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-all"
           >
             <FaVolumeUp size={20}/>
           </button>
        </div>

        {/* 例句区 */}
        {(currentWord.example || currentWord.example2) && (
            <div className="w-full border-t border-slate-100 pt-3 pb-4">
                {currentWord.example && <SimpleExampleRow text={currentWord.example} translation={currentWord.example_burmese} />}
                {currentWord.example && currentWord.example2 && <div className="h-2"></div>}
                {currentWord.example2 && <SimpleExampleRow text={currentWord.example2} translation={currentWord.example2_burmese} />}
            </div>
        )}
      </div>

      {/* 底部按钮区 (布局修复：大幅上移) */}
      <div className="flex-none w-full px-5 pt-4 pb-[calc(2.5rem+env(safe-area-inset-bottom,0))] bg-white/50 backdrop-blur-md border-t border-slate-100 max-w-md mx-auto z-20">
        <button 
          onClick={handleNext}
          className="w-full h-15 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-100 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
        >
          <span className="font-['Padauk'] tracking-wider">
            {index === total - 1 ? "သင်ခန်းစာပြီးပြီ" : "ရှေ့ဆက်မည်"}
          </span> 
          <FaArrowRight size={18} />
        </button>
      </div>

      {/* 拼读弹窗组件 */}
      {showSpelling && <SpellingModal wordObj={currentWord} onClose={() => setShowSpelling(false)} />}
    </div>
  );
               }
