import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  FaVolumeUp,
  FaCheck,
  FaTimes,
  FaArrowRight,
  FaLightbulb,
  FaSpinner
} from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// =================================================================================
// 1. IndexedDB 缓存 (保持不变)
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
// 2. 音频控制器 (保持不变)
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
// 3. 样式表 (Duolingo 风格深度定制)
// =================================================================================
const cssStyles = `
.xzt-container {
  font-family: "Padauk","Noto Sans SC",sans-serif;
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: #fff; /* 整体背景改为纯白或极浅灰 */
}

/* --- 头部区域 --- */
.xzt-header {
  flex-shrink: 0;
  padding: 60px 20px 10px; 
  display: flex; justify-content: center;
}

.scene-wrapper {
  width: 100%; max-width: 600px;
  display: flex; align-items: center; /* 垂直居中 */
  gap: 16px;
}

/* --- 人物图像 (放大) --- */
.teacher-img {
  height: 180px; /* 尺寸更大 */
  object-fit: contain;
  mix-blend-mode: multiply; 
  flex-shrink: 0;
}

/* --- 气泡容器 (更紧凑) --- */
.bubble-container {
  flex: 1; 
  background: #fff;
  border-radius: 18px;
  padding: 12px 16px; /* 减小内边距 */
  border: 2px solid #e5e7eb; /* 边框加粗一点 */
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

/* 题目图片 (在气泡内显示时) */
.question-img-bubble {
  max-width: 100px; max-height: 80px;
  border-radius: 8px; object-fit: cover;
}

/* --- 文本样式 --- */
.zh-seg { display: inline-flex; flex-direction: column; align-items: center; margin: 0 1px; }
.zh-py { font-size: .75rem; color: #94a3b8; }
.zh-char { font-size: 1.25rem; font-weight: 700; color: #1e293b; }
.my-seg { font-size: 1.1rem; font-weight: 600; color: #334155; }

/* --- 滚动区域 --- */
.xzt-scroll-area {
  flex: 1; overflow-y: auto;
  padding: 10px 16px 180px; 
  display: flex; flex-direction: column; align-items: center;
}

/* --- 选项网格 --- */
.options-grid {
  width: 100%; max-width: 600px;
  display: grid; 
  gap: 12px; margin-top: 20px;
  grid-template-columns: 1fr; /* 默认单列 */
}
/* 有图片时切换为双列 */
.options-grid.has-images {
  grid-template-columns: 1fr 1fr; 
}

/* --- 选项卡片 --- */
.option-card {
  background: #fff; 
  border-radius: 16px;
  padding: 16px; 
  border: 2px solid #e5e7eb; /* 底部边框厚度模拟立体感 */
  border-bottom-width: 4px;
  cursor: pointer;
  transition: all 0.1s;
  display: flex; 
  align-items: center; 
  justify-content: center;
  min-height: 60px;
  position: relative;
}

/* 选中状态 */
.option-card:active { transform: translateY(2px); border-bottom-width: 2px; }
.option-card.selected { 
  border-color: #84cc16; /* Duolingo Green */
  background: #f7fee7; 
  color: #4d7c0f;
}
.option-card.correct { 
  border-color: #84cc16; background: #d9f99d; color: #365314; 
}
.option-card.wrong { 
  border-color: #ef4444; background: #fee2e2; color: #991b1b; 
}

/* 图片选项布局 */
.option-card.has-image-layout {
  flex-direction: column;
  padding: 10px;
  gap: 10px;
}
.option-img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 12px;
}
.option-text {
  font-size: 1.1rem; font-weight: 700;
}

/* --- 提交按钮区域 --- */
.submit-bar {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 20px 20px calc(30px + env(safe-area-inset-bottom)); 
  border-top: 2px solid #f3f4f6;
  background: #fff;
  display: flex; justify-content: space-between; align-items: center;
  z-index: 50;
}
.submit-btn {
  flex: 1;
  background: #58cc02; /* Duolingo Green */
  color: white;
  padding: 14px; border-radius: 16px;
  font-size: 1.1rem; font-weight: 800; text-transform: uppercase;
  border: none;
  border-bottom: 4px solid #46a302; /* 立体阴影 */
  transition: all 0.1s;
}
.submit-btn:active { transform: translateY(2px); border-bottom-width: 0px; margin-top: 4px; }
.submit-btn:disabled { background: #e5e7eb; color: #9ca3af; border-bottom-color: #d1d5db; }

/* --- 结果面板 --- */
.result-sheet {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: #fff;
  padding: 20px 24px calc(40px + env(safe-area-inset-bottom));
  border-top-left-radius: 24px; border-top-right-radius: 24px;
  transform: translateY(110%);
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 100;
  box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
}
.result-sheet.correct { background: #dcfce7; color: #166534; }
.result-sheet.wrong { background: #fee2e2; color: #991b1b; }
.result-sheet.show { transform: translateY(0); }

.sheet-header {
  font-size: 1.5rem; font-weight: 800; margin-bottom: 16px;
  display: flex; align-items: center; gap: 12px;
}
.next-btn {
  width: 100%; padding: 14px; border-radius: 16px;
  border: none; color: #fff; font-weight: 800; text-transform: uppercase;
  font-size: 1.1rem;
  cursor: pointer;
  border-bottom: 4px solid rgba(0,0,0,0.2);
}
.next-btn:active { transform: translateY(2px); border-bottom-width: 0; }
.btn-correct { background: #58cc02; border-bottom-color: #46a302; }
.btn-wrong { background: #ef4444; border-bottom-color: #b91c1c; }
`;

// =================================================================================
// 4. 工具函数：播放音效与震动
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
  audio.play().catch(() => {}); // 忽略自动播放限制错误
};

const vibrate = (pattern) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

// =================================================================================
// 5. 组件主体
// =================================================================================
const XuanZeTi = ({ data: rawData, onCorrect, onIncorrect, onNext, onWrong }) => {
  const data = rawData?.content || rawData || {};
  const question = data.question || {};
  const questionText = typeof question === 'string' ? question : question.text || '';
  const questionImg = data.imageUrl || ''; // 题目图片
  const explanation = data.explanation || '';
  
  const options = data.options || [];

  // 判断是否多选
  const correctAnswers = useMemo(() => {
    const raw = data.correctAnswer || [];
    return (Array.isArray(raw) ? raw : [raw]).map(String);
  }, [data.correctAnswer]);

  // 判断选项是否包含图片（用于切换Grid布局）
  const hasOptionImages = useMemo(() => {
    return options.some(opt => opt.img || opt.imageUrl);
  }, [options]);

  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRight, setIsRight] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const nextLockRef = useRef(false);

  // 随机化选项
  const shuffledOptions = useMemo(() => {
    const opts = [...options];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
  }, [data.id, options]); 

  // 初始化
  useEffect(() => {
    nextLockRef.current = false;
    setSelectedIds([]);
    setIsSubmitted(false);
    setIsRight(false);
    setShowExplanation(false);
    audioController.stop();

    // 延迟朗读
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

  // 点击选项
  const toggleOption = (id) => {
    if (isSubmitted) return;
    
    // 播放音效与震动
    playSfx('click');
    vibrate(15); // 轻微震动

    const sid = String(id);
    if (correctAnswers.length === 1) {
        setSelectedIds([sid]);
    } else {
        setSelectedIds(prev =>
          prev.includes(sid) ? prev.filter(i => i !== sid) : [...prev, sid]
        );
    }
    
    // 朗读选项文本
    const opt = options.find(o => String(o.id) === sid);
    if (opt && opt.text) audioController.playMixed(opt.text);
  };

  // 提交答案
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
      onCorrect?.(); 
    } else {
      playSfx('wrong');
      vibrate([50, 50, 50]); // 两次震动
      onIncorrect?.(); 
      if (onWrong) onWrong(); 
    }
  };

  // 下一题
  const safeNext = () => {
    if (nextLockRef.current) return;
    nextLockRef.current = true;
    audioController.stop();
    onNext?.(); 
  };

  // 渲染文本（带拼音）
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

      {/* Header with Teacher & Question */}
      <div className="xzt-header">
        <div className="scene-wrapper">
            <img
            src="https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/1765952194374.png"
            className="teacher-img"
            alt="Teacher"
            />
            <div className="bubble-container">
                <div className="bubble-tail" />
                
                {/* 核心逻辑：如果有图，只显示图；没图，显示富文本 */}
                <div className="flex-1">
                    {questionImg ? (
                        <div className="text-gray-500 italic text-sm">
                           Look at the image
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-end gap-1">
                             {renderRichText(questionText)}
                        </div>
                    )}
                </div>

                {/* 发音按钮始终保留 */}
                <div
                    className={`p-3 rounded-xl cursor-pointer transition-colors flex-shrink-0 ${
                    isPlaying
                        ? 'bg-blue-500 text-white'
                        : 'bg-blue-100 text-blue-500'
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
      
      {/* Question Image (Large View) if exists - 可选：如果题目图很大，可以放在气泡下方
          根据需求 "标题有图就不显示文字"，这里假设图展示在Header和Options之间 */}
      {questionImg && (
          <div className="w-full flex justify-center mt-2 mb-2 px-4">
              <img src={questionImg} alt="Topic" className="rounded-xl max-h-40 object-contain shadow-sm" />
          </div>
      )}

      {/* Scroll Area for Options */}
      <div className="xzt-scroll-area">
        <div className={`options-grid ${hasOptionImages ? 'has-images' : ''}`}>
          {shuffledOptions.map(opt => {
            const sid = String(opt.id);
            const isSel = selectedIds.includes(sid);
            const isCorrect = correctAnswers.includes(sid);
            const optImg = opt.img || opt.imageUrl;

            let cls = 'option-card';
            if(optImg) cls += ' has-image-layout'; // 增加图文布局类

            if (isSubmitted) {
              if (isCorrect) cls += ' correct';
              else if (isSel) cls += ' wrong';
            } else if (isSel) cls += ' selected';

            return (
              <div key={sid} className={cls} onClick={() => toggleOption(sid)}>
                {/* 如果有图，显示图片 */}
                {optImg && <img src={optImg} alt="option" className="option-img" />}
                
                <span className="option-text">{opt.text}</span>
                
                {/* 多选模式下的角标 (可视情况添加) */}
                {correctAnswers.length > 1 && isSel && (
                     <div className="absolute top-2 right-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                         Selected
                     </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 提交栏 */}
      {!isSubmitted && (
        <div className="submit-bar">
          <button
            className="submit-btn"
            disabled={!selectedIds.length}
            onClick={handleSubmit}
          >
            CHECK
          </button>
        </div>
      )}

      {/* 结果面板 (Bottom Sheet) */}
      <div className={`result-sheet ${isSubmitted ? 'show' : ''} ${isRight ? 'correct' : 'wrong'}`}>
        <div className="sheet-header">
          {isRight ? <FaCheck className="text-2xl" /> : <FaTimes className="text-2xl" />}
          <span>{isRight ? 'Excellent!' : 'Incorrect'}</span>
        </div>

        {/* 答错时的解析 */}
        {!isRight && explanation && (
            <div className="mb-4 p-4 bg-white/50 rounded-xl border border-red-200 text-red-900">
                <div className="font-bold flex items-center gap-2 mb-1">
                     <FaLightbulb /> Explanation:
                </div>
                {explanation}
            </div>
        )}

        {/* 答错时显示正确答案提示 (简单版) */}
        {!isRight && !explanation && (
             <div className="mb-4 text-lg font-semibold text-red-800">
                 Correct answer: {options.filter(o => correctAnswers.includes(String(o.id))).map(o=>o.text).join(', ')}
             </div>
        )}

        <button 
           className={`next-btn ${isRight ? 'btn-correct' : 'btn-wrong'}`} 
           onClick={safeNext}
        >
          CONTINUE
        </button>
      </div>
    </div>
  );
};

export default XuanZeTi;
