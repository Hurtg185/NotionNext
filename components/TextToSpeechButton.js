// /components/TextToSpeechButton.js - v2 (UI升级 + 朗读规则同步版)
import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * [新增] 同步高级朗读规则
 * @param {string} text - 原始文本
 * @returns {string} - 清理后的文本
 */
const cleanTextForSpeech = (text) => {
  if (!text) return '';
  let cleaned = text;
  cleaned = cleaned.replace(/【.*?】|\[.*?\]/g, '');
  cleaned = cleaned.replace(/\b[a-zA-ZüÜ]+[1-5]\b\s*/g, '');
  cleaned = cleaned.replace(/\*\*/g, '').replace(/#{1,6}\s/g, '').replace(/[-*]\s/g, '');
  const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
  cleaned = cleaned.replace(emojiRegex, '');
  cleaned = cleaned.replace(/[()]/g, ' ');
  return cleaned.replace(/\s+/g, ' ').trim();
};


const TextToSpeechButton = ({ text, className = '' }) => {
  const [playbackState, setPlaybackState] = useState('idle'); // idle, loading, playing, paused
  const audioRef = useRef(null);

  // 组件卸载时停止播放并清理
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src);
        }
      }
    };
  }, []);

  const synthesizeSpeech = useCallback(async (textToSpeak) => {
    const cleanedText = cleanTextForSpeech(textToSpeak);
    if (!cleanedText) return;
    
    setPlaybackState('loading');
    
    const encodedText = encodeURIComponent(cleanedText);
    const url = `https://t.leftsite.cn/tts?t=${encodedText}&v=zh-CN-XiaochenMultilingualNeural&r=-30&p=0%&o=audio-24khz-48kbitrate-mono-mp3`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`API Error`);
      
      const audioBlob = await response.blob();
      if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => setPlaybackState('playing');
      audio.onpause = () => setPlaybackState('paused');
      audio.onended = () => setPlaybackState('idle');
      audio.onerror = () => { console.error('音频播放错误'); setPlaybackState('idle'); };

      await audio.play();
    } catch (err) {
      console.error('朗读失败:', err);
      setPlaybackState('idle');
    }
  }, []);

  const handleTogglePlayback = (e) => {
    e.stopPropagation(); // 阻止事件冒泡
    switch (playbackState) {
      case 'idle':
        synthesizeSpeech(text);
        break;
      case 'playing':
        if (audioRef.current) audioRef.current.pause();
        break;
      case 'paused':
        if (audioRef.current) audioRef.current.play();
        break;
      default:
        break;
    }
  };
  
  const renderIcon = () => {
    switch (playbackState) {
      case 'loading':
        return (
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case 'playing':
        // 暂停图标
        return <i className="fas fa-pause w-5 h-5 flex items-center justify-center"></i>;
      case 'paused':
      case 'idle':
      default:
        // 带有超声波的扬声器图标
        return <i className="fas fa-volume-up w-5 h-5 flex items-center justify-center"></i>;
    }
  };

  return (
    <button
      onClick={handleTogglePlayback}
      disabled={playbackState === 'loading'}
      // [核心修改] 无背景，优雅蓝灰色图标
      className={`inline-flex items-center justify-center p-2 rounded-full transition-all duration-200 transform active:scale-90 
        ${playbackState === 'loading' ? 'text-gray-400 cursor-not-allowed' : 'text-sky-600 hover:bg-sky-600/10'} 
        ${className}`}
      aria-label={`朗读: ${text}`}
    >
      {renderIcon()}
    </button>
  );
};

export default TextToSpeechButton;
