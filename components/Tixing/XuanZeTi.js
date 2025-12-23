import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  FaVolumeUp,
  FaCheck,
  FaTimes,
  FaArrowRight,
  FaLightbulb,
  FaSpinner,
  FaRedo
} from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// =================================================================================
// 1. IndexedDB 缓存 (持久化 TTS 提高加载速度)
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
// 2. 音频控制器 (连贯朗读：缅语男 / 中文男童)
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
// 3. 样式表 (优化布局、防遮挡、背景融合)
// =================================================================================
const cssStyles = `
.xzt-container {
  font-family: "Padauk","Noto Sans SC",sans-serif;
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: #f1f5f9; /* 浅灰背景 */
}

/* --- 头部区域优化 --- */
.xzt-header {
  flex-shrink: 0;
  /* 增加顶部内边距，防止内容贴顶 */
  padding: 80px 20px 20px; 
  display: flex; justify-content: center;
}

.scene-wrapper {
  width: 100%; max-width: 600px;
  display: flex; align-items: flex-start;
  gap: 12px;
}

/* --- 人物图像优化 --- */
.teacher-img {
  height: 120px; 
  object-fit: contain;
  /* 关键：正片叠底模式，让白色背景变透明，完美融入浅灰背景 */
  mix-blend-mode: multiply; 
  margin-top: 4px;
}

/* --- 气泡容器 --- */
.bubble-container {
  flex: 1; background: #fff;
  border-radius: 18px 18px 18px 0;
  padding: 18px 22px;
  border: 1px solid #e2e8f0;
  position: relative;
  box-shadow: 0 4px 15px rgba(0,0,0,0.03);
  margin-top: 10px;
}
.bubble-tail {
  position: absolute; top: 20px; left: -9px;
  width: 0; height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-right: 10px solid #fff;
}
.question-img {
  width: 100%; max-height: 140px;
  object-fit: cover; border-radius: 8px;
  margin-bottom: 12px; display: block;
}

/* --- 文本样式 --- */
.zh-seg { display: inline-flex; flex-direction: column; align-items: center; margin: 0 2px; }
.zh-py { font-size: .75rem; color: #94a3b8; }
.zh-char { font-size: 1.3rem; font-weight: 700; color: #1e293b; }
.my-seg { font-size: 1.15rem; font-weight: 600; color: #334155; line-height: 1.6; }

/* --- 滚动区域 --- */
.xzt-scroll-area {
  flex: 1; overflow-y: auto;
  padding: 10px 16px 200px; /* 底部预留极大空间，防止被面板遮挡 */
  display: flex; flex-direction: column; align-items: center;
}

.options-grid {
  width: 98%; max-width: 500px;
  display: grid; gap: 14px; margin-top: 20px;
}
.option-card {
  background: #fff; border-radius: 16px;
  padding: 18px; border: 2px solid #e2e8f0;
  text-align: center; cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1.15rem; font-weight: 600;
  color: #334155;
}
.option-card:active { transform: scale(0.98); }
.option-card.selected { border-color: #3b82f6; background: #eff6ff; color: #1d4ed8; }
.option-card.correct { border-color: #10b981; background: #ecfdf5; color: #047857; }
.option-card.wrong { border-color: #ef4444; background: #fef2f2; color: #b91c1c; }

/* --- 提交按钮 (防遮挡优化) --- */
.submit-bar {
  position: absolute; bottom: 0; left: 0; right: 0;
  /* 增加底部 padding，把按钮顶上来，避开手机底部横条和地址栏 */
  padding: 20px 20px calc(40px + env(safe-area-inset-bottom)); 
  background: linear-gradient(to top, #f1f5f9 80%, rgba(241, 245, 249, 0));
  display: flex; justify-content: center;
  z-index: 50;
  pointer-events: none; /* 让渐变层不阻挡点击，只有按钮可点 */
}
.submit-btn {
  pointer-events: auto;
  background: #1e293b; color: white;
  padding: 16px 70px; border-radius: 100px;
  font-size: 1.1rem; font-weight: 700;
  border: none;
  box-shadow: 0 6px 20px rgba(30, 41, 59, 0.3);
  transition: all 0.2s;
}
.submit-btn:disabled { background: #cbd5e1; color: #94a3b8; box-shadow: none; }
.submit-btn:active { transform: scale(0.95); }

/* --- 结果面板 (防遮挡优化) --- */
.result-sheet {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: #fff;
  /* 增加底部 padding，适配浏览器底部栏 */
  padding: 24px 24px calc(50px + env(safe-area-inset-bottom));
  border-radius: 24px 24px 0 0;
  transform: translateY(110%);
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 100;
  box-shadow: 0 -8px 30px rgba(0,0,0,0.12);
  max-height: 85vh; overflow-y: auto;
}
.result-sheet.show { transform: translateY(0); }

.sheet-header {
  display: flex; align-items: center; gap: 10px;
  font-size: 1.35rem; font-weight: 800; margin-bottom: 16px;
}
.explanation-btn {
  width: 100%; margin-bottom: 20px;
  padding: 14px; border-radius: 14px;
  background: #fffbeb; border: 1px solid #fcd34d;
  color: #92400e; font-weight: 600; font-size: 1rem;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.explanation-content {
  background: #fff7ed; padding: 16px; border-radius: 14px;
  margin-bottom: 20px; font-size: 1rem; line-height: 1.7; color: #7c2d12;
  border: 1px dashed #fdba74;
}
.next-btn {
  width: 100%; padding: 18px; border-radius: 16px;
  border: none; color: #fff; font-weight: 800;
  font-size: 1.15rem;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.btn-correct { background: #10b981; }
.btn-wrong { background: #ef4444; }
`;

// =================================================================================
// 4. 组件主体（包含随机化和错题沉底逻辑）
// =================================================================================
const XuanZeTi = ({ data: rawData, onCorrect, onIncorrect, onNext, onWrong }) => {
  const data = rawData?.content || rawData || {};
  const question = data.question || {};
  const questionText = typeof question === 'string' ? question : question.text || '';
  const imageUrl = data.imageUrl || ''; // 图片支持
  const explanation = data.explanation || ''; // 解析支持
  
  const options = data.options || [];

  const correctAnswers = useMemo(() => {
    const raw = data.correctAnswer || [];
    return (Array.isArray(raw) ? raw : [raw]).map(String);
  }, [data.correctAnswer]);

  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRight, setIsRight] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  /** 防跳题锁 */
  const nextLockRef = useRef(false);

  /** 
   * 选项随机化逻辑 
   */
  const shuffledOptions = useMemo(() => {
    const opts = [...options];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
  }, [data.id, options]); 

  /** 题目切换时 reset */
  useEffect(() => {
    nextLockRef.current = false;
    setSelectedIds([]);
    setIsSubmitted(false);
    setIsRight(false);
    setShowExplanation(false);
    
    // 立即停止上一题的声音
    audioController.stop();

    // 延时自动朗读，避免切题瞬间卡顿，并等待UI稳定
    // 改为 1000ms 延时
    let timer;
    if(questionText) {
        timer = setTimeout(() => {
            audioController.playMixed(
              questionText,
              {},
              () => setIsPlaying(true),
              () => setIsPlaying(false)
            );
        }, 1000); // 延迟 1 秒
    }

    return () => {
        if(timer) clearTimeout(timer);
        audioController.stop();
    };
  }, [data?.id]);

  const toggleOption = (id) => {
    if (isSubmitted) return;
    const sid = String(id);
    
    // 单选逻辑
    if (correctAnswers.length === 1) {
        setSelectedIds([sid]);
    } else {
        // 多选逻辑
        setSelectedIds(prev =>
          prev.includes(sid) ? prev.filter(i => i !== sid) : [...prev, sid]
        );
    }
    
    // 点击选项发音
    const opt = options.find(o => String(o.id) === sid);
    if (opt) audioController.playMixed(opt.text);
  };

  const handleSubmit = () => {
    if (!selectedIds.length) return;

    const correct =
      selectedIds.length === correctAnswers.length &&
      selectedIds.every(id => correctAnswers.includes(id));

    setIsRight(correct);
    setIsSubmitted(true);

    if (correct) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
      onCorrect?.(); // 答对回调
    } else {
      navigator.vibrate?.(200);
      onIncorrect?.(); 
      if (onWrong) onWrong(); // 触发错题沉底
    }
  };

  const safeNext = () => {
    if (nextLockRef.current) return;
    nextLockRef.current = true;

    audioController.stop();
    onNext?.(); 
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

      {/* 头部区域 */}
      <div className="xzt-header">
        <div className="scene-wrapper">
            <img
            src="https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/1765952194374.png"
            className="teacher-img"
            alt="Teacher"
            />
            <div className="bubble-container">
            <div className="bubble-tail" />
            
            {imageUrl && (
                <img src={imageUrl} alt="Question Context" className="question-img" />
            )}

            <div className="flex flex-wrap items-end gap-1">
                {renderRichText(questionText)}
            </div>

            <div
                className={`mt-2 self-end p-2 rounded-full cursor-pointer transition-colors inline-flex ${
                isPlaying
                    ? 'bg-indigo-500 text-white'
                    : 'bg-indigo-50 text-indigo-500'
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
                {isPlaying ? <FaSpinner className="animate-spin" /> : <FaVolumeUp />}
            </div>
            </div>
        </div>
      </div>

      <div className="xzt-scroll-area">
        {/* 选项列表 */}
        <div className="options-grid">
          {shuffledOptions.map(opt => {
            const sid = String(opt.id);
            const isSel = selectedIds.includes(sid);
            const isCorrect = correctAnswers.includes(sid);

            let cls = 'option-card';
            if (isSubmitted) {
              if (isCorrect) cls += ' correct';
              else if (isSel) cls += ' wrong';
            } else if (isSel) cls += ' selected';

            return (
              <div key={sid} className={cls} onClick={() => toggleOption(sid)}>
                {opt.text}
              </div>
            );
          })}
        </div>
      </div>

      {/* 提交按钮 (仅未提交时显示) */}
      {!isSubmitted && (
        <div className="submit-bar">
          <button
            className="submit-btn"
            disabled={!selectedIds.length}
            onClick={handleSubmit}
          >
            စစ်ဆေးမည် {/* 检查答案 */}
          </button>
        </div>
      )}

      {/* 结果面板 */}
      <div
        className={`result-sheet ${isSubmitted ? 'show' : ''}`}
      >
        <div className={`sheet-header ${isRight ? 'text-green-600' : 'text-red-500'}`}>
          {isRight ? <FaCheck /> : <FaTimes />}
          {isRight ? 'မှန်ပါသည်!' : 'မှားနေပါသည်'}
        </div>

        {/* 答错时显示解析按钮 */}
        {!isRight && explanation && (
            <>
                {!showExplanation ? (
                    <button className="explanation-btn" onClick={() => setShowExplanation(true)}>
                        <FaLightbulb /> ရှင်းလင်းချက်ကြည့်ရန် {/* 查看解析 */}
                    </button>
                ) : (
                    <div className="explanation-content animate-fade-in">
                        <div className="font-bold mb-1 flex items-center gap-2">
                             <FaLightbulb /> ရှင်းလင်းချက်:
                        </div>
                        {explanation}
                    </div>
                )}
            </>
        )}

        <button 
           className={`next-btn ${isRight ? 'btn-correct' : 'btn-wrong'}`} 
           onClick={safeNext}
        >
          {!isRight ? 'နောက်မှပြန်ဖြေမည် (Continue)' : 'ရှေ့ဆက်မည် (Next)'} <FaArrowRight />
        </button>
      </div>
    </div>
  );
};

export default XuanZeTi;
