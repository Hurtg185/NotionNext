import React, { useState, useEffect, useRef } from 'react';
import { 
  FaVolumeUp, 
  FaMicrophone, 
  FaStop, 
  FaPlay, 
  FaTimes, 
  FaCheckCircle,
  FaArrowRight 
} from 'react-icons/fa';
import { pinyin } from 'pinyin-pro'; // 引入 pinyin-pro 自动生成拼音

// =================================================================================
// 1. 复用之前的 Audio Controller (老师发音)
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

const audioController = {
  async play(text, isMy = false) {
    if (!text) return;
    const voice = isMy ? 'my-MM-ThihaNeural' : 'zh-CN-XiaoyouNeural';
    const cacheKey = `${voice}-${text}`;
    
    try {
      let blob = await idb.get(cacheKey);
      if (!blob) {
        const res = await fetch(`/api/tts?t=${encodeURIComponent(text)}&v=${voice}`);
        blob = await res.blob();
        await idb.set(cacheKey, blob);
      }
      const audio = new Audio(URL.createObjectURL(blob));
      audio.play();
    } catch (e) {
      console.error("TTS Error:", e);
    }
  }
};

// =================================================================================
// 2. 样式表 (包含弹窗、录音动画、布局)
// =================================================================================
const styles = `
.ws-container {
  font-family: "Padauk", "Noto Sans SC", sans-serif;
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: #f8fafc;
  overflow: hidden;
}

/* 顶部区域 */
.ws-header {
  flex-shrink: 0;
  padding: 80px 20px 10px;
  display: flex; justify-content: center;
}
.scene-wrapper {
  width: 100%; max-width: 600px;
  display: flex; align-items: flex-start; gap: 12px;
}
.teacher-img {
  height: 100px; width: auto; object-fit: contain;
  mix-blend-mode: multiply;
  margin-top: 5px;
}
.bubble-box {
  flex: 1; background: #fff;
  border-radius: 16px 16px 16px 0;
  padding: 16px; border: 1px solid #e2e8f0;
  box-shadow: 0 4px 10px rgba(0,0,0,0.02);
  position: relative;
}
.bubble-tail {
  position: absolute; top: 15px; left: -9px;
  width: 0; height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-right: 10px solid #fff;
}

/* 单词列表区域 */
.ws-scroll-area {
  flex: 1; overflow-y: auto;
  padding: 10px 16px 160px; /* 底部留白 */
  display: grid; 
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); /* 自适应网格 */
  gap: 12px;
  align-content: start;
  justify-items: center;
}

/* 单词卡片 (小尺寸) */
.mini-card {
  background: #fff;
  border: 1px solid #cbd5e1;
  border-bottom-width: 3px;
  border-radius: 12px;
  width: 100%; aspect-ratio: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}
.mini-card:active { transform: scale(0.95); border-bottom-width: 1px; margin-top: 2px; }
.mini-char { font-size: 1.8rem; font-weight: 700; color: #1e293b; line-height: 1; }
.mini-pinyin { font-size: 0.8rem; color: #64748b; margin-top: 4px; }

/* 弹窗遮罩 */
.modal-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* 弹窗主体 */
.modal-content {
  background: #fff; width: 100%; max-width: 360px;
  border-radius: 24px; padding: 24px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
  display: flex; flex-direction: column; align-items: center;
  position: relative;
  max-height: 85vh; overflow-y: auto; /* 防止内容过长溢出 */
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes slideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

.close-btn {
  position: absolute; top: 16px; right: 16px;
  color: #94a3b8; padding: 8px; font-size: 1.2rem;
  z-index: 10;
}

/* 弹窗内：单词展示 */
.big-char { font-size: 3rem; font-weight: 800; color: #0f172a; margin-bottom: 4px; line-height: 1.1; } /* 字体调小 */
.big-pinyin { font-size: 1.3rem; color: #475569; font-weight: 600; margin-bottom: 8px;}
.definition-row { 
  margin-top: 8px; font-size: 1.1rem; 
  color: #334155; text-align: center;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 12px; width: 100%;
}
.burmese-sub { font-size: 0.95rem; color: #64748b; margin-top: 4px; }

/* 弹窗内：例句列表 */
.examples-container {
  width: 100%; margin-top: 16px;
  display: flex; flex-direction: column; gap: 10px;
}
.example-item {
  background: #f8fafc; padding: 10px 12px; border-radius: 12px;
  border: 1px solid #e2e8f0;
}
.ex-zh { font-size: 1rem; font-weight: 600; color: #334155; margin-bottom: 2px; }
.ex-my { font-size: 0.85rem; color: #94a3b8; }
.play-ex-btn {
  float: right; color: #3b82f6; padding: 4px; 
  background: #dbeafe; border-radius: 50%;
  margin-left: 8px; width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
}

/* 弹窗内：录音对比区 */
.record-section {
  margin-top: 20px; width: 100%;
  border-top: 1px dashed #cbd5e1; padding-top: 16px;
  display: flex; flex-direction: column; gap: 14px;
}

.compare-row {
  display: flex; align-items: center; justify-content: space-between;
  background: #fff; border: 1px solid #e2e8f0;
  padding: 8px 16px; border-radius: 50px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.03);
}
.compare-label { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.9rem; color: #475569; }
.action-btn {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: none; cursor: pointer; color: white;
  transition: transform 0.1s;
}
.action-btn:active { transform: scale(0.9); }
.btn-play-teacher { background: #3b82f6; }
.btn-play-student { background: #10b981; }
.btn-play-student:disabled { background: #cbd5e1; }

/* 录音按钮 */
.record-btn-wrapper { display: flex; justify-content: center; margin-top: 6px; }
.record-btn {
  width: 64px; height: 64px; border-radius: 50%;
  background: #ef4444; color: white; font-size: 1.6rem;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
  transition: all 0.2s; border: none;
}
.record-btn.recording { 
  background: #fff; border: 4px solid #ef4444; color: #ef4444;
  animation: pulse 1.5s infinite;
}
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }

/* 底部完成按钮 */
.finish-bar {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 20px 20px 60px; /* 进一步提高位置，防止被手机底部条遮挡 */
  background: linear-gradient(to top, #f8fafc 80%, rgba(248, 250, 252, 0));
  display: flex; justify-content: center; pointer-events: none;
}
.finish-btn {
  pointer-events: auto;
  background: #1e293b; color: white;
  padding: 16px 80px; border-radius: 100px;
  font-size: 1.15rem; font-weight: 700;
  box-shadow: 0 6px 20px rgba(30, 41, 59, 0.3);
  border: none; display: flex; align-items: center; gap: 8px;
}
`;

// =================================================================================
// 3. 组件逻辑
// =================================================================================
const WordStudy = ({ data, onNext }) => {
  const { title, words } = data.content || {};
  const [activeWordId, setActiveWordId] = useState(null);
  
  // 录音状态
  const [isRecording, setIsRecording] = useState(false);
  const [studentAudioUrl, setStudentAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const activeWord = words?.find(w => w.id === activeWordId);

  // 打开弹窗时，自动播放老师读音，并重置录音
  useEffect(() => {
    if (activeWord) {
      audioController.play(activeWord.word);
      setStudentAudioUrl(null);
      setIsRecording(false);
    }
  }, [activeWord]);

  // 开始/停止录音逻辑
  const toggleRecording = async () => {
    if (isRecording) {
      // 停止录音
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      // 开始录音
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        chunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (e) => {
          chunksRef.current.push(e.data);
        };

        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setStudentAudioUrl(url);
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
      } catch (err) {
        alert("无法访问麦克风，请检查权限。");
        console.error(err);
      }
    }
  };

  const playStudentAudio = () => {
    if (studentAudioUrl) {
      new Audio(studentAudioUrl).play();
    }
  };

  return (
    <div className="ws-container">
      <style>{styles}</style>

      {/* 头部：老师引导 */}
      <div className="ws-header">
        <div className="scene-wrapper">
          <img 
            src="https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/1765952194374.png" 
            className="teacher-img" 
            alt="Teacher" 
          />
          <div className="bubble-box">
            <div className="bubble-tail" />
            <div className="font-bold text-slate-700 text-lg mb-1">{title}</div>
            <div className="text-slate-500 text-sm">点击卡片学习，对比你的发音。</div>
          </div>
        </div>
      </div>

      {/* 单词网格列表 (使用 pinyin-pro 动态生成) */}
      <div className="ws-scroll-area">
        {words?.map((item) => {
          // 自动生成拼音
          const py = pinyin(item.word, { toneType: 'mark' });
          return (
            <div key={item.id} className="mini-card" onClick={() => setActiveWordId(item.id)}>
              <div className="mini-char">{item.word}</div>
              <div className="mini-pinyin">{py}</div>
            </div>
          );
        })}
      </div>

      {/* 底部完成按钮 */}
      <div className="finish-bar">
        <button className="finish-btn" onClick={onNext}>
          我学会了 <FaArrowRight />
        </button>
      </div>

      {/* === 核心功能：中间弹窗 + 录音对比 === */}
      {activeWord && (
        <div className="modal-overlay" onClick={() => setActiveWordId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setActiveWordId(null)}>
              <FaTimes />
            </button>

            {/* 大字展示 */}
            <div className="big-char">{activeWord.word}</div>
            {/* 实时生成大拼音 */}
            <div className="big-pinyin">
                {pinyin(activeWord.word, { toneType: 'mark' })}
            </div>
            
            {/* 释义 */}
            <div className="definition-row">
              <div className="font-bold">{activeWord.definition}</div>
              <div className="burmese-sub">{activeWord.burmese}</div>
            </div>

            {/* 例句 (支持多句) */}
            <div className="examples-container">
              {activeWord.examples?.map((ex, idx) => (
                 <div key={idx} className="example-item">
                   <div className="flex items-start justify-between">
                     <div>
                        <div className="ex-zh">{ex.zh}</div>
                        <div className="ex-my">{ex.my}</div>
                     </div>
                     <button 
                       className="play-ex-btn"
                       onClick={() => audioController.play(ex.zh)}
                     >
                       <FaVolumeUp size={14} />
                     </button>
                   </div>
                 </div>
              ))}
            </div>

            {/* 录音对比区 */}
            <div className="record-section">
              {/* 老师行 */}
              <div className="compare-row">
                <div className="compare-label text-blue-600">
                   <FaCheckCircle /> 老师示范 (Teacher)
                </div>
                <button className="action-btn btn-play-teacher" onClick={() => audioController.play(activeWord.word)}>
                  <FaVolumeUp />
                </button>
              </div>

              {/* 录音按钮 (居中大按钮) */}
              <div className="record-btn-wrapper">
                <button 
                  className={`record-btn ${isRecording ? 'recording' : ''}`} 
                  onClick={toggleRecording}
                >
                  {isRecording ? <FaStop /> : <FaMicrophone />}
                </button>
              </div>
              <div className="text-center text-xs text-slate-400 font-bold mb-2">
                {isRecording ? "正在录音... (Recording)" : "点击录音 (Tap to Record)"}
              </div>

              {/* 学生行 */}
              <div className="compare-row">
                <div className="compare-label text-emerald-600">
                   <FaMicrophone /> 我的发音 (My Voice)
                </div>
                <button 
                  className="action-btn btn-play-student" 
                  disabled={!studentAudioUrl}
                  onClick={playStudentAudio}
                >
                  <FaPlay />
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default WordStudy;
