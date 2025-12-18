import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { FaVolumeUp, FaCheck, FaTimes, FaArrowRight, FaLightbulb, FaCog } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// --- 音频控制器 ---
const audioController = {
  currentAudio: null,
  latestRequestId: 0,
  stop() {
    this.latestRequestId++;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  },
  async play(text, settings) {
    this.stop();
    const reqId = this.latestRequestId;
    const voice = /[\u1000-\u109F]/.test(text) ? 'my-MM-NilarNeural' : (settings.voice || 'zh-CN-XiaoyouMultilingualNeural');
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=0`;
    const audio = new Audio(url);
    audio.playbackRate = settings.speed || 1.0;
    this.currentAudio = audio;
    audio.play().catch(() => {});
    return new Promise(resolve => {
      audio.onended = () => { if(reqId === this.latestRequestId) resolve(); };
      audio.onerror = () => resolve();
    });
  }
};

const XuanZeTi = (props) => {
  // 1. 数据标准化：自动处理 content 嵌套或直接平铺
  const rawData = props.data || props;
  const data = rawData.content || rawData; 
  const { question = {}, options = [], correctAnswer = [], explanation = "" } = data;
  
  const questionText = typeof question === 'string' ? question : (question.text || "");
  const questionImage = question.imageUrl || null;
  const correctIds = correctAnswer.map(String); // 统一转为字符串
  const isMulti = correctIds.length > 1;

  // 2. 状态管理
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRight, setIsRight] = useState(false);
  const [settings, setSettings] = useState({ voice: 'zh-CN-XiaoyouMultilingualNeural', speed: 1.0 });

  // 3. 核心逻辑
  useEffect(() => {
    setSelectedIds([]);
    setIsSubmitted(false);
    audioController.play(questionText, settings);
  }, [data]);

  const handleOptionClick = (id) => {
    if (isSubmitted) return;
    const sid = String(id);
    if (isMulti) {
      setSelectedIds(prev => prev.includes(sid) ? prev.filter(i => i !== sid) : [...prev, sid]);
    } else {
      setSelectedIds([sid]);
    }
    const opt = options.find(o => String(o.id) === sid);
    if (opt) audioController.play(opt.text, settings);
  };

  const handleSubmit = () => {
    if (selectedIds.length === 0) return;
    // 判定逻辑：选中项与正确项集合完全一致
    const correct = selectedIds.length === correctIds.length && 
                    selectedIds.every(id => correctIds.includes(id));
    setIsRight(correct);
    setIsSubmitted(true);
    if (correct) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  };

  return (
    <div style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      {/* 问题区 */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <img src="https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/1765952194374.png" style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
          <div style={{ background: '#eef2ff', padding: '10px 15px', borderRadius: '12px', position: 'relative' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{questionText}</div>
            <button onClick={() => audioController.play(questionText, settings)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6366f1' }}> <FaVolumeUp /> 听题目</button>
          </div>
        </div>
        {questionImage && <img src={questionImage} style={{ width: '100%', borderRadius: '8px', marginTop: '10px' }} />}
      </div>

      {/* 选项区 */}
      <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: options.some(o => o.imageUrl) ? '1fr 1fr' : '1fr' }}>
        {options.map(opt => {
          const sid = String(opt.id);
          const isSel = selectedIds.includes(sid);
          const isCorrect = correctIds.includes(sid);
          let border = '2px solid #e2e8f0';
          let bg = 'white';

          if (isSubmitted) {
            if (isCorrect) { border = '2px solid #10b981'; bg = '#ecfdf5'; }
            else if (isSel) { border = '2px solid #ef4444'; bg = '#fef2f2'; }
          } else if (isSel) {
            border = '2px solid #6366f1'; bg = '#eff6ff';
          }

          return (
            <div key={sid} onClick={() => handleOptionClick(sid)} style={{ border, background: bg, padding: '15px', borderRadius: '12px', cursor: 'pointer', transition: '0.2s', position: 'relative' }}>
              {opt.imageUrl && <img src={opt.imageUrl} style={{ width: '100%', height: '100px', objectFit: 'contain', marginBottom: '10px' }} />}
              <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{opt.text}</div>
              {isSubmitted && isCorrect && <FaCheck style={{ position: 'absolute', right: '10px', top: '10px', color: '#10b981' }} />}
              {isSubmitted && isSel && !isCorrect && <FaTimes style={{ position: 'absolute', right: '10px', top: '10px', color: '#ef4444' }} />}
            </div>
          );
        })}
      </div>

      {/* 提交与反馈 */}
      {!isSubmitted ? (
        <button onClick={handleSubmit} disabled={selectedIds.length === 0} style={{ width: '100%', marginTop: '30px', padding: '15px', borderRadius: '99px', border: 'none', background: selectedIds.length > 0 ? '#6366f1' : '#cbd5e1', color: 'white', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
          确认提交
        </button>
      ) : (
        <div style={{ marginTop: '20px', padding: '20px', borderRadius: '16px', background: isRight ? '#ecfdf5' : '#fef2f2', border: `2px solid ${isRight ? '#10b981' : '#ef4444'}` }}>
          <div style={{ fontWeight: 'bold', color: isRight ? '#065f46' : '#991b1b', marginBottom: '10px' }}>
            {isRight ? '🎉 太棒了！回答正确' : '❌ 别灰心，再试一次'}
          </div>
          {explanation && <div style={{ fontSize: '14px', color: '#475569' }}><strong>解析：</strong>{explanation}</div>}
          <button onClick={() => props.onNext?.()} style={{ width: '100%', marginTop: '15px', padding: '12px', borderRadius: '12px', border: 'none', background: isRight ? '#10b981' : '#ef4444', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
            下一题 <FaArrowRight />
          </button>
        </div>
      )}
    </div>
  );
};

export default XuanZeTi;
