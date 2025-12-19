// components/Tixing/XuanZeTi.js

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { FaVolumeUp, FaCheck, FaTimes, FaArrowRight, FaLightbulb, FaCog, FaSpinner } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// =================================================================================
// 1. 全局音效与 TTS 缓存管理器 (支持混合语种顺序播放)
// =================================================================================
const ttsCache = new Map();

const audioController = {
  currentAudio: null,
  playlist: [],
  latestRequestId: 0,

  stop() {
    this.latestRequestId++;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.playlist = [];
  },

  // 智能识别：判断是否包含缅甸语字符
  isBurmese(text) {
    return /[\u1000-\u109F]/.test(text);
  },

  // 获取单个片段音频
  async getSegmentAudio(text) {
    const isMy = this.isBurmese(text);
    const voice = isMy ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouNeural';
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

  // 播放混合文本 (核心：将一句话拆分成中/缅段落依次播放)
  async playMixed(text, onStart, onEnd) {
    this.stop();
    if (!text) return;
    const reqId = this.latestRequestId;
    if (onStart) onStart();

    // 正则拆分：中文块、缅文块、其他符号块
    // 匹配中文：[\u4e00-\u9fa5]+ 
    // 匹配缅文：[\u1000-\u109F]+
    const regex = /([\u4e00-\u9fa5]+|[\u1000-\u109F]+|[a-zA-Z0-9]+)/g;
    const segments = text.match(regex) || [text];

    try {
      const audioObjs = [];
      for (const seg of segments) {
        const audio = await this.getSegmentAudio(seg);
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
// 2. 辅助样式 (一字不落的 CSS)
// =================================================================================
const cssStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');

  .xzt-container {
    font-family: "Padauk", "Noto Sans SC", -apple-system, sans-serif;
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    background-color: #f1f5f9;
    overflow: hidden;
  }

  .xzt-scroll-area {
    flex: 1; overflow-y: auto; padding: 20px 20px 180px 20px;
    display: flex; flex-direction: column; align-items: center;
  }

  .scene-wrapper {
    width: 100%; max-width: 600px;
    display: flex; align-items: flex-end; justify-content: center;
    margin-bottom: 30px; gap: 15px;
  }

  .teacher-img {
    height: 140px; width: auto; object-fit: contain; flex-shrink: 0;
  }

  .bubble-container {
    flex: 1; background: white; border-radius: 20px; padding: 15px 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05); position: relative;
    border: 1px solid #e2e8f0; min-height: 80px;
    display: flex; flex-direction: column; justify-content: center;
  }

  .bubble-tail {
    position: absolute; bottom: 15px; left: -10px;
    width: 0; height: 0; border-top: 8px solid transparent;
    border-bottom: 8px solid transparent; border-right: 12px solid white;
  }

  .rich-text-content { 
    display: flex; flex-wrap: wrap; align-items: flex-end; gap: 4px; 
    line-height: 1.6; margin-bottom: 10px;
  }

  .zh-seg { display: flex; flex-direction: column; align-items: center; margin: 0 1px; }
  .zh-py { font-size: 0.7rem; color: #64748b; margin-bottom: -2px; font-weight: 500; }
  .zh-char { font-size: 1.2rem; font-weight: 700; color: #1e293b; }
  .my-seg { font-size: 1.1rem; font-weight: 600; color: #1e293b; }

  .audio-trigger {
    align-self: flex-end; width: 32px; height: 32px; 
    background: #eff6ff; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #3b82f6; cursor: pointer; transition: all 0.2s;
  }
  .audio-trigger.active { background: #3b82f6; color: white; transform: scale(1.1); }

  .options-grid {
    width: 100%; max-width: 500px;
    display: grid; gap: 12px; grid-template-columns: 1fr;
  }
  .grid-2col { grid-template-columns: 1fr 1fr; }

  .option-card {
    background: white; border-radius: 16px; padding: 15px;
    border: 2px solid transparent; box-shadow: 0 2px 8px rgba(0,0,0,0.03);
    cursor: pointer; transition: all 0.2s; display: flex; align-items: center;
    position: relative; overflow: hidden;
  }
  .option-card:active { transform: scale(0.98); }
  .option-card.selected { border-color: #6366f1; background: #f5f3ff; }
  .option-card.correct { border-color: #10b981; background: #ecfdf5; }
  .option-card.wrong { border-color: #ef4444; background: #fef2f2; }
  .option-card.disabled { pointer-events: none; }

  .opt-img { width: 50px; height: 50px; border-radius: 8px; object-fit: cover; margin-right: 12px; }
  .opt-col { display: flex; flex-direction: column; }
  .opt-py { font-size: 0.75rem; color: #94a3b8; }
  .opt-text { font-size: 1.05rem; font-weight: 600; color: #334155; }

  .bottom-bar {
    position: fixed; bottom: 0; left: 0; right: 0;
    padding: 20px 20px 40px; background: white;
    box-shadow: 0 -5px 20px rgba(0,0,0,0.05);
    display: flex; justify-content: center; z-index: 50;
  }
  .submit-btn {
    width: 100%; max-width: 400px; padding: 15px; border-radius: 100px;
    background: #6366f1; color: white; font-weight: 800; font-size: 1.1rem;
    border: none; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
  }
  .submit-btn:disabled { background: #e2e8f0; color: #94a3b8; box-shadow: none; }

  .result-sheet {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: white; border-radius: 30px 30px 0 0;
    padding: 30px 25px 50px; transform: translateY(100%);
    transition: transform 0.4s cubic-bezier(0.2, 1, 0.3, 1);
    z-index: 100; box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
  }
  .result-sheet.show { transform: translateY(0); }
  .result-sheet.is-correct { background: #f0fdf4; }
  .result-sheet.is-wrong { background: #fef2f2; }

  .badge {
    display: flex; align-items: center; gap: 10px; font-size: 1.3rem;
    font-weight: 900; margin-bottom: 20px;
  }
  .is-correct .badge { color: #10b981; }
  .is-wrong .badge { color: #ef4444; }

  .exp-box { background: rgba(255,255,255,0.6); padding: 15px; border-radius: 15px; margin-bottom: 25px; line-height: 1.6; }

  .next-btn {
    width: 100%; padding: 16px; border-radius: 16px; border: none;
    color: white; font-weight: 800; font-size: 1.1rem; display: flex;
    align-items: center; justify-content: center; gap: 10px;
  }
  .is-correct .next-btn { background: #10b981; }
  .is-wrong .next-btn { background: #ef4444; }
`;

// =================================================================================
// 3. 辅助函数：解析混合语种文本并注音
// =================================================================================
const parseMixedText = (text) => {
  if (!text) return [];
  const result = [];
  // 匹配：一段中文 OR 一段非中文块
  const regex = /([\u4e00-\u9fa5]+|[^\u4e00-\u9fa5]+)/g;
  const matches = text.match(regex) || [text];

  matches.forEach(segment => {
    if (/[\u4e00-\u9fa5]/.test(segment)) {
      // 中文段落：拆分汉字并生成拼音
      const pyArr = pinyin(segment, { type: 'array', toneType: 'symbol' });
      segment.split('').forEach((char, i) => {
        result.push({ type: 'zh', char, pinyin: pyArr[i] });
      });
    } else {
      // 缅文、英文或符号段落
      result.push({ type: 'other', text: segment });
    }
  });
  return result;
};

// =================================================================================
// 4. 组件主体
// =================================================================================
const XuanZeTi = (props) => {
  const { data: rawData, onCorrect, onIncorrect, onNext } = props;
  const data = rawData?.content || rawData || {};

  // 数据层级修复
  const question = data.question || {};
  const options = data.options || [];
  const explanation = data.explanation || "";
  const questionText = typeof question === 'string' ? question : (question.text || "");
  const questionImg = question.imageUrl || null;
  const teacherImg = "https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/1765952194374.png";

  // 严格比对答案：强制转换为 String 数组
  const correctIds = useMemo(() => {
    const raw = data.correctAnswer || [];
    return (Array.isArray(raw) ? raw : [raw]).filter(v => v != null).map(String);
  }, [data.correctAnswer]);

  // 状态管理
  const [selected, setSelected] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRight, setIsRight] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // 每次切题时重置状态
  useEffect(() => {
    setSelected([]);
    setIsSubmitted(false);
    setIsRight(false);
    setIsPlaying(false);
    audioController.stop();

    // 自动播放题目
    if (questionText) {
      const timer = setTimeout(() => {
        audioController.playMixed(questionText, () => setIsPlaying(true), () => setIsPlaying(false));
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [data, questionText]);

  const handleOptionClick = (opt) => {
    if (isSubmitted) return;
    const sid = String(opt.id);
    
    // 播放选项声音 (缅中混合)
    audioController.playMixed(opt.text || "");

    // 震动反馈
    if (navigator.vibrate) navigator.vibrate(40);

    if (correctIds.length > 1) {
      setSelected(prev => prev.includes(sid) ? prev.filter(i => i !== sid) : [...prev, sid]);
    } else {
      setSelected([sid]);
    }
  };

  const handleSubmit = () => {
    if (selected.length === 0 || isSubmitted) return;

    // 判定逻辑修复：长度相等且每一个选中的都在正确集合中
    const isCorrectLen = selected.length === correctIds.length;
    const isAllMatch = selected.every(id => correctIds.includes(id));
    const correct = isCorrectLen && isAllMatch;

    setIsRight(correct);
    setIsSubmitted(true);
    audioController.stop();

    if (correct) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.7 } });
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

      {/* 顶部装饰条 */}
      <div className="w-full flex justify-end p-4">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-400">
           <FaCog />
        </div>
      </div>

      <div className="xzt-scroll-area">
        {/* 老师提问区域 */}
        <div className="scene-wrapper">
          <img src={teacherImg} className="teacher-img" alt="teacher" />
          <div className="bubble-container">
            <div className="bubble-tail" />
            
            {/* 题目图片 (如有) */}
            {questionImg && (
              <img src={questionImg} className="w-full h-32 object-contain rounded-lg mb-3 bg-slate-50" alt="ref" />
            )}

            {/* 智能分段文本渲染 (中缅混排) */}
            <div className="rich-text-content">
              {parseMixedText(questionText).map((seg, i) => (
                seg.type === 'zh' ? (
                  <div key={i} className="zh-seg">
                    <span className="zh-py">{seg.pinyin}</span>
                    <span className="zh-char">{seg.char}</span>
                  </div>
                ) : (
                  <span key={i} className="my-seg">{seg.text}</span>
                )
              ))}
            </div>

            {/* 播放按钮 */}
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
                <div className="opt-col">
                  {/* 选项暂不展示拼音，保持简洁，点击时会发音 */}
                  <div className="opt-text">{opt.text}</div>
                </div>

                {isSubmitted && isCorrectOpt && (
                  <FaCheck className="ml-auto text-emerald-500" />
                )}
                {isSubmitted && isSel && !isCorrectOpt && (
                  <FaTimes className="ml-auto text-rose-500" />
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

      {/* 结果反馈面板 */}
      <div className={`result-sheet ${isSubmitted ? 'show' : ''} ${isRight ? 'is-correct' : 'is-wrong'}`}>
        <div className="badge">
          {isRight ? <FaCheck /> : <FaTimes />}
          <span>{isRight ? 'မှန်ကန်ပါသည်' : 'မှားယွင်းနေပါသည်'}</span>
        </div>

        {explanation && (
          <div className="exp-box">
            <div className="flex items-center gap-2 text-slate-500 text-sm font-bold mb-1">
              <FaLightbulb /> ရှင်းလင်းချက်
            </div>
            <div className="text-slate-700">{explanation}</div>
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
