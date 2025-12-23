import React, { useState, useEffect, useRef } from 'react';
import { 
  FaVolumeUp, FaChevronRight, FaTimes, 
  FaMagic, FaMicrophone, FaStop, FaPlay, FaRedo, FaBookOpen 
} from "react-icons/fa";
import { pinyin } from 'pinyin-pro';
import { Howl, Howler } from 'howler';

// ==========================================
// 1. 音频控制工具 (纯逻辑)
// ==========================================

const stopAllAudio = () => {
  try { Howler.unload(); } catch (e) {}
  const audioElements = document.getElementsByTagName('audio');
  for (let i = 0; i < audioElements.length; i++) {
    try {
      audioElements[i].pause();
      audioElements[i].currentTime = 0;
    } catch (e) {}
  }
};

const playR2Audio = (wordObj) => {
  stopAllAudio();
  
  // 核心逻辑：如果有 ID 和等级，尝试播放真实音频
  if (wordObj && wordObj.id && wordObj.hsk_level) {
    const formattedId = String(wordObj.id).padStart(4, '0'); // 例如 1 -> 0001
    const level = wordObj.hsk_level;
    const audioUrl = `https://audio.886.best/chinese-vocab-audio/hsk${level}/${formattedId}.mp3`;

    const sound = new Howl({
      src: [audioUrl],
      html5: true, 
      volume: 1.0,
      onloaderror: () => {
        console.warn("R2 Audio missing, fallback to TTS");
        playTTS(wordObj.word || wordObj.chinese);
      },
      onplayerror: () => {
        playTTS(wordObj.word || wordObj.chinese);
      }
    });
    sound.play();
  } else {
    // 数据不完整时，直接 TTS
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
  if (!text) return;
  try { Howler.unload(); } catch(e){}
  // 使用微软中文语音
  const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural`;
  const audio = new Audio(url);
  audio.play().catch(e => console.error("TTS error", e));
};

// ==========================================
// 2. 拼读弹窗组件 (带录音)
// ==========================================

const SpellingModal = ({ wordObj, onClose }) => {
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const rawText = wordObj.word || wordObj.chinese || "";
  
  // 录音状态
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => { setAudioBlob(new Blob(audioChunksRef.current, { type: 'audio/webm' })); };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { alert("请允许浏览器访问麦克风"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const playUserAudio = () => {
    if (audioBlob) {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audio.play();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-6" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 p-2"><FaTimes size={20}/></button>
        
        <div className="pt-10 pb-8 px-6 flex flex-col items-center">
          <h3 className="text-xs font-bold text-slate-400 mb-6 tracking-widest uppercase">SPELLING PRACTICE</h3>
          
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {rawText.split('').map((char, idx) => {
               const py = pinyin(char, { toneType: 'symbol' });
               const isActive = idx === activeCharIndex || activeCharIndex === 'all';
               return (
                 <div key={idx} className="flex flex-col items-center">
                   <span className={`text-lg font-mono mb-1 ${isActive ? 'text-orange-500 font-bold' : 'text-slate-300'}`}>{py}</span>
                   <span className={`text-5xl font-black transition-transform duration-300 ${isActive ? 'text-blue-600 scale-110' : 'text-slate-700 scale-100'}`}>{char}</span>
                 </div>
               )
            })}
          </div>

          <div className="w-full bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col items-center gap-4">
             <div className="flex items-center gap-6">
                {!isRecording ? (
                  <button onClick={startRecording} className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all">
                    <FaMicrophone size={20} />
                  </button>
                ) : (
                  <button onClick={stopRecording} className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center animate-pulse">
                    <FaStop size={20} />
                  </button>
                )}
                {audioBlob && !isRecording && (
                  <>
                    <button onClick={playUserAudio} className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all">
                      <FaPlay size={18} className="ml-1" />
                    </button>
                    <button onClick={() => setAudioBlob(null)} className="flex flex-col items-center text-slate-400 text-xs">
                       <FaRedo size={14} className="mb-1"/> 重录
                    </button>
                  </>
                )}
             </div>
             <div className="text-xs text-slate-400 font-medium">
                {isRecording ? "正在录音..." : (audioBlob ? "点击播放对比" : "点击麦克风跟读")}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. 例句组件 (简洁版)
// ==========================================

const SimpleExampleRow = ({ text, translation }) => {
  const py = pinyin(text, { toneType: 'symbol' });
  return (
    <div 
      className="flex flex-col items-start p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer group active:scale-[0.99]"
      onClick={() => playTTS(text)}
    >
      <div className="flex items-start gap-3 w-full">
        <div className="mt-1 w-1 h-8 bg-orange-200 rounded-full flex-none group-hover:bg-orange-400 transition-colors"></div>
        <div className="flex-1 text-left">
            <div className="text-xs text-slate-400 mb-1 font-mono">{py}</div>
            <div className="text-lg text-slate-800 font-medium leading-relaxed mb-1">{text}</div>
            {translation && (
              <div className="text-sm text-slate-500 font-['Padauk'] leading-relaxed opacity-90">
                {translation}
              </div>
            )}
        </div>
        <div className="opacity-0 group-hover:opacity-100 text-blue-400 self-center transition-opacity">
           <FaVolumeUp />
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 4. 主组件 (不含数据，仅接收 Props)
// ==========================================

/**
 * @param {Object} props
 * @param {Object} props.data - 数据对象 { words: [...] }
 * @param {Function} props.onNext - 完成/下一页回调
 * @param {Function} props.onPrev - 上一页回调
 */
export default function WordStudyPlayer({ data, onNext, onPrev }) {
  // 1. 安全检查
  if (!data || !data.words || data.words.length === 0) {
    return (
      <div className="w-full h-screen flex items-center justify-center text-slate-400">
        请传入有效的 data.words 数据
      </div>
    );
  }

  const words = data.words;
  const [index, setIndex] = useState(0);
  const [showSpelling, setShowSpelling] = useState(false);
  
  const currentWord = words[index];
  const total = words.length;

  // 2. 自动播放逻辑
  useEffect(() => {
    if (currentWord) {
      // 稍微延迟，等待页面渲染完成，体验更流畅
      const timer = setTimeout(() => {
        playR2Audio(currentWord);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [index, currentWord]);

  // 3. 翻页逻辑
  const handleNext = () => {
    if (index < total - 1) {
      setIndex(index + 1);
    } else {
      if (onNext) onNext();
    }
  };

  // 属性兼容：支持 raw 'word' 或 'chinese'
  const displayWord = currentWord.word || currentWord.chinese;
  const displayPinyin = currentWord.pinyin || pinyin(displayWord, { toneType: 'symbol' });

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-slate-50 text-slate-800 relative overflow-hidden font-sans">
      
      {/* 顶部进度条 */}
      <div className="flex-none h-16 px-6 flex items-center justify-between z-10 bg-white/80 backdrop-blur-sm shadow-sm sticky top-0">
        <div className="flex items-center gap-2 text-slate-500 font-bold">
           <FaBookOpen className="text-blue-500"/>
           <span>HSK 1</span>
        </div>
        <div className="text-slate-400 text-sm font-mono bg-slate-100 px-3 py-1 rounded-full">
          {index + 1} <span className="text-slate-300">/</span> {total}
        </div>
      </div>

      {/* 主滚动区域 */}
      <div className="flex-1 overflow-y-auto pb-40 px-6 no-scrollbar">
        <div className="max-w-md mx-auto w-full pt-8 flex flex-col items-center">
          
          {/* 单词卡片 */}
          <div className="w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 mb-8 flex flex-col items-center relative overflow-hidden border border-white">
            {/* 顶部装饰条 */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-indigo-500"></div>

            {/* 拼音 */}
            <div className="text-xl text-slate-400 font-mono font-medium mb-1 mt-4">
              {displayPinyin}
            </div>
            
            {/* 汉字 */}
            <h1 
              className="text-5xl font-black text-slate-800 mb-3 cursor-pointer active:scale-95 transition-transform text-center"
              onClick={() => playR2Audio(currentWord)}
            >
              {displayWord}
            </h1>

            {/* 词性标记 */}
            {currentWord.pos && (
              <div className="mb-4 px-3 py-0.5 bg-slate-100 text-slate-400 text-xs rounded-md font-bold tracking-wide">
                {currentWord.pos}
              </div>
            )}

            {/* 缅文释义 */}
            <div className="text-center w-full mb-4 px-2">
               <div className="text-2xl font-bold text-blue-900 mb-1 font-['Padauk'] leading-normal">
                 {currentWord.definition || currentWord.burmese}
               </div>
            </div>

            {/* 缅文谐音 (模拟发音) */}
            {currentWord.sound_burmese && (
              <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-full border border-yellow-100 mb-6">
                 <span className="text-[10px] font-bold text-yellow-600 uppercase tracking-wide">Sound</span>
                 <span className="text-lg font-bold text-slate-700 font-['Padauk']">{currentWord.sound_burmese}</span>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center gap-4 w-full justify-center">
               <button 
                  onClick={() => setShowSpelling(true)}
                  className="flex-1 bg-blue-50 text-blue-600 py-3 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 active:scale-95"
               >
                 <FaMagic /> 拼读
               </button>
               <button 
                  onClick={() => playR2Audio(currentWord)}
                  className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
               >
                 <FaVolumeUp size={20}/>
               </button>
            </div>
          </div>

          {/* 例句区域 */}
          <div className="w-full space-y-4 mb-8">
             <div className="text-xs font-bold text-slate-400 ml-2 uppercase tracking-wider">Examples</div>
             {currentWord.example && (
                <SimpleExampleRow text={currentWord.example} translation={currentWord.example_burmese} />
             )}
             {currentWord.example2 && (
                <SimpleExampleRow text={currentWord.example2} translation={currentWord.example2_burmese} />
             )}
          </div>

        </div>
      </div>

      {/* 底部按钮区域 - 固定且上移 */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-md border-t border-slate-100 px-6 pt-4 pb-12" // pb-12 增加底部安全距离
      >
        <div className="max-w-md mx-auto">
          <button 
            onClick={handleNext}
            className="w-full h-14 bg-slate-900 text-white rounded-2xl font-bold text-lg shadow-xl shadow-slate-300 hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            {index === total - 1 ? "完成学习" : "继续"} <FaChevronRight size={14} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* 弹窗 */}
      {showSpelling && <SpellingModal wordObj={currentWord} onClose={() => setShowSpelling(false)} />}
    </div>
  );
}
