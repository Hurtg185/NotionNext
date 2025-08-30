// /components/TextToSpeechButton.js - 只使用第三方 API (晓辰) 的稳定版本
import React, { useState, useRef, useCallback } from 'react';

const TextToSpeechButton = ({
  text,
  lang = 'zh-CN', // 实际未使用，但保留 prop 兼容性
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);

  const apiConfig = {
    apiBaseUrl: 'https://t.leftsite.cn',
    voice: 'zh-CN-XiaochenMultilingualNeural',
    rate: '-20%',
    pitch: '0%',
    outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
  };

  const synthesizeSpeech = useCallback(async (textToSpeak) => {
    if (!textToSpeak || textToSpeak.trim() === '') return;

    setIsLoading(true);
    setError(null);

    const encodedText = encodeURIComponent(textToSpeak);
    const url = `${apiConfig.apiBaseUrl}/tts?t=${encodedText}&v=${apiConfig.voice}&r=${apiConfig.rate}&p=${apiConfig.pitch}&o=${apiConfig.outputFormat}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`API 错误 (状态码: ${response.status})`);
      
      const audioBlob = await response.blob();
      if (audioRef.current && audioRef.current.src) URL.revokeObjectURL(audioRef.current.src);
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      await audio.play();
    } catch (err) {
      console.error('朗读失败:', err);
      setError(`朗读失败: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation(); // 阻止事件冒泡
        synthesizeSpeech(text);
      }}
      disabled={isLoading}
      className={`tts-button inline-flex items-center justify-center rounded-full w-8 h-8 sm:w-10 sm:h-10 text-white shadow-sm transition-all duration-200 ${
        isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
      } ${className}`}
      aria-label={`朗读: ${text}`}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
      )}
      {error && <span className="sr-only">错误: {error}</span>}
    </button>
  );
};

export default TextToSpeechButton;
