import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  FaVolumeUp,
  FaCheck,
  FaTimes,
  FaArrowRight,
  FaLightbulb,
  FaSpinner,
  FaRobot
} from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// =================================================================================
// 1. IndexedDB 缓存
// =================================================================================
const DB_NAME = 'LessonCacheDB';
const STORE_NAME = 'tts_audio';

const idb = {
  db: null,
  async init() {
    if (typeof window === 'undefined' || this.db) return;
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
    });
  },
  async get(key) {
    await this.init();
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  },
  async set(key, blob) {
    await this.init();
    if (!this.db) return;
    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, key);
  }
};

// =================================================================================
// 2. 音频控制器
// =================================================================================
const audioController = {
  currentAudio: null,
  latestRequestId: 0,
  activeUrls: [],

  stop() {
    this.latestRequestId++;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.activeUrls.forEach(url => URL.revokeObjectURL(url));
    this.activeUrls = [];
  },

  async playMixed(text, settings = {}, onStart, onEnd) {
    this.stop();
    if (!text) return;
    const reqId = this.latestRequestId;
    onStart?.();

    const regex = /([\u4e00-\u9fa5]+|[\u1000-\u109F\s]+|[a-zA-Z0-9\s]+)/g;
    const segments = text.match(regex) || [text];

    try {
      const audios = [];

      for (const seg of segments) {
        if (!seg.trim()) continue;

        const isMy = /[\u1000-\u109F]/.test(seg);
        const voice = isMy
          ? 'my-MM-ThihaNeural'
          : (settings.voice || 'zh-CN-XiaoyouNeural');

        const cacheKey = `${voice}-${seg}`;
        let blob = await idb.get(cacheKey);

        if (!blob) {
          const res = await fetch(
            `/api/tts?t=${encodeURIComponent(seg)}&v=${voice}`
          );
          blob = await res.blob();
          await idb.set(cacheKey, blob);
        }

        const url = URL.createObjectURL(blob);
        this.activeUrls.push(url);

        const audio = new Audio(url);
        if (!isMy) audio.playbackRate = settings.speed || 1.0;
        audios.push(audio);
      }

      const playNext = (i) => {
        if (reqId !== this.latestRequestId) return;
        if (i >= audios.length) {
          onEnd?.();
          return;
        }
        this.currentAudio = audios[i];
        audios[i].onended = () => playNext(i + 1);
        audios[i].play().catch(() => playNext(i + 1));
      };

      playNext(0);
    } catch {
      onEnd?.();
    }
  }
};

// =================================================================================
// 3. 样式表 (包含底部自适应修复)
// =================================================================================
const cssStyles = `
.xzt-container {
  font-family: "Padauk","Noto Sans SC",sans-serif;
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: #fff;
  height: 100dvh;
}

.xzt-header {
  flex-shrink: 0;
  padding: 40px 20px 10px; 
  display: flex; justify-content: center;
}

.scene-wrapper {
  width: 100%; max-width: 600px;
  display: flex; align-items: center; 
  gap: 16px;
}

.teacher-img {
  height: 140px;
  object-fit: contain;
  mix-blend-mode: multiply; 
  flex-shrink: 0;
}

.bubble-container {
  flex: 1; 
  background: #fff;
  border-radius: 18px;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.bubble-tail {
  position: absolute; top: 50%; left: -10px;
  transform: translateY(-50%);
  width: 0; height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-right: 10px solid #e5e7eb;
}
.bubble-tail::after {
  content: ''; position: absolute;
  top: -6px; left: 2px;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right: 8px solid #fff;
}

.zh-seg { display: inline-flex; flex-direction: column; align-items: center; margin: 0 1px; }
.zh-py { font-size: .75rem; color: #94a3b8; }
.zh-char { font-size: 1.25rem; font-weight: 700; color: #1e293b; }
.my-seg { font-size: 1.1rem; font-weight: 600; color: #334155; }

.xzt-scroll-area {
  flex: 1; overflow-y: auto;
  padding: 10px 16px 200px; 
  display: flex; flex-direction: column; align-items: center;
}

.options-grid {
  width: 100%; max-width: 600px;
  display: grid; 
  gap: 12px; margin-top: 20px;
  grid-template-columns: 1fr;
}
.options-grid.has-images {
  grid-template-columns: 1fr 1fr; 
}

.option-card {
  background: #fff; 
  border-radius: 16px;
  padding: 16px; 
  border: 2px solid #e5e7eb; 
  border-bottom-width: 4px;
  cursor: pointer;
  transition: all 0.1s;
  display: flex; 
  align-items: center; 
  justify-content: center;
  min-height: 60px;
  position: relative;
}

.option-card:active { transform: translateY(2px); border-bottom-width: 2px; }
.option-card.selected { 
  border-color: #84cc16;
  background: #f7fee7; 
  color: #4d7c0f;
}
.option-card.correct { 
  border-color: #84cc16; background: #d9f99d; color: #365314; 
}
.option-card.wrong { 
  border-color: #ef4444; background: #fee2e2; color: #991b1b; 
}

.submit-bar {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 16px 20px calc(16px + env(safe-area-inset-bottom)); 
  border-top: 2px solid #f3f4f6;
  background: #fff;
  display: flex; justify-content: space-between; align-items: center;
  z-index: 50;
}
.submit-btn {
  flex: 1;
  background: #58cc02;
  color: white;
  padding: 14px; border-radius: 16px;
  font-size: 1.1rem; font-weight: 800; text-transform: uppercase;
  border: none;
  border-bottom: 4px solid #46a302;
  transition: all 0.1s;
}
.submit-btn:active { transform: translateY(2px); border-bottom-width: 0px; margin-top: 4px; }
.submit-btn:disabled { background: #e5e7eb; color: #9ca3af; border-bottom-color: #d1d5db; }

.result-sheet {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: #fff;
  padding: 20px 24px calc(24px + env(safe-area-inset-bottom));
  border-top-left-radius: 24px; border-top-right-radius: 24px;
  transform: translateY(110%);
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 100;
  box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
  display: flex; flex-direction: column; gap: 12px;
}
.result-sheet.correct { background: #dcfce7; color: #166534; }
.result-sheet.wrong { background: #fee2e2; color: #991b1b; }
.result-sheet.show { transform: translateY(0); }

.sheet-header {
  font-size: 1.5rem; font-weight: 800; margin-bottom: 4px;
  display: flex; align-items: center; gap: 12px;
}
.next-btn {
  width: 100%; padding: 14px; border-radius: 16px;
  border: none; color: #fff; font-weight: 800; text-transform: uppercase;
  font-size: 1.1rem;
  cursor: pointer;
  border-bottom: 4px solid rgba(0,0,0,0.2);
}
.btn-correct { background: #58cc02; border-bottom-color: #46a302; }
.btn-wrong { background: #ef4444; border-bottom-color: #b91c1c; }

.ai-btn {
  background: #fff;
  border: 2px solid #e5e7eb;
  color: #4f46e5;
  padding: 12px;
  border-radius: 14px;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  margin-bottom: 4px;
}
`;

// =================================================================================
// 4. 工具函数
// =================================================================================
const playSfx = (type) => {
  const paths = {
    click: '/sounds/click.mp3',
    correct: '/sounds/correct.mp3',
    wrong: '/sounds/incorrect.mp3'
  };
  const path = paths[type];
  if (!path) return;
  const audio = new Audio(path);
  audio.volume = 1.0;
  audio.play().catch(() => {}); 
};

const vibrate = (pattern) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

// =================================================================================
// 5. 组件主体
// =================================================================================
const XuanZeTi = ({ data: rawData, onCorrect, onWrong, onNext, triggerAI }) => {
  const data = rawData?.content || rawData || {};
  const question = data.question || {};
  const questionText = typeof question === 'string' ? question : question.text || '';
  const questionImg = data.imageUrl || ''; 
  const options = data.options || [];

  const correctAnswers = useMemo(() => {
    const raw = data.correctAnswer || [];
    return (Array.isArray(raw) ? raw : [raw]).map(String);
  }, [data.correctAnswer]);

  const hasOptionImages = useMemo(() => {
    return options.some(opt => opt.img || opt.imageUrl);
  }, [options]);

  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRight, setIsRight] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const nextLockRef = useRef(false);

  const shuffledOptions = useMemo(() => {
    const opts = [...options];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
  }, [data.id, options]); 

  useEffect(() => {
    nextLockRef.current = false;
    setSelectedIds([]);
    setIsSubmitted(false);
    setIsRight(false);
    audioController.stop();

    let timer;
    if(questionText) {
        timer = setTimeout(() => {
            audioController.playMixed(
              questionText,
              {},
              () => setIsPlaying(true),
              () => setIsPlaying(false)
            );
        }, 800);
    }
    return () => {
        if(timer) clearTimeout(timer);
        audioController.stop();
    };
  }, [data?.id]);

  const toggleOption = (id) => {
    if (isSubmitted) return;
    playSfx('click');
    vibrate(15); 
    const sid = String(id);
    if (correctAnswers.length === 1) {
        setSelectedIds([sid]);
    } else {
        setSelectedIds(prev =>
          prev.includes(sid) ? prev.filter(i => i !== sid) : [...prev, sid]
        );
    }
    const opt = options.find(o => String(o.id) === sid);
    if (opt && opt.text) audioController.playMixed(opt.text);
  };

  const handleSubmit = () => {
    if (!selectedIds.length) return;
    const correct =
      selectedIds.length === correctAnswers.length &&
      selectedIds.every(id => correctAnswers.includes(id));
    setIsRight(correct);
    setIsSubmitted(true);
    if (correct) {
      playSfx('correct');
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
      if(onCorrect) onCorrect();
    } else {
      playSfx('wrong');
      vibrate([50, 50, 50]); 
      if(onWrong) onWrong();
    }
  };

  const handleContinue = () => {
    if (nextLockRef.current) return;
    nextLockRef.current = true;
    audioController.stop();
    if (onNext) onNext();
  };

  const handleAskAI = (e) => {
    e.stopPropagation();
    if (triggerAI) {
      const userSelectedText = options
        .filter(o => selectedIds.includes(String(o.id)))
        .map(o => o.text)
        .join(', ');

      triggerAI({
        grammarPoint: data.grammarPoint || "通用语法",
        question: questionText,
        userChoice: userSelectedText || "未选择",
        timestamp: Date.now()
      });
    }
  };

  const renderRichText = (text) => {
    if(!text) return null;
    const parts = text.match(/([\u4e00-\u9fa5]+|[^\u4e00-\u9fa5]+)/g) || [];
    return parts.map((part, i) => {
      if (/[\u4e00-\u9fa5]/.test(part)) {
        const py = pinyin(part, { type: 'array', toneType: 'symbol' });
        return part.split('').map((char, j) => (
          <div key={`${i}-${j}`} className="zh-seg">
            <span className="zh-py">{py[j]}</span>
            <span className="zh-char">{char}</span>
          </div>
        ));
      }
      return <span key={i} className="my-seg">{part}</span>;
    });
  };

  return (
    <div className="xzt-container">
      <style>{cssStyles}</style>

      <div className="xzt-header">
        <div className="scene-wrapper">
            <img
            src="https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/1765952194374.png"
            className="teacher-img"
            alt="Teacher"
            />
            <div className="bubble-container">
                <div className="bubble-tail" />
                <div className="flex-1">
                    {questionImg ? (
                        <div className="text-gray-500 italic text-sm">Look at the image</div>
                    ) : (
                        <div className="flex flex-wrap items-end gap-1">
                             {renderRichText(questionText)}
                        </div>
                    )}
                </div>
                <div
                    className={`p-3 rounded-xl cursor-pointer transition-colors flex-shrink-0 ${
                    isPlaying ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-500'
                    }`}
                    onClick={(e) => {
                    e.stopPropagation();
                    audioController.playMixed(
                        questionText,
                        {},
                        () => setIsPlaying(true),
                        () => setIsPlaying(false)
                    );
                    }}
                >
                    {isPlaying ? <FaSpinner className="animate-spin" /> : <FaVolumeUp size={20} />}
                </div>
            </div>
        </div>
      </div>
      
      {questionImg && (
          <div className="w-full flex justify-center mt-2 mb-2 px-4">
              <img src={questionImg} alt="Topic" className="rounded-xl max-h-32 object-contain shadow-sm" />
          </div>
      )}

      <div className="xzt-scroll-area">
        <div className={`options-grid ${hasOptionImages ? 'has-images' : ''}`}>
          {shuffledOptions.map(opt => {
            const sid = String(opt.id);
            const isSel = selectedIds.includes(sid);
            const isCorrect = correctAnswers.includes(sid);
            const optImg = opt.img || opt.imageUrl;
            let cls = 'option-card';
            if(optImg) cls += ' has-image-layout'; 
            if (isSubmitted) {
              if (isCorrect) cls += ' correct';
              else if (isSel) cls += ' wrong';
            } else if (isSel) cls += ' selected';
            return (
              <div key={sid} className={cls} onClick={() => toggleOption(sid)}>
                {optImg && <img src={optImg} alt="option" className="option-img h-24 w-full object-cover rounded-lg mb-2" />}
                <span className="option-text">{opt.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {!isSubmitted && (
        <div className="submit-bar">
          <button className="submit-btn" disabled={!selectedIds.length} onClick={handleSubmit}>CHECK</button>
        </div>
      )}

      <div className={`result-sheet ${isSubmitted ? 'show' : ''} ${isRight ? 'correct' : 'wrong'}`}>
        <div className="sheet-header">
          {isRight ? <FaCheck className="text-2xl" /> : <FaTimes className="text-2xl" />}
          <span>{isRight ? 'Excellent!' : 'Incorrect'}</span>
        </div>
        {!isRight && (
             <div className="mb-2 text-md font-semibold text-red-800">
                 Correct answer: {options.filter(o => correctAnswers.includes(String(o.id))).map(o=>o.text).join(', ')}
             </div>
        )}
        {!isRight && (
            <button className="ai-btn" onClick={handleAskAI}>
               <FaRobot size={18} />
               <span>AI 老师解析</span>
            </button>
        )}
        <button className={`next-btn ${isRight ? 'btn-correct' : 'btn-wrong'}`} onClick={handleContinue}>CONTINUE</button>
      </div>
    </div>
  );
};

export default XuanZeTi;
