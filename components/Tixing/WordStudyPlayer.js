import React, { useState, useEffect, useRef } from 'react';
import { 
  FaVolumeUp, FaChevronLeft, FaChevronRight, FaTimes, 
  FaMagic, FaMicrophone, FaStop, FaPlay, FaRedo 
} from "react-icons/fa";
import { pinyin } from 'pinyin-pro';
import { Howl, Howler } from 'howler';

// --- 1. 音频控制工具 ---

// 停止所有正在播放的声音
const stopAllAudio = () => {
  try {
    Howler.unload(); 
  } catch (e) {
    console.warn("Howler unload failed:", e);
  }

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
  
  if (!wordObj || !wordObj.id || !wordObj.hsk_level) {
    const text = wordObj?.word || wordObj?.chinese;
    if (text) playTTS(text);
    return;
  }

  const formattedId = String(wordObj.id).padStart(4, '0');
  const level = wordObj.hsk_level;
  const audioUrl = `https://audio.886.best/chinese-vocab-audio/hsk${level}/${formattedId}.mp3`;

  const sound = new Howl({
    src: [audioUrl],
    html5: true, 
    volume: 1.0,
    onloaderror: (id, err) => {
      console.warn("R2 Audio missing, fallback to TTS:", err);
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
  try {
    Howler.unload(); 
  } catch(e){}

  const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural`;
  const audio = new Audio(url);
  audio.play().catch(e => console.error("TTS play failed", e));
};

// --- 2. 拼读弹窗组件 (含录音功能) ---
const SpellingModal = ({ wordObj, onClose }) => {
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const rawText = wordObj.word || wordObj.chinese || "";
  
  // 录音相关状态
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

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
      
      // 注意：这里移除了自动关闭，因为用户可能需要录音
    };

    runSpellingSequence();

    return () => {
      isCancelled = true;
      stopAllAudio();
    };
  }, [rawText, wordObj]);

  // 开始录音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("无法访问麦克风，请检查权限。");
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // 停止所有流轨道
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  // 播放用户录音
  const playUserAudio = () => {
    if (audioBlob) {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  return (
    // 背景遮罩：点击关闭
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4"
      onClick={onClose}
    >
      {/* 弹窗主体：阻止冒泡防止关闭 */}
      <div 
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部关闭按钮 */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 transition-colors z-10"
        >
          <FaTimes size={24}/>
        </button>

        <div className="pt-10 pb-6 px-6 flex flex-col items-center">
          <h3 className="text-xs font-bold text-slate-400 mb-8 tracking-[0.2em] uppercase">Spelling & Record</h3>
          
          {/* 拼读展示区 */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {rawText.split('').map((char, idx) => {
               const py = pinyin(char, { toneType: 'symbol' });
               const isActive = idx === activeCharIndex || activeCharIndex === 'all';
               return (
                 <div key={idx} className="flex flex-col items-center transition-all duration-200">
                   <span className={`text-xl font-mono mb-2 transition-colors ${isActive ? 'text-orange-500 font-bold' : 'text-slate-300'}`}>
                     {py}
                   </span>
                   <span className={`text-5xl font-black transition-all transform ${isActive ? 'text-blue-600 scale-110' : 'text-slate-800 scale-100'}`}>
                     {char}
                   </span>
                 </div>
               )
            })}
          </div>

          <div className="text-slate-400 text-sm font-medium mb-8 h-6">
              {activeCharIndex === 'all' ? (
                <button onClick={() => playR2Audio(wordObj)} className="flex items-center gap-2 text-blue-500 hover:text-blue-600">
                  <FaVolumeUp /> 再次示范
                </button>
              ) : '拼读中...'}
          </div>

          {/* 录音功能区 */}
          <div className="w-full bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col items-center">
             <div className="text-xs text-slate-400 mb-3 font-bold uppercase">跟读录音对比</div>
             
             <div className="flex items-center gap-6">
                {/* 录音按钮 */}
                {!isRecording ? (
                  <button 
                    onClick={startRecording}
                    className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-200 hover:bg-red-600 hover:scale-105 transition-all"
                  >
                    <FaMicrophone size={20} />
                  </button>
                ) : (
                  <button 
                    onClick={stopRecording}
                    className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center animate-pulse"
                  >
                    <FaStop size={20} />
                  </button>
                )}

                {/* 播放录音按钮 (只有录音后显示) */}
                {audioBlob && !isRecording && (
                  <div className="flex items-center gap-4 animate-in slide-in-from-left duration-300">
                    <button 
                      onClick={playUserAudio}
                      className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg shadow-green-200 hover:bg-green-600 transition-all"
                    >
                      <FaPlay size={18} className="ml-1" />
                    </button>
                    
                    <button 
                      onClick={() => setAudioBlob(null)}
                      className="text-slate-400 text-xs flex flex-col items-center hover:text-slate-600"
                    >
                       <FaRedo size={12} className="mb-1"/> 重录
                    </button>
                  </div>
                )}
             </div>
             
             <div className="mt-3 text-xs text-slate-400">
                {isRecording ? "正在录音..." : (audioBlob ? "点击绿色按钮播放您的发音" : "点击麦克风开始跟读")}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 3. 辅助组件：支持主语替换的例句行 ---
const InteractiveExampleRow = ({ text, translation }) => {
  // 定义常见的起始主语（按长度排序，优先匹配长的）
  const SUBJECTS = ['我们', '你们', '他们', '她们', '它们', '大家', '我', '你', '他', '她', '它'];
  
  // 状态：当前显示的文本
  const [currentText, setCurrentText] = useState(text);
  
  // 当传入的 text prop 变化时，重置
  useEffect(() => {
    setCurrentText(text);
  }, [text]);

  // 尝试替换主语的逻辑
  const switchSubject = (newSubject) => {
    if (!text) return;
    
    let updatedText = currentText;
    let replaced = false;

    // 1. 检查当前文本是否以已知主语开头
    for (const subj of SUBJECTS) {
      if (currentText.startsWith(subj)) {
        updatedText = newSubject + currentText.substring(subj.length);
        replaced = true;
        break;
      }
    }

    // 2. 如果没有匹配到已知主语，为了演示效果，我们在前面加一个逗号拼接（或者直接强制替换前两个字，但这不准确）
    // 这里的策略是：如果没匹配到，我们假定用户想把这个主语加在最前面练习
    if (!replaced) {
      // 简单判断：如果已经包含了我们要切换的主语在开头，就不动了
      if (!currentText.startsWith(newSubject)) {
         // 强制替换逻辑比较危险，这里选择不做操作，或者可以在前面加上 "比如：[主语]..."
         // 为了用户体验，我们做个简单的回退：如果无法智能替换，就仅仅播放该主语+原句的音频？
         // 决定：不做强行替换，只替换已匹配的。
         // 如果原句是 "下雨了" (无主语)，变 "我下雨了" 奇怪。
         // 所以：如果没匹配到，不做任何改变，或者提示无法替换。
         console.log("No matching subject found to replace.");
         return; 
      }
    }

    setCurrentText(updatedText);
    playTTS(updatedText);
  };

  const py = pinyin(currentText, { toneType: 'symbol' });

  // 判断是否显示替换工具栏：只有当原句以常用代词开头时才显示
  const canReplace = SUBJECTS.some(s => text.startsWith(s));

  return (
    <div className="flex flex-col items-center py-4 relative group">
      {/* 主语切换工具栏 (仅在 Hover 或 激活时显示，这里为了方便直接显示一个小条) */}
      {canReplace && (
        <div className="flex gap-2 mb-2 opacity-60 hover:opacity-100 transition-opacity">
          {['我', '你', '他'].map(subj => (
            <button
              key={subj}
              onClick={(e) => { e.stopPropagation(); switchSubject(subj); }}
              className={`px-2 py-0.5 text-xs rounded border ${
                currentText.startsWith(subj) 
                  ? 'bg-orange-100 text-orange-600 border-orange-200' 
                  : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
              }`}
            >
              {subj}
            </button>
          ))}
          <button 
             onClick={(e) => { e.stopPropagation(); setCurrentText(text); }} // 重置
             className="px-2 py-0.5 text-xs text-slate-300 hover:text-slate-500"
          >
            还原
          </button>
        </div>
      )}

      <div 
        className="text-center cursor-pointer active:scale-[0.99] transition-transform w-full"
        onClick={() => playTTS(currentText)}
      >
        <div className="text-sm text-orange-400 mb-1 font-mono leading-none opacity-80">
          {py}
        </div>
        <div className="text-xl text-slate-700 font-medium leading-relaxed px-4">
          {currentText}
        </div>
        {translation && (
          <div className="text-base text-slate-400 mt-1 font-['Padauk']">
            {translation}
          </div>
        )}
      </div>
      
      <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400 text-xs flex items-center gap-1">
        <FaVolumeUp /> 点击朗读
      </div>
    </div>
  );
};

// --- 4. 主组件 ---
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

        {/* 例句区域：使用新的支持主语替换的组件 */}
        <div className="w-full max-w-lg space-y-6 text-center">
            {currentWord.example && (
              <InteractiveExampleRow 
                text={currentWord.example} 
                translation={currentWord.example_burmese} 
              />
            )}
            {currentWord.example2 && (
              <InteractiveExampleRow 
                text={currentWord.example2} 
                translation={currentWord.example2_burmese} 
              />
            )}
        </div>
      </div>

      {/* 底部导航 */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-20 bg-white/90 backdrop-blur-md border-t border-slate-50 px-6 pt-4"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-6 max-w-md mx-auto">
            <button 
              onClick={handleNext}
              className="flex-1 h-14 bg-white text-slate-700 border-2 border-slate-100 rounded-full font-bold text-lg hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              {index === total - 1 ? "完成" : "继续"} <FaChevronRight size={14} className="text-slate-400" />
            </button>
        </div>
      </div>

      {/* 拼读弹窗 */}
      {showSpelling && (
        <SpellingModal wordObj={currentWord} onClose={() => setShowSpelling(false)} />
      )}
    </div>
  );
}
