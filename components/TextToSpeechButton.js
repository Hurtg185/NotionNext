// /components/TextToSpeechButton.js - 晓辰专用版，图标与语速已修正
import React, { useState, useRef, useCallback } from 'react';

const TextToSpeechButton = ({ text, className = '' }) => {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);

  const synthesizeSpeech = useCallback(async (textToSpeak) => {
    if (!textToSpeak || textToSpeak.trim() === '') return;
    setIsLoading(true);

    const encodedText = encodeURIComponent(textToSpeak);
    
    // 关键修正：将语速参数的 '%' 编码为 '%25'，并设定为 -30% 以获得更慢的语速
    const rate = '-30%25'; 
    const pitch = '0%25'; // 同样修正音高参数的编码

    const url = `https://t.leftsite.cn/tts?t=${encodedText}&v=zh-CN-XiaochenMultilingualNeural&r=${rate}&p=${pitch}&o=audio-24khz-48kbitrate-mono-mp3`;
    
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = ''; // 停止并释放旧的音频
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error(`API Error`);
      
      const audioBlob = await response.blob();
      if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // 监听音频播放结束事件，以确保 loading 状态正确切换
      audio.onended = () => {
        setIsLoading(false);
      };

      await audio.play();
      // 注意：如果网络很快，play() 之后的 setIsLoading(false) 可能会在音频播放结束前执行。
      // 因此，我们将 setIsLoading(false) 移到 onended 事件中。

    } catch (err) {
      console.error('朗读失败:', err);
      setIsLoading(false); // 发生错误时也要停止 loading
    }
  }, []);

  return (
    <div 
      onClick={(e) => {
        e.stopPropagation(); // 阻止事件冒泡，非常重要！
        synthesizeSpeech(text);
      }}
      className={`inline-block ${className}`} // 将 className 移到外层 div，以便更好地控制样式
    >
      <button
        disabled={isLoading}
        className={`tts-button w-full h-full inline-flex items-center justify-center transition-all duration-200 disabled:cursor-not-allowed`}
        aria-label={`朗读: ${text}`}
      >
        {isLoading ? (
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        ) : (
          // 关键修正：替换为 Font Awesome 图标
          <i className="fa-solid fa-volume-high text-xl"></i>
        )}
      </button>
    </div>
  );
};

export default TextToSpeechButton;
