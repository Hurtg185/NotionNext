import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { FaVolumeUp, FaCheck, FaTimes, FaArrowRight, FaLightbulb, FaCog, FaSpinner } from 'react-icons/fa';
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
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
    });
  },
  async get(key) {
    await this.init(); if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  },
  async set(key, blob) {
    await this.init(); if (!this.db) return;
    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, key);
  }
};

// =================================================================================
// 2. 音频控制器 (连贯朗读：缅语男/中文男童)
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
    if (onStart) onStart();

    // 语种识别拆分块
    const regex = /([\u4e00-\u9fa5]+|[\u1000-\u109F\s]+|[a-zA-Z0-9\s]+)/g;
    const segments = text.match(regex) || [text];

    try {
      const audios = [];
      for (const seg of segments) {
        if (!seg.trim()) continue;
        const isMy = /[\u1000-\u109F]/.test(seg);
        const voice = isMy ? 'my-MM-ThihaNeural' : (settings.voice || 'zh-CN-XiaoyouNeural');
        const cacheKey = `${voice}-${seg}`;
        
        let blob = await idb.get(cacheKey);
        if (!blob) {
          const res = await fetch(`/api/tts?t=${encodeURIComponent(seg)}&v=${voice}`);
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
        if (i >= audios.length) { if (onEnd) onEnd(); return; }
        this.currentAudio = audios[i];
        audios[i].onended = () => playNext(i + 1);
        audios[i].play().catch(() => playNext(i + 1));
      };
      playNext(0);
    } catch (e) { if (onEnd) onEnd(); }
  }
};

// =================================================================================
// 3. 样式表 (无毛玻璃，实体背景，透明人物)
// =================================================================================
const cssStyles = `
  .xzt-container {
    font-family: "Padauk", "Noto Sans SC", sans-serif;
    position: absolute; inset: 0; display: flex; flex-direction: column;
    background-color: #f1f5f9; overflow: hidden;
  }
  .xzt-scroll-area {
    flex: 1; overflow-y: auto; padding-bottom: 200px;
    display: flex; flex-direction: column; align-items: center;
  }
  .scene-wrapper {
    width: 100%; max-width: 600px; display: flex; align-items: flex-end;
    justify-content: center; margin-top: 20px; padding: 0 20px; gap: 10px;
  }
  .teacher-img {
    height: 160px; width: auto; object-fit: contain;
    mix-blend-mode: multiply; filter: contrast(1.1); flex-shrink: 0;
  }
  .bubble-container {
    flex: 1; background: white; border-radius: 20px; padding: 15px 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05); position: relative;
    border: 1px solid #e2e8f0; min-height: 80px; display: flex; flex-direction: column;
  }
  .bubble-tail {
    position: absolute; bottom: 15px; left: -10px;
    width: 0; height: 0; border-top: 8px solid transparent;
    border-bottom: 8px solid transparent; border-right: 12px solid white;
  }
  .zh-seg { display: inline-flex; flex-direction: column; align-items: center; margin: 0 2px; }
  .zh-py { font-size: 0.7rem; color: #94a3b8; }
  .zh-char { font-size: 1.2rem; font-weight: 700; color: #1e293b; }
  .my-seg { font-size: 1.1rem; font-weight: 600; color: #334155; }

  .options-grid {
    width: 90%; max-width: 500px; display: grid; gap: 12px; margin-top: 20px;
    grid-template-columns: 1fr;
  }
  .options-grid.has-img { grid-template-columns: 1fr 1fr; }

  .option-card {
    background: white; border-radius: 16px; padding: 15px;
    border: 2px solid #e2e8f0; transition: all 0.2s;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; cursor: pointer; position: relative; min-height: 70px;
  }
  .option-card.selected { border-color: #6366f1; background: #eef2ff; }
  .option-card.correct { border-color: #10b981; background: #ecfdf5; }
  .option-card.wrong { border-color: #ef4444; background: #fef2f2; }
  
  .opt-img { width: 100%; height: 120px; object-fit: cover; border-radius: 10px; margin-bottom: 10px; }

  .submit-bar {
    position: fixed; bottom: 30px; width: 100%; display: flex; justify-content: center; z-index: 50;
  }
  .submit-btn {
    background: transparent; border: 2px solid #6366f1; color: #6366f1;
    padding: 12px 60px; border-radius: 100px; font-size: 1.1rem; font-weight: 800;
    transition: all 0.2s; cursor: pointer;
  }
  .submit-btn:not(:disabled):hover { background: #6366f1; color: white; }
  .submit-btn:disabled { border-color: #cbd5e1; color: #cbd5e1; }

  .result-sheet {
    position: fixed; bottom: 0; left: 0; right: 0; background: white;
    padding: 30px 25px 50px; border-radius: 30px 30px 0 0;
    transform: translateY(100%); transition: transform 0.4s cubic-bezier(0.2, 1, 0.3, 1);
    z-index: 100; box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
  }
  .result-sheet.show { transform: translateY(0); }
  .result-sheet.is-correct { background: #ecfdf5; border-top: 5px solid #10b981; }
  .result-sheet.is-wrong { background: #fef2f2; border-top: 5px solid #ef4444; }

  .next-btn {
    width: 100%; padding: 16px; border-radius: 16px; border: none;
    color: white; font-weight: 800; font-size: 1.1rem; display: flex;
    align-items: center; justify-content: center; gap: 10px; cursor: pointer;
  }
  .is-correct .next-btn { background: #10b981; }
  .is-wrong .next-btn { background: #ef4444; }
`;

// =================================================================================
// 4. 组件主体
// =================================================================================
const XuanZeTi = (props) => {
  const { data: rawData, onCorrect, onIncorrect, onNext } = props;
  const data = rawData?.content || rawData || {};

  const question = data.question || {};
  const questionText = typeof question === 'string' ? question : (question.text || "");
  const options = data.options || [];
  
  const correctAnswers = useMemo(() => {
    const raw = data.correctAnswer || [];
    return (Array.isArray(raw) ? raw : [raw]).map(String);
  }, [data.correctAnswer]);

  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRight, setIsRight] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setSelectedIds([]);
    setIsSubmitted(false);
    audioController.playMixed(questionText, {}, () => setIsPlaying(true), () => setIsPlaying(false));
  }, [data, questionText]);

  const toggleOption = (id) => {
    if (isSubmitted) return;
    const sid = String(id);
    setSelectedIds(prev => 
      prev.includes(sid) ? prev.filter(i => i !== sid) : [...prev, sid]
    );
    // 播放选项声音
    const opt = options.find(o => String(o.id) === sid);
    if (opt) audioController.playMixed(opt.text);
  };

  const handleSubmit = () => {
    if (selectedIds.length === 0) return;
    
    // 判定逻辑：选中的集合必须与正确答案集合完全一致
    const correct = selectedIds.length === correctAnswers.length &&
                    selectedIds.every(id => correctAnswers.includes(id));
    
    setIsRight(correct);
    setIsSubmitted(true);

    if (correct) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
      new Audio('https://audio.886.best/chinese-vocab-audio/correct.mp3').play().catch(()=>{});
    } else {
      if (navigator.vibrate) navigator.vibrate(200);
      new Audio('https://audio.886.best/chinese-vocab-audio/incorrect.mp3').play().catch(()=>{});
    }
  };

  const renderRichText = (text) => {
    const regex = /([\u4e00-\u9fa5]+|[^\u4e00-\u9fa5]+)/g;
    const parts = text.match(regex) || [];
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

      <div className="xzt-scroll-area">
        {/* 老师与气泡 */}
        <div className="scene-wrapper">
          <img 
            src="https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/1765952194374.png" 
            className="teacher-img" 
            alt="Teacher" 
          />
          <div className="bubble-container">
            <div className="bubble-tail" />
            {question.imageUrl ? (
              <img src={question.imageUrl} className="w-full h-32 object-contain mb-2" alt="Question" />
            ) : (
              <div className="flex flex-wrap items-end">{renderRichText(questionText)}</div>
            )}
            <div 
              className={`mt-2 self-end p-2 rounded-full ${isPlaying ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-500'}`}
              onClick={() => audioController.playMixed(questionText, {}, () => setIsPlaying(true), () => setIsPlaying(false))}
            >
              {isPlaying ? <FaSpinner className="animate-spin" /> : <FaVolumeUp />}
            </div>
          </div>
        </div>

        {/* 选项网格 */}
        <div className={`options-grid ${options.some(o => o.imageUrl) ? 'has-img' : ''}`}>
          {options.map((opt) => {
            const sid = String(opt.id);
            const isSel = selectedIds.includes(sid);
            const isCorrect = correctAnswers.includes(sid);
            
            let cardClass = "option-card";
            if (isSubmitted) {
                if (isCorrect) cardClass += " correct";
                else if (isSel) cardClass += " wrong";
            } else if (isSel) {
                cardClass += " selected";
            }

            return (
              <div key={opt.id} className={cardClass} onClick={() => toggleOption(opt.id)}>
                {opt.imageUrl && <img src={opt.imageUrl} className="opt-img" alt="" />}
                <div className="opt-text">{opt.text}</div>
                {isSubmitted && isCorrect && <FaCheck className="absolute top-2 right-2 text-emerald-500" />}
                {isSubmitted && isSel && !isCorrect && <FaTimes className="absolute top-2 right-2 text-rose-500" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部提交按钮 */}
      {!isSubmitted && (
        <div className="submit-bar">
          <button 
            className="submit-btn" 
            disabled={selectedIds.length === 0}
            onClick={handleSubmit}
          >
            တင်သွင်းသည် (提交)
          </button>
        </div>
      )}

      {/* 结果反馈面板 */}
      <div className={`result-sheet ${isSubmitted ? 'show' : ''} ${isRight ? 'is-correct' : 'is-wrong'}`}>
        <div className={`flex items-center gap-3 text-xl font-black mb-4 ${isRight ? 'text-emerald-600' : 'text-rose-600'}`}>
          {isRight ? <FaCheck size={28} /> : <FaTimes size={28} />}
          {isRight ? 'မှန်ကန်ပါသည်' : 'မှားယွင်းနေပါသည်'}
        </div>
        
        {data.explanation && (
          <div className="bg-white/50 p-4 rounded-xl mb-6 text-slate-600 leading-relaxed">
            <div className="flex items-center gap-2 font-bold mb-1"><FaLightbulb className="text-amber-500"/> ရှင်းလင်းချက်</div>
            {data.explanation}
          </div>
        )}

        <button 
          className="next-btn" 
          onClick={() => {
            if (isRight) onCorrect?.(); else onIncorrect?.();
            onNext?.();
          }}
        >
          နောက်တစ်ပုဒ် (下一题) <FaArrowRight />
        </button>
      </div>
    </div>
  );
};

export default XuanZeTi;
