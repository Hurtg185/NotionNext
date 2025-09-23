// components/AiTtsButton.js (已修正文本处理逻辑)

import React, { useState, useRef, useCallback, useEffect } from 'react';

// --- 发音人数据已内置 ---
export const MICROSOFT_TTS_VOICES = [
  { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' },
  { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' },
  { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' },
  // ... 其他 voice 数据保持不变
];

// --- [核心修改] 我们将不再使用复杂的文本清理函数 ---
// 它在某些情况下可能会导致问题。
// 相反，我们只做一个最基本的检查。
/* 
const cleanTextForSpeech = (text) => { ... }; // 已移除
*/

const AiTtsButton = ({ 
  text, 
  voice = 'zh-CN-XiaoxiaoMultilingualNeural', 
  rate = 0,
  pitch = 0
}) => {
  const [playbackState, setPlaybackState] = useState('idle');
  const audioRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src?.startsWith('blob:')) URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, []);

  const startPlayback = useCallback(async (textToSpeak) => {
    if (playbackState === 'playing') {
      audioRef.current?.pause();
      return;
    }
    if (playbackState === 'paused') {
      audioRef.current?.play();
      return;
    }

    // --- [核心修改] ---
    // 移除了 cleanTextForSpeech 函数调用，只进行简单的非空检查
    const finalText = textToSpeak?.trim();
    if (!finalText) {
      console.warn("朗读文本为空，已取消请求。");
      return;
    }
    // --- 修改结束 ---

    setPlaybackState('loading');
    abortControllerRef.current = new AbortController();

    try {
      const params = new URLSearchParams({
        t: finalText, // 使用原始（但去除了首尾空格）的文本
        v: voice,
        r: `${rate}%`,
        p: `${pitch}%`
      });
      const url = `https://t.leftsite.cn/tts?${params.toString()}`;

      const response = await fetch(url, { 
        method: 'GET',
        signal: abortControllerRef.current.signal 
      });

      if (!response.ok) {
        // 尝试解析错误信息，以便更清晰地展示
        let errorBody = '无法获取详细错误信息。';
        try {
            errorBody = await response.text();
        } catch (e) {}
        throw new Error(`API 请求失败, 状态码: ${response.status}. 响应内容: ${errorBody}`);
      }
      
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      
      if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onplay = () => setPlaybackState('playing');
      audio.onpause = () => { if (audio.currentTime < audio.duration) setPlaybackState('paused'); };
      audio.onended = () => setPlaybackState('idle');
      audio.onerror = (e) => { console.error('音频播放错误:', e); setPlaybackState('idle'); };

      await audio.play();

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('语音合成失败:', err);
        alert(`语音合成失败: ${err.message}`);
      }
      setPlaybackState('idle');
    }
  }, [voice, rate, pitch, playbackState]);

  // --- 动画图标组件 (保持不变) ---
  const AnimatedMusicIcon = ({ state }) => {
    // ... (这部分代码无需修改) ...
    const barStyle = (animationDelay) => ({ animation: state === 'playing' ? `sound-wave 1.2s ease-in-out ${animationDelay} infinite alternate` : 'none' });
    return (
      <div className="relative w-6 h-6 flex items-center justify-center">
        <div className={`absolute transition-opacity duration-300 ${state === 'loading' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
           <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>
        <div className={`absolute transition-opacity duration-300 ${state === 'idle' || state === 'paused' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5 L18 12 L8 19z" /></svg>
        </div>
        <div className={`absolute transition-opacity duration-300 ${state === 'playing' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
           <div className="flex items-end justify-center w-6 h-6 gap-0.5">
             <span className="w-1 h-2 bg-current rounded-full" style={barStyle('0s')}></span>
             <span className="w-1 h-4 bg-current rounded-full" style={barStyle('0.2s')}></span>
             <span className="w-1 h-5 bg-current rounded-full" style={barStyle('0.4s')}></span>
             <span className="w-1 h-3 bg-current rounded-full" style={barStyle('0.6s')}></span>
           </div>
        </div>
        <style jsx>{` @keyframes sound-wave { 0% { transform: scaleY(0.2); } 100% { transform: scaleY(1); } } `}</style>
      </div>
    );
  };
  
  return (
    <button
      onClick={(e) => { e.stopPropagation(); startPlayback(text); }}
      disabled={playbackState === 'loading'}
      className="p-2 rounded-full transition-colors duration-200 transform active:scale-90 hover:bg-black/10 text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
      title={playbackState === 'playing' ? "暂停" : "朗读"}
    >
      <AnimatedMusicIcon state={playbackState} />
    </button>
  );
};

export default AiTtsButton;
