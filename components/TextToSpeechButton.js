// TextToSpeechButton.js
import React, { useState, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeHigh } from '@fortawesome/free-solid-svg-icons';

const TextToSpeechButton = ({ text, className = '' }) => {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);

  const synthesizeSpeech = useCallback(async (textToSpeak) => {
    if (!textToSpeak || textToSpeak.trim() === '') return;
    setIsLoading(true);

    const encodedText = encodeURIComponent(textToSpeak);
    const url = `https://t.leftsite.cn/tts?t=${encodedText}&v=zh-CN-XiaochenMultilingualNeural&r=-20%&p=0%&o=audio-24khz-48kbitrate-mono-mp3`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`API Error`);

      const audioBlob = await response.blob();
      if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      await audio.play();
    } catch (err) {
      console.error('朗读失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        synthesizeSpeech(text);
      }}
      className="inline-block"
    >
      <button
        disabled={isLoading}
        className={`tts-button inline-flex items-center justify-center rounded-full w-8 h-8 sm:w-10 sm:h-10 text-white shadow-sm transition-all duration-200 ${
          isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
        } ${className}`}
        aria-label={`朗读: ${text}`}
      >
        {isLoading ? (
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <FontAwesomeIcon
            icon={faVolumeHigh}
            className="no-background"
            style={{ fontSize: '1.2rem' }}
          />
        )}
      </button>
    </div>
  );
};

export default TextToSpeechButton;
