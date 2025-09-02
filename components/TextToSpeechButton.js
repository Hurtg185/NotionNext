// /components/TextToSpeechButton.js - 在您提供的代码基础上进行精准修正
import React, { useState, useRef, useCallback } from 'react';

const TextToSpeechButton = ({ text, className = '' }) => {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);

  const synthesizeSpeech = useCallback(async (textToSpeak) => {
    if (!textToSpeak || textToSpeak.trim() === '') return;
    setIsLoading(true);

    const encodedText = encodeURIComponent(textToSpeak);
    
    // 修正 1：将语速参数的 '%' 正确编码为 '%25'，并设定为 -30% 以获得更慢的语速
    const rate = '-30%25'; 
    const pitch = '0%25';

    const url = `https://t.leftsite.cn/tts?t=${encodedText}&v=zh-CN-XiaochenMultilingualNeural&r=${rate}&p=${pitch}&o=audio-24khz-48kbitrate-mono-mp3`;
    
    try {
      if (audioRef.current) {
        audioRef.current.pause(); // 停止任何可能正在播放的音频
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error(`API Error`);
      
      const audioBlob = await response.blob();
      if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // 修正 2：使用 onended 事件来确保音频播放结束后才停止 loading 状态
      audio.onended = () => {
        setIsLoading(false);
      };
      audio.onerror = () => {
        console.error('音频播放失败');
        setIsLoading(false);
      };

      await audio.play();
      // 注意：原有的 finally 块已被移除，因为它的逻辑现在由 onended 和 onerror 更精确地处理

    } catch (err) {
      console.error('朗读失败:', err);
      setIsLoading(false); // 如果在 fetch 阶段就失败了，也要停止 loading
    }
  }, []);

  return (
    <div 
      onClick={(e) => {
        e.stopPropagation(); // 阻止事件冒泡，非常重要！
        synthesizeSpeech(text);
      }}
      className={`inline-block ${className}`} // 将 className 移到外层，以便 BeiDanCi 控制尺寸和位置
    >
      <button
        disabled={isLoading}
        className={`tts-button w-full h-full inline-flex items-center justify-center rounded-full text-white shadow-sm transition-all duration-200 ${
          isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
        }`}
        aria-label={`朗读: ${text}`}
      >
        {isLoading ? (
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        ) : (
          // 修正 3：将图标替换为您指定的 Font Awesome 图标
          <i className="fa-solid fa-volume-high text-xl"></i>
        )}
      </button>
    </div>
  );
};

export default TextToSpeechButton;
