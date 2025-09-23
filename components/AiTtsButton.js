// components/AiTtsButton.js (V2 - 增强稳定性)

import React, { useState, useRef, useCallback, useEffect } from 'react';

// --- 发音人数据 (保持不变) ---
export const MICROSOFT_TTS_VOICES = [ /* ... */ ];

const AiTtsButton = ({ 
  text, 
  voice = 'zh-CN-XiaoxiaoMultilingualNeural', 
  rate = 0,
  pitch = 0
}) => {
  const [playbackState, setPlaybackState] = useState('idle');
  const audioRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => { /* ... 清理函数保持不变 ... */ }, []);

  const startPlayback = useCallback(async (textToSpeak) => {
    if (playbackState === 'playing') {
      audioRef.current?.pause();
      return;
    }
    if (playbackState === 'paused') {
      audioRef.current?.play();
      return;
    }

    // ==========================================================
    // [核心修复] 使用更严格的文本检查，防止空请求
    // ==========================================================
    const finalText = typeof textToSpeak === 'string' ? textToSpeak.trim() : '';
    if (!finalText) {
      console.warn("朗读文本为空或格式不正确，已取消请求。", { originalText: textToSpeak });
      alert("无法朗读，因为没有有效的文本内容。");
      setPlaybackState('idle'); // 重置状态
      return;
    }
    // ==========================================================

    setPlaybackState('loading');
    abortControllerRef.current = new AbortController();

    try {
      const params = new URLSearchParams({
        t: finalText,
        v: voice,
        r: `${rate}%`,
        p: `${pitch}%`
      });
      const url = `https://t.leftsite.cn/tts?${params.toString()}`;
      
      const response = await fetch(url, { method: 'GET', signal: abortControllerRef.current.signal });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '无法获取详细错误。');
        throw new Error(`API 请求失败, 状态码: ${response.status}. 响应: ${errorBody}`);
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

  // --- 动画图标和 JSX return 部分 (保持不变) ---
  const AnimatedMusicIcon = ({ state }) => {/* ... */};
  return (
    <button onClick={(e) => { e.stopPropagation(); startPlayback(text); }} disabled={playbackState === 'loading'} /* ... */>
      <AnimatedMusicIcon state={playbackState} />
    </button>
  );
};

export default AiTtsButton;
