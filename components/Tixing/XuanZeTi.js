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
// 3. 样式表
// =================================================================================
const cssStyles = `
.xzt-container {
  font-family: "Padauk","Noto Sans SC",sans-serif;
  position:absolute;inset:0;
  display:flex;flex-direction:column;
  background:#f1f5f9;
}
.xzt-scroll-area {
  flex:1;overflow-y:auto;
  padding-bottom:200px;
  display:flex;flex-direction:column;align-items:center;
}
.scene-wrapper {
  width:100%;max-width:600px;
  display:flex;align-items:flex-end;
  justify-content:center;
  margin-top:20px;padding:0 20px;gap:10px;
}
.teacher-img {
  height:160px;object-fit:contain;
  mix-blend-mode:multiply;
}
.bubble-container {
  flex:1;background:#fff;
  border-radius:20px;padding:15px 20px;
  border:1px solid #e2e8f0;
  position:relative;
}
.bubble-tail {
  position:absolute;bottom:15px;left:-10px;
  width:0;height:0;
  border-top:8px solid transparent;
  border-bottom:8px solid transparent;
  border-right:12px solid #fff;
}
.zh-seg{display:inline-flex;flex-direction:column;align-items:center;margin:0 2px}
.zh-py{font-size:.7rem;color:#94a3b8}
.zh-char{font-size:1.2rem;font-weight:700;color:#1e293b}
.my-seg{font-size:1.1rem;font-weight:600;color:#334155}

.options-grid{
  width:90%;max-width:500px;
  display:grid;gap:12px;margin-top:20px;
}
.option-card{
  background:#fff;border-radius:16px;
  padding:15px;border:2px solid #e2e8f0;
  text-align:center;cursor:pointer;
  transition: all 0.2s ease;
}
.option-card:active { transform: scale(0.98); }
.option-card.selected{border-color:#6366f1;background:#eef2ff}
.option-card.correct{border-color:#10b981;background:#ecfdf5}
.option-card.wrong{border-color:#ef4444;background:#fef2f2}

/* 提交按钮位置调整：bottom 30px -> 80px */
.submit-bar{
  position:fixed;bottom:80px;width:100%;
  display:flex;justify-content:center;
}
.submit-btn{
  border:2px solid #6366f1;
  color:#6366f1;
  background: white;
  padding:12px 60px;border-radius:100px;
  font-size:1.1rem;font-weight:800;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
.submit-btn:disabled{border-color:#cbd5e1;color:#cbd5e1;box-shadow:none;}

.result-sheet{
  position:fixed;bottom:0;left:0;right:0;
  background:#fff;padding:30px 25px 50px;
  border-radius:30px 30px 0 0;
  transform:translateY(100%);
  transition:.4s;z-index:100;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
}
.result-sheet.show{transform:translateY(0)}
.is-correct{background:#ecfdf5;border-top:5px solid #10b981}
.is-wrong{background:#fef2f2;border-top:5px solid #ef4444}
.next-btn{
  width:100%;padding:16px;border-radius:16px;
  border:none;color:#fff;font-weight:800;
  font-size:1.1rem;
  display:flex;align-items:center;justify-content:center;gap:8px;
  cursor: pointer;
}
.is-correct .next-btn{background:#10b981}
.is-wrong .next-btn{background:#ef4444}
`;

// =================================================================================
// 4. 组件主体（包含随机化和错题沉底逻辑）
// =================================================================================
const XuanZeTi = ({ data: rawData, onCorrect, onIncorrect, onNext, onWrong }) => {
  const data = rawData?.content || rawData || {};
  const question = data.question || {};
  const questionText =
    typeof question === 'string' ? question : question.text || '';
  const options = data.options || [];

  const correctAnswers = useMemo(() => {
    const raw = data.correctAnswer || [];
    return (Array.isArray(raw) ? raw : [raw]).map(String);
  }, [data.correctAnswer]);

  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRight, setIsRight] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  /** 防跳题锁 */
  const nextLockRef = useRef(false);

  /** 
   * 选项随机化逻辑 
   * 使用 useMemo 确保只在题目改变时随机一次，避免重渲染时乱序
   */
  const shuffledOptions = useMemo(() => {
    // 浅拷贝选项数组以免修改原始数据
    const opts = [...options];
    // Fisher-Yates 洗牌算法
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
  }, [data.id, options]); // 依赖项：当题目ID或原始选项集改变时重新洗牌

  /** 题目切换时 reset（关键） */
  useEffect(() => {
    nextLockRef.current = false;
    setSelectedIds([]);
    setIsSubmitted(false);
    setIsRight(false);

    audioController.stop();
    audioController.playMixed(
      questionText,
      {},
      () => setIsPlaying(true),
      () => setIsPlaying(false)
    );
  }, [data?.id]);

  const toggleOption = (id) => {
    if (isSubmitted) return;
    const sid = String(id);
    setSelectedIds(prev =>
      prev.includes(sid) ? prev.filter(i => i !== sid) : [...prev, sid]
    );
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
      onIncorrect?.(); // 答错回调（用于统计）
      
      // 核心修改：触发错题沉底逻辑
      // 通知父组件将当前题目加入队列尾部
      if (onWrong) {
        onWrong();
      }
    }
  };

  const safeNext = () => {
    if (nextLockRef.current) return;
    nextLockRef.current = true;

    audioController.stop();
    // 无论对错，只要点击了"下一题"按钮，就执行 onNext 跳转
    onNext?.(); 
  };

  const renderRichText = (text) => {
    const parts =
      text.match(/([\u4e00-\u9fa5]+|[^\u4e00-\u9fa5]+)/g) || [];
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
        <div className="scene-wrapper">
          <img
            src="https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/1765952194374.png"
            className="teacher-img"
            alt="Teacher"
          />
          <div className="bubble-container">
            <div className="bubble-tail" />
            <div className="flex flex-wrap items-end">
              {renderRichText(questionText)}
            </div>
            <div
              className={`mt-2 self-end p-2 rounded-full cursor-pointer transition-colors ${
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

        {/* 使用随机化后的选项列表进行渲染 */}
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

      {!isSubmitted && (
        <div className="submit-bar">
          <button
            className="submit-btn"
            disabled={!selectedIds.length}
            onClick={handleSubmit}
          >
            提交
          </button>
        </div>
      )}

      <div
        className={`result-sheet ${isSubmitted ? 'show' : ''} ${
          isRight ? 'is-correct' : 'is-wrong'
        }`}
      >
        <div className="flex items-center gap-3 text-xl font-black mb-4">
          {isRight ? <FaCheck /> : <FaTimes />}
          {isRight ? '正确' : '错误'}
        </div>

        <button className="next-btn" onClick={safeNext}>
          {/* 文案调整，如果错了提示“稍后重试” */}
          {!isRight ? '继续 (稍后重做)' : '下一题'} <FaArrowRight />
        </button>
      </div>
    </div>
  );
};

export default XuanZeTi;
