import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { FaVolumeUp, FaCheck, FaTimes, FaArrowRight, FaLightbulb, FaCog } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// --- 1. IndexedDB 缓存 ---
const DB_NAME = 'LessonCacheDB';
const STORE_NAME = 'tts_audio';
const DB_VERSION = 1;

const idb = {
  db: null,
  async init() {
    if (typeof window === 'undefined') return Promise.resolve();
    if (this.db) return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { resolve(); return; }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      request.onerror = (e) => reject(e);
    });
  },
  async get(key) {
    if (typeof window === 'undefined') return null;
    await this.init();
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const res = req.result;
        resolve((res && res.size > 0) ? res : null);
      };
      req.onerror = () => resolve(null);
    });
  },
  async set(key, blob) {
    if (typeof window === 'undefined') return;
    await this.init();
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE_NAME).put(blob, key);
    });
  }
};

// --- 2. 音频控制器 ---
const audioController = {
  currentAudio: null,
  playlist: [],
  activeBlobUrls: [],
  latestRequestId: 0,
  _pendingFetches: [],

  stop() {
    if (typeof window === 'undefined') return;
    this.latestRequestId++;
    this._pendingFetches.forEach(ctrl => { try { ctrl.abort(); } catch (e) {} });
    this._pendingFetches = [];
    if (this.currentAudio) {
      try {
        this.currentAudio.onended = null;
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
    }
    this.playlist = [];
    if (this.activeBlobUrls.length > 0) {
      this.activeBlobUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch (e) {} });
      this.activeBlobUrls = [];
    }
  },

  detectLanguage(text) {
    if (/[\u1000-\u109F]/.test(text)) return 'my';
    return 'zh';
  },

  async fetchAudioBlob(text, lang, preferredVoice) {
    if (typeof window === 'undefined') return null;
    let voice = 'zh-CN-XiaoyouMultilingualNeural'; 
    if (lang === 'my') voice = 'my-MM-NilarNeural'; 
    if (lang === 'zh' && preferredVoice) voice = preferredVoice; 
    const cacheKey = `tts-${voice}-${text}-0`;
    const cached = await idb.get(cacheKey);
    if (cached) return cached;
    const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=0`;
    const controller = new AbortController();
    this._pendingFetches.push(controller);
    try {
      const res = await fetch(apiUrl, { signal: controller.signal });
      const blob = await res.blob();
      if (blob.size === 0) return null;
      await idb.set(cacheKey, blob);
      return blob;
    } catch (e) { return null; }
    finally { this._pendingFetches = this._pendingFetches.filter(c => c !== controller); }
  },

  async playMixed(text, onStart, onEnd, settings = {}) {
    if (typeof window === 'undefined') return;
    this.stop();
    if (!text) { if (onEnd) onEnd(); return; }
    const reqId = ++this.latestRequestId;
    if (onStart) onStart();
    const { voice = 'zh-CN-XiaoyouMultilingualNeural', speed = 1.0 } = settings;
    const segments = [];
    const regex = /([\u4e00-\u9fa5]+)|([^\u4e00-\u9fa5]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const segmentText = match[0].trim();
      if (segmentText && /[\u4e00-\u9fa5a-zA-Z0-9\u1000-\u109F]/.test(segmentText)) {
        segments.push({ text: segmentText, lang: this.detectLanguage(segmentText) });
      }
    }
    if (segments.length === 0) { if (onEnd) onEnd(); return; }
    try {
      const blobs = await Promise.all(segments.map(seg => this.fetchAudioBlob(seg.text, seg.lang, voice)));
      if (reqId !== this.latestRequestId) return;
      const validBlobs = [];
      const validSegments = [];
      blobs.forEach((b, i) => { if (b) { validBlobs.push(b); validSegments.push(segments[i]); } });
      if (validBlobs.length === 0) { if (onEnd) onEnd(); return; }
      const audioObjects = validBlobs.map((blob, index) => {
        const url = URL.createObjectURL(blob);
        this.activeBlobUrls.push(url);
        const audio = new Audio(url);
        audio.playbackRate = validSegments[index].lang === 'zh' ? speed : 1.0; 
        return audio;
      });
      this.playlist = audioObjects;
      const playNext = (idx) => {
        if (reqId !== this.latestRequestId) return;
        if (idx >= audioObjects.length) { this.currentAudio = null; if (onEnd) onEnd(); return; }
        const audio = audioObjects[idx];
        this.currentAudio = audio;
        audio.onended = () => playNext(idx + 1);
        audio.onerror = () => playNext(idx + 1);
        audio.play().catch(() => { this.stop(); if (onEnd) onEnd(); });
      };
      playNext(0);
    } catch (e) { if (onEnd) onEnd(); }
  }
};

// --- 3. 样式定义 ---
const cssStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');
  :root {
    --primary-color: #6366f1;
    --success-color: #10b981;
    --error-color: #ef4444;
    --bg-color: #f1f5f9;
    --text-main: #1e293b;
    --text-sub: #64748b;
    --white: #ffffff;
  }
  .xzt-container {
    font-family: "Padauk", "Noto Sans SC", sans-serif;
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    background-color: var(--bg-color);
    overflow: hidden;
  }
  .xzt-scroll-area {
    flex: 1; overflow-y: auto; padding: 0 0 180px 0;
    display: flex; flex-direction: column; align-items: center;
  }
  .top-bar { width: 100%; max-width: 600px; display: flex; justify-content: flex-end; padding: 16px 20px; z-index: 10; }
  .settings-btn {
    width: 40px; height: 40px; border-radius: 50%; background: white;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05); color: var(--text-sub); cursor: pointer;
  }
  .scene-wrapper { width: 100%; max-width: 600px; padding: 10px 20px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 24px; gap: 20px; }
  .teacher-img { height: 160px; width: auto; mix-blend-mode: multiply; filter: contrast(1.05); flex-shrink: 0; }
  .bubble-container {
    flex: 1; max-width: 280px; background: var(--white); border-radius: 18px; padding: 14px 18px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.06); position: relative; margin-bottom: 35px;
  }
  .bubble-tail { position: absolute; bottom: 20px; left: -12px; width: 0; height: 0; border-top: 10px solid transparent; border-bottom: 10px solid transparent; border-right: 20px solid var(--white); }
  .rich-text-container { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 3px; line-height: 1.4; margin-bottom: 8px; }
  .cn-block { display: inline-flex; flex-direction: column; align-items: center; }
  .pinyin-top { font-size: 0.75rem; color: var(--text-sub); margin-bottom: -1px; }
  .cn-char { font-size: 1.15rem; font-weight: 700; color: var(--text-main); }
  .other-text-block { font-size: 1.0rem; font-weight: 600; color: var(--text-main); transform: translateY(-2px); }
  .bubble-audio-btn {
    align-self: flex-end; width: 28px; height: 28px; background: #eef2ff; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; color: var(--primary-color); cursor: pointer;
  }
  .bubble-audio-btn.playing { background: var(--primary-color); color: white; animation: pulse 1.2s infinite; }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); } 70% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0); } 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); } }
  .xzt-options-grid { width: 90%; max-width: 480px; display: grid; gap: 12px; grid-template-columns: 1fr; }
  .xzt-options-grid.grid-images { grid-template-columns: 1fr 1fr; }
  .xzt-option-card {
    background: white; border-radius: 16px; padding: 14px 18px; display: flex; align-items: center;
    border: 2px solid transparent; cursor: pointer; transition: all 0.2s; position: relative;
  }
  .xzt-option-card.card-with-image { flex-direction: column; padding: 0; align-items: stretch; }
  .xzt-option-card.selected { border-color: var(--primary-color); background: #eef2ff; }
  .xzt-option-card.correct-answer { border-color: var(--success-color); background: #ecfdf5; }
  .xzt-option-card.wrong-answer { border-color: var(--error-color); background: #fef2f2; }
  .xzt-option-card.disabled { pointer-events: none; }
  .opt-img { width: 45px; height: 45px; border-radius: 8px; object-fit: cover; margin-right: 12px; }
  .card-with-image .opt-img { width: 100%; height: 130px; border-radius: 0; margin: 0; }
  .opt-content { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .card-with-image .opt-content { padding: 12px 10px; }
  .opt-py { font-size: 0.8rem; color: var(--text-sub); }
  .opt-txt { font-size: 1.1rem; font-weight: 600; color: var(--text-main); }
  .status-icon { position: absolute; right: 16px; font-size: 1.2rem; }
  .card-with-image .status-icon { top: 8px; right: 8px; background: white; border-radius: 50%; padding: 2px; }
  .bottom-submit-area { position: fixed; bottom: 30px; left: 0; right: 0; display: flex; justify-content: center; z-index: 50; }
  .submit-btn {
    background: var(--primary-color); color: white; border: none; padding: 14px 70px; border-radius: 99px;
    font-size: 1.1rem; font-weight: 700; box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4); cursor: pointer;
  }
  .submit-btn:disabled { background: #cbd5e1; box-shadow: none; }
  .explanation-sheet {
    position: fixed; bottom: 0; left: 0; right: 0; background: white; border-radius: 24px 24px 0 0;
    padding: 32px 24px 50px 24px; transform: translateY(110%); transition: transform 0.35s; z-index: 100;
  }
  .explanation-sheet.show { transform: translateY(0); }
  .explanation-sheet.is-right { background: #f0fdf4; border-top: 2px solid var(--success-color); }
  .explanation-sheet.is-wrong { background: #fef2f2; border-top: 2px solid var(--error-color); }
  .result-badge { padding: 8px 24px; border-radius: 30px; background: white; font-weight: 800; display: flex; align-items: center; gap: 8px; justify-content: center; margin-bottom: 15px;}
  .next-btn { width: 100%; padding: 18px; border-radius: 18px; border: none; color: white; font-size: 1.15rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; }
  .is-right .next-btn { background: var(--success-color); }
  .is-wrong .next-btn { background: var(--error-color); }
  .settings-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: 0.2s; }
  .settings-overlay.show { opacity: 1; pointer-events: auto; }
  .settings-panel { background: white; width: 85%; max-width: 320px; border-radius: 20px; padding: 24px; }
  .speed-options { display: flex; gap: 8px; margin-top: 10px; }
  .speed-btn { flex: 1; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; cursor: pointer; }
  .speed-btn.active { background: var(--primary-color); color: white; }
`;

// --- 4. 文本解析 ---
const parseTitleText = (text) => {
  if (!text) return [];
  const result = [];
  const regex = /([\p{Script=Han}]+)|([^\p{Script=Han}]+)/gu;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const segment = match[0];
    if (/\p{Script=Han}/u.test(segment)) {
      const pinyins = pinyin(segment, { type: 'array', toneType: 'symbol' });
      segment.split('').forEach((char, i) => result.push({ type: 'zh', char, pinyin: pinyins[i] || '' }));
    } else { result.push({ type: 'other', text: segment }); }
  }
  return result;
};

// --- 5. 组件主体 ---
const XuanZeTi = (props) => {
  const rawData = props.data || props;
  const data = rawData.content || rawData; // 自动处理 content 层级

  const rawQuestion = data.question || {};
  const rawOptions = data.options || [];
  // 将正确答案全部转为字符串，确保对比一致性
  const correctIds = (data.correctAnswer || []).map(String);
  const explanationText = data.explanation || "";
  const questionText = typeof rawQuestion === 'string' ? rawQuestion : (rawQuestion.text || '');
  const questionImage = rawQuestion.imageUrl;

  const [selectedIds, setSelectedIds] = useState([]); // 选中的 ID 列表（支持多选）
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRight, setIsRight] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ voice: 'zh-CN-XiaoyouMultilingualNeural', speed: 1.0 });

  const isMultiChoice = correctIds.length > 1;

  useEffect(() => {
    audioController.stop();
    setSelectedIds([]);
    setIsSubmitted(false);
    setIsRight(false);
    // 自动播放
    if (questionText) {
      const timer = setTimeout(() => handleTitlePlay(null, true), 500);
      return () => clearTimeout(timer);
    }
  }, [questionText]);

  const handleTitlePlay = (e, isAuto = false) => {
    if (e) e.stopPropagation();
    audioController.playMixed(questionText, () => setIsPlaying(true), () => setIsPlaying(false), settings);
  };

  const handleCardClick = (option) => {
    if (isSubmitted) return;
    const id = String(option.id);
    
    if (isMultiChoice) {
      // 多选逻辑：切换选中状态
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    } else {
      // 单选逻辑：直接替换
      setSelectedIds([id]);
    }
    
    audioController.playMixed(option.text || '', null, null, settings);
  };

  const handleSubmit = () => {
    if (selectedIds.length === 0 || isSubmitted) return;
    
    // 核心判定逻辑：
    // 1. 选中的数量必须等于正确答案的数量
    // 2. 选中的每一个 ID 都必须在正确答案里
    const correct = selectedIds.length === correctIds.length && 
                    selectedIds.every(id => correctIds.includes(id));
    
    setIsRight(correct);
    setIsSubmitted(true);
    audioController.stop();

    if (correct) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
    } else {
      if (navigator.vibrate) navigator.vibrate(200);
    }
  };

  return (
    <div className="xzt-container">
      <style>{cssStyles}</style>
      
      <div className="top-bar">
        <div className="settings-btn" onClick={() => setShowSettings(true)}><FaCog /></div>
      </div>

      <div className="xzt-scroll-area">
        <div className="scene-wrapper">
          <img src="https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/1765952194374.png" className="teacher-img" alt="teacher" />
          <div className="bubble-container">
            <div className="bubble-tail"></div>
            <div className="bubble-content">
              {questionImage ? <img src={questionImage} className="question-ref-img" alt="q" /> : (
                <div className="rich-text-container">
                  {parseTitleText(questionText).map((seg, i) => (
                    seg.type === 'zh' ? (
                      <div key={i} className="cn-block">
                        <span className="pinyin-top">{seg.pinyin}</span>
                        <span className="cn-char">{seg.char}</span>
                      </div>
                    ) : <span key={i} className="other-text-block">{seg.text}</span>
                  ))}
                </div>
              )}
              <div className={`bubble-audio-btn ${isPlaying ? 'playing' : ''}`} onClick={(e) => handleTitlePlay(e)}>
                <FaVolumeUp />
              </div>
            </div>
          </div>
        </div>

        <div className={`xzt-options-grid ${rawOptions.some(o => o.imageUrl) ? 'grid-images' : ''}`}>
          {rawOptions.map(opt => {
            const id = String(opt.id);
            const isSel = selectedIds.includes(id);
            const isCorrect = correctIds.includes(id);
            
            let cardClass = opt.imageUrl ? " card-with-image" : "";
            if (isSubmitted) {
              cardClass += " disabled";
              if (isCorrect) cardClass += " correct-answer";
              else if (isSel) cardClass += " wrong-answer";
            } else if (isSel) {
              cardClass += " selected";
            }

            return (
              <div key={id} className={`xzt-option-card ${cardClass}`} onClick={() => handleCardClick(opt)}>
                {opt.imageUrl && <img src={opt.imageUrl} className="opt-img" alt="" />}
                <div className="opt-content">
                  <div className="opt-txt">{opt.text}</div>
                </div>
                {isSubmitted && isCorrect && <FaCheck className="status-icon" style={{color: '#10b981'}} />}
                {isSubmitted && isSel && !isCorrect && <FaTimes className="status-icon" style={{color: '#ef4444'}} />}
              </div>
            );
          })}
        </div>
      </div>

      {!isSubmitted && (
        <div className="bottom-submit-area">
          <button className="submit-btn" disabled={selectedIds.length === 0} onClick={handleSubmit}>
            တင်သွင်းသည် (提交)
          </button>
        </div>
      )}

      <div className={`explanation-sheet ${isSubmitted ? 'show' : ''} ${isRight ? 'is-right' : 'is-wrong'}`}>
        <div className="result-badge" style={{color: isRight ? '#10b981' : '#ef4444'}}>
          {isRight ? <FaCheck /> : <FaTimes />}
          <span>{isRight ? 'မှန်ပါတယ်' : 'မှားပါတယ်'}</span>
        </div>
        {explanationText && (
          <div className="explanation-box">
            <div className="exp-label"><FaLightbulb /> ရှင်းလင်းချက်</div>
            <div className="exp-text">{explanationText}</div>
          </div>
        )}
        <button className="next-btn" onClick={() => props.onNext?.()}>
          နောက်တစ်ပုဒ် <FaArrowRight />
        </button>
      </div>

      <div className={`settings-overlay ${showSettings ? 'show' : ''}`} onClick={() => setShowSettings(false)}>
        <div className="settings-panel" onClick={e => e.stopPropagation()}>
          <h4>Playback Settings</h4>
          <div className="speed-options">
            {[0.75, 1.0, 1.25].map(s => (
              <button key={s} className={`speed-btn ${settings.speed === s ? 'active' : ''}`} onClick={() => setSettings({...settings, speed: s})}>{s}x</button>
            ))}
          </div>
          <button style={{marginTop:20, width:'100%', padding:10}} onClick={() => setShowSettings(false)}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default XuanZeTi;
