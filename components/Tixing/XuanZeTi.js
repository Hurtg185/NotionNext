// components/Tixing/XuanZeTi.js

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { FaVolumeUp, FaCheck, FaTimes, FaArrowRight, FaLightbulb, FaCog, FaSpinner } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// =================================================================================
// 1. 全局音效与 TTS 管理器 (优化：连贯朗读 + 发音人切换)
// =================================================================================
const ttsCache = new Map();

const audioController = {
  currentAudio: null,
  latestRequestId: 0,

  stop() {
    this.latestRequestId++;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  },

  isBurmese(text) {
    return /[\u1000-\u109F]/.test(text);
  },

  async getSegmentAudio(text) {
    const isMy = this.isBurmese(text);
    // 缅语改为 Thiha (男声)，中文为 Xiaoyou (小男孩)
    const voice = isMy ? 'my-MM-ThihaNeural' : 'zh-CN-XiaoyouNeural';
    const cacheKey = `${text}|${voice}`;

    if (ttsCache.has(cacheKey)) return ttsCache.get(cacheKey);

    try {
      const url = `/api/tts?t=${encodeURIComponent(text)}&v=${voice}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('TTS Error');
      const blob = await response.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      ttsCache.set(cacheKey, audio);
      return audio;
    } catch (e) {
      console.error("TTS Segment failed", e);
      return null;
    }
  },

  // 连贯播放逻辑：按语种整块播放
  async playMixed(text, onStart, onEnd) {
    this.stop();
    if (!text) return;
    const reqId = this.latestRequestId;
    if (onStart) onStart();

    // 正则拆分：中文块、缅文块（不再逐字拆分，保证连贯性）
    const regex = /([\u4e00-\u9fa5]+|[\u1000-\u109F\s]+|[a-zA-Z0-9\s]+)/g;
    const segments = text.match(regex) || [text];

    try {
      const audioObjs = [];
      for (const seg of segments) {
        if (!seg.trim()) continue;
        const audio = await this.getSegmentAudio(seg.trim());
        if (audio) audioObjs.push(audio);
      }

      if (reqId !== this.latestRequestId) return;

      const playSequence = (index) => {
        if (index >= audioObjs.length) {
          if (onEnd) onEnd();
          return;
        }
        const audio = audioObjs[index];
        this.currentAudio = audio;
        audio.currentTime = 0;
        audio.onended = () => playSequence(index + 1);
        audio.play().catch(() => playSequence(index + 1));
      };

      playSequence(0);
    } catch (e) {
      if (onEnd) onEnd();
    }
  }
};

// =================================================================================
// 2. 样式表 (包含老师图片透明化与居中逻辑)
// =================================================================================
const cssStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');

  .xzt-container {
    font-family: "Padauk", "Noto Sans SC", -apple-system, sans-serif;
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    background-color: #f8fafc;
    overflow: hidden;
  }

  .xzt-scroll-area {
    flex: 1; overflow-y: auto; padding: 20px 20px 180px 20px;
    display: flex; flex-direction: column; align-items: center;
  }

  .scene-wrapper {
    width: 100%; max-width: 600px;
    display: flex; align-items: flex-end; justify-content: center;
    margin-bottom: 30px; gap: 10px;
  }

  .teacher-img {
    height: 150px; width: auto; object-fit: contain; flex-shrink: 0;
    /* 核心：将白色背景图片与页面背景融合实现透明感 */
    mix-blend-mode: multiply;
  }

  .bubble-container {
    flex: 1; background: white; border-radius: 24px; padding: 18px 22px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.04); position: relative;
    border: 1px solid #f1f5f9; min-height: 90px;
    display: flex; flex-direction: column; justify-content: center;
  }

  .bubble-tail {
    position: absolute; bottom: 20px; left: -10px;
    width: 0; height: 0; border-top: 8px solid transparent;
    border-bottom: 8px solid transparent; border-right: 12px solid white;
  }

  .rich-text-content { 
    display: flex; flex-wrap: wrap; align-items: flex-end; gap: 4px; 
    line-height: 1.6; margin-bottom: 8px;
  }

  .zh-seg { display: flex; flex-direction: column; align-items: center; }
  .zh-py { font-size: 0.75rem; color: #94a3b8; margin-bottom: -1px; }
  .zh-char { font-size: 1.25rem; font-weight: 700; color: #1e293b; }
  .my-seg { font-size: 1.15rem; font-weight: 600; color: #334155; }

  .audio-trigger {
    align-self: flex-end; width: 36px; height: 36px; 
    background: #f1f5f9; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #6366f1; cursor: pointer; transition: all 0.2s;
  }
  .audio-trigger.active { background: #6366f1; color: white; transform: scale(1.1); }

  .options-grid {
    width: 100%; max-width: 500px;
    display: grid; gap: 12px; grid-template-columns: 1fr;
  }
  .grid-2col { grid-template-columns: 1fr 1fr; }

  .option-card {
    background: white; border-radius: 18px; padding: 18px;
    border: 2px solid #f1f5f9; box-shadow: 0 2px 10px rgba(0,0,0,0.02);
    cursor: pointer; transition: all 0.2s; 
    display: flex; flex-direction: column; align-items: center; justify-content: center; /* 居中显示 */
    position: relative; min-height: 80px; text-align: center;
  }
  .option-card:active { transform: scale(0.97); }
  .option-card.selected { border-color: #6366f1; background: #f5f3ff; }
  .option-card.correct { border-color: #10b981; background: #ecfdf5; }
  .option-card.wrong { border-color: #ef4444; background: #fef2f2; }
  .option-card.disabled { pointer-events: none; }

  .opt-img { width: 60px; height: 60px; border-radius: 10px; object-fit: cover; margin-bottom: 8px; }
  .opt-text { font-size: 1.1rem; font-weight: 700; color: #334155; }

  .bottom-bar {
    position: fixed; bottom: 0; left: 0; right: 0;
    padding: 20px 20px 40px; background: transparent;
    display: flex; justify-content: center; z-index: 50;
  }
  .submit-btn {
    width: 100%; max-width: 400px; padding: 14px; border-radius: 100px;
    background: transparent; color: #6366f1; font-weight: 800; font-size: 1.1rem;
    border: 2px solid #6366f1; transition: all 0.2s;
  }
  .submit-btn:not(:disabled):active { background: #6366f1; color: white; }
  .submit-btn:disabled { border-color: #e2e8f0; color: #94a3b8; cursor: not-allowed; }

  .result-sheet {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: white; border-radius: 32px 32px 0 0;
    padding: 30px 25px 50px; transform: translateY(100%);
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 100; box-shadow: 0 -10px 40px rgba(0,0,0,0.08);
  }
  .result-sheet.show { transform: translateY(0); }
  .result-sheet.is-correct { background: #f0fdf4; }
  .result-sheet.is-wrong { background: #fef2f2; }

  .badge {
    display: flex; align-items: center; gap: 10px; font-size: 1.4rem;
    font-weight: 900; margin-bottom: 20px;
  }
  .is-correct .badge { color: #10b981; }
  .is-wrong .badge { color: #ef4444; }

  .exp-box { background: rgba(255,255,255,0.7); padding: 16px; border-radius: 18px; margin-bottom: 25px; }

  .next-btn {
    width: 100%; padding: 16px; border-radius: 100px; border: none;
    color: white; font-weight: 800; font-size: 1.1rem; display: flex;
    align-items: center; justify-content: center; gap: 10px;
  }
  .is-correct .next-btn { background: #10b981; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); }
  .is-wrong .next-btn { background: #ef4444; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3); }
`;

// =================================================================================
// 3. 辅助组件：中缅混排注音逻辑
// =================================================================================
const RichText = ({ text }) => {
  if (!text) return null;
  const segments = [];
  const regex = /([\u4e00-\u9fa5]+|[^\u4e00-\u9fa5]+)/g;
  const matches = text.match(regex) || [text];

  matches.forEach((segment, idx) => {
    if (/[\u4e00-\u9fa5]/.test(segment)) {
      const pyArr = pinyin(segment, { type: 'array', toneType: 'symbol' });
      segment.split('').forEach((char, i) => {
        segments.push(
          <div key={`zh-${idx}-${i}`} className="zh-seg">
            <span className="zh-py">{pyArr[i]}</span>
            <span className="zh-char">{char}</span>
          </div>
        );
      });
    } else {
      segments.push(<span key={`ot-${idx}`} className="my-seg">{segment}</span>);
    }
  });

  return <div className="rich-text-content">{segments}</div>;
};

// =================================================================================
// 4. 组件主体
// =================================================================================
const XuanZeTi = (props) => {
  const { data: rawData, onCorrect, onIncorrect, onNext } = props;
  const data = rawData?.content || rawData || {};

  const question = data.question || {};
  const options = data.options || [];
  const explanation = data.explanation || "";
  const questionText = typeof question === 'string' ? question : (question.text || "");
  const questionImg = question.imageUrl || null;
  
  // 图片地址
  const teacherImg = "https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/1765952194374.png";

  const correctIds = useMemo(() => {
    const raw = data.correctAnswer || [];
    return (Array.isArray(raw) ? raw : [raw]).filter(v => v != null).map(String);
  }, [data.correctAnswer]);

  const [selected, setSelected] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRight, setIsRight] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setSelected([]);
    setIsSubmitted(false);
    setIsRight(false);
    setIsPlaying(false);
    audioController.stop();

    if (questionText) {
      const timer = setTimeout(() => {
        audioController.playMixed(questionText, () => setIsPlaying(true), () => setIsPlaying(false));
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [data, questionText]);

  const handleOptionClick = (opt) => {
    if (isSubmitted) return;
    const sid = String(opt.id);
    
    // 点击选项触发整块朗读
    audioController.playMixed(opt.text || "");

    if (navigator.vibrate) navigator.vibrate(45);

    if (correctIds.length > 1) {
      setSelected(prev => prev.includes(sid) ? prev.filter(i => i !== sid) : [...prev, sid]);
    } else {
      setSelected([sid]);
    }
  };

  const handleSubmit = () => {
    if (selected.length === 0 || isSubmitted) return;

    const isCorrectLen = selected.length === correctIds.length;
    const isAllMatch = selected.every(id => correctIds.includes(id));
    const correct = isCorrectLen && isAllMatch;

    setIsRight(correct);
    setIsSubmitted(true);
    audioController.stop();

    if (correct) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.8 } });
    } else {
      if (navigator.vibrate) navigator.vibrate(200);
    }
  };

  const handleFinalNext = () => {
    if (isRight) onCorrect?.(); else onIncorrect?.();
    onNext?.();
  };

  return (
    <div className="xzt-container">
      <style>{cssStyles}</style>

      {/* 顶部工具栏 */}
      <div className="w-full flex justify-end p-4 z-10">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-300">
           <FaCog />
        </div>
      </div>

      <div className="xzt-scroll-area">
        {/* 老师提问区 */}
        <div className="scene-wrapper">
          <img src={teacherImg} className="teacher-img" alt="teacher" />
          <div className="bubble-container">
            <div className="bubble-tail" />
            
            {/* 逻辑：有图显图，无图显文 */}
            {questionImg ? (
              <img src={questionImg} className="w-full h-36 object-contain rounded-xl bg-slate-50" alt="task" />
            ) : (
              <RichText text={questionText} />
            )}

            <div 
              className={`audio-trigger ${isPlaying ? 'active' : ''}`}
              onClick={() => audioController.playMixed(questionText, () => setIsPlaying(true), () => setIsPlaying(false))}
            >
              {isPlaying ? <FaSpinner className="animate-spin" /> : <FaVolumeUp />}
            </div>
          </div>
        </div>

        {/* 选项网格 */}
        <div className={`options-grid ${options.length > 4 ? 'grid-2col' : ''}`}>
          {options.map((opt) => {
            const sid = String(opt.id);
            const isSel = selected.includes(sid);
            const isCorrectOpt = correctIds.includes(sid);

            let statusClass = "";
            if (isSubmitted) {
              if (isCorrectOpt) statusClass = " correct";
              else if (isSel) statusClass = " wrong";
              statusClass += " disabled";
            } else if (isSel) {
              statusClass = " selected";
            }

            return (
              <div 
                key={opt.id} 
                className={`option-card${statusClass}`}
                onClick={() => handleOptionClick(opt)}
              >
                {opt.imageUrl && <img src={opt.imageUrl} className="opt-img" alt="" />}
                <div className="opt-text">{opt.text}</div>

                {isSubmitted && isCorrectOpt && (
                  <div className="absolute top-2 right-2 text-emerald-500"><FaCheck size={14} /></div>
                )}
                {isSubmitted && isSel && !isCorrectOpt && (
                  <div className="absolute top-2 right-2 text-rose-500"><FaTimes size={14} /></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部提交按钮 */}
      {!isSubmitted && (
        <div className="bottom-bar">
          <button 
            className="submit-btn" 
            onClick={handleSubmit} 
            disabled={selected.length === 0}
          >
            တင်သွင်းသည် (提交答案)
          </button>
        </div>
      )}

      {/* 反馈面板 */}
      <div className={`result-sheet ${isSubmitted ? 'show' : ''} ${isRight ? 'is-correct' : 'is-wrong'}`}>
        <div className="badge">
          {isRight ? <FaCheck /> : <FaTimes />}
          <span>{isRight ? 'မှန်ကန်ပါသည်' : 'မှားယွင်းနေပါသည်'}</span>
        </div>

        {explanation && (
          <div className="exp-box">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-2 uppercase tracking-widest">
              <FaLightbulb /> Explanation
            </div>
            <div className="text-slate-600 text-sm leading-relaxed">{explanation}</div>
          </div>
        )}

        <button className="next-btn" onClick={handleFinalNext}>
          နောက်တစ်ပုဒ် (下一题) <FaArrowRight />
        </button>
      </div>
    </div>
  );
};

export default XuanZeTi;
