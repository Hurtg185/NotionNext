// /components/TextToSpeechButton.js - 最终无背景修正版
import React, { useState, useRef, useCallback } from 'react';

const TextToSpeechButton = ({ text, className = '' }) => {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);

  const synthesizeSpeech = useCallback(async (textToSpeak) => {
    if (!textToSpeak || textToSpeak.trim() === '') return;
    setIsLoading(true);

    const encodedText = encodeURIComponent(textToSpeak);
    const rate = '-30%25'; // 修正：正确编码 % 符号
    const pitch = '0%25';

    const url = `https://t.leftsite.cn/tts?t=${encodedText}&v=zh-CN-XiaochenMultilingualNeural&r=${rate}&p=${pitch}&o=audio-24khz-48kbitrate-mono-mp3`;
    
    try {
      if (audioRef.current) audioRef.current.pause();

      const response = await fetch(url);
      if (!response.ok) throw new Error(`API Error`);
      
      const audioBlob = await response.blob();
      if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => setIsLoading(false);
      audio.onerror = () => {
        console.error('音频播放失败');
        setIsLoading(false);
      };

      await audio.play();

    } catch (err) {
      console.error('朗读失败:', err);
      setIsLoading(false); 
    }
  }, []);

  return (
    <div 
      onClick={(e) => {
        e.stopPropagation(); // 阻止事件冒泡
        synthesizeSpeech(text);
      }}
      className={`inline-flex items-center justify-center cursor-pointer ${className}`} // 修正：让 div 本身成为可点击区域
    >
        {isLoading ? (
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        ) : (
          <i className="fa-solid fa-volume-high text-white/80 hover:text-white transition-colors duration-200"></i>
        )}
    </div>
  );
};

export default TextToSpeechButton;
