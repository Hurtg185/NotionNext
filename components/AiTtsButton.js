// /components/AiTtsButton.js - 专用于 Gemini TTS 的朗读按钮
import React, { useState, useRef, useCallback } from 'react';

// Gemini TTS 引擎
export const TTS_ENGINE_GEMINI = 'gemini-tts-1';

const AiTtsButton = ({ text, apiKey, ttsSettings = {}, className = '' }) => {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);

  const synthesizeSpeech = useCallback(async (textToSpeak) => {
    if (!textToSpeak || textToSpeak.trim() === '' || !apiKey) return;
    setIsLoading(true);

    const {
      ttsEngine = TTS_ENGINE_GEMINI,
      ttsVoice = 'Zephyr',
    } = ttsSettings;

    try {
      let audioBlob;
      if (ttsEngine === TTS_ENGINE_GEMINI) {
        // Gemini TTS API (这是一个假设的端点，实际端点可能需要根据官方文档调整)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${ttsEngine}:synthesizeSpeech?key=${apiKey}`;
        const body = {
          input: { text: textToSpeak },
          voice: { name: ttsVoice },
          audioConfig: { audioEncoding: 'MP3' }
        };
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!response.ok) { const data = await response.json(); throw new Error(`Gemini TTS: ${data.error?.message || response.statusText}`); }
        const data = await response.json();
        if (!data.audioContent) throw new Error('Gemini TTS 未返回音频内容。');
        const binaryString = window.atob(data.audioContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        audioBlob = new Blob([bytes.buffer], { type: 'audio/mpeg' });
      } else {
        // 可以保留对旧 API 的兼容
        const externalUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(textToSpeak)}&v=zh-CN-XiaochenMultilingualNeural&r=-20%&p=0%&o=audio-24khz-48kbitrate-mono-mp3`;
        const response = await fetch(externalUrl);
        if (!response.ok) throw new Error(`外部 TTS API 错误 (状态码: ${response.status})`);
        audioBlob = await response.blob();
      }
      
      if (audioBlob) {
        if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        await audio.play();
      }
    } catch (err) {
      console.error('朗读失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, ttsSettings]);

  return (
    <button
      onClick={(e) => {
          e.stopPropagation();
          synthesizeSpeech(text);
      }}
      disabled={isLoading}
      className={`p-2 rounded-full transition-colors ${isLoading ? 'text-gray-400' : 'hover:bg-black/10 dark:hover:bg-white/10'} ${className}`}
      aria-label={`朗读`}
    >
      {isLoading ? (
        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      ) : (
        <i className="fas fa-volume-up"></i>
      )}
    </button>
  );
};

export default AiTtsButton;
