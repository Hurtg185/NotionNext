// /components/AiTtsButton.js - 修复 Gemini TTS 调用，增加文本清洗
import React, { useState, useRef, useCallback } from 'react';

export const TTS_ENGINE = {
  GEMINI_TTS: 'gemini-tts-1',
  EXTERNAL_API: 'external_api'
};

const AiTtsButton = ({ text, apiKey, ttsSettings = {} }) => {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);

  const synthesizeSpeech = useCallback(async (textToSpeak) => {
    if (!textToSpeak || textToSpeak.trim() === '' || !apiKey) return;
    setIsLoading(true);

    // 清洗文本，移除 Markdown 符号
    const cleanedText = textToSpeak.replace(/\*\*/g, '').replace(/^- /gm, '');

    const {
      ttsEngine = TTS_ENGINE.GEMINI_TTS,
      ttsVoice = 'Zephyr',
    } = ttsSettings;

    try {
      let audioBlob;
      if (ttsEngine === TTS_ENGINE.GEMINI_TTS) {
        // *** 关键修复：使用正确的 Google Cloud Text-to-Speech API 端点和请求体 ***
        const url = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`;
        const body = {
          input: { text: cleanedText },
          voice: {
            languageCode: 'zh-CN', // Gemini TTS 自动识别多语言，但指定中文可以提高准确性
            name: `projects/-/locations/global/models/${ttsVoice}`, // 关键：这是 Gemini TTS 发音人的正确格式
          },
          audioConfig: { audioEncoding: 'MP3' }
        };
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!response.ok) { const data = await response.json(); throw new Error(`Gemini TTS Error: ${data.error?.message || response.statusText}`); }
        const data = await response.json();
        if (!data.audioContent) throw new Error('Gemini TTS 未返回音频内容。');
        const binaryString = window.atob(data.audioContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        audioBlob = new Blob([bytes.buffer], { type: 'audio/mpeg' });
      } else { // 外部 API (晓辰)
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanedText)}&v=zh-CN-XiaochenMultilingualNeural&r=-20%&p=0%&o=audio-24khz-48kbitrate-mono-mp3`;
        const response = await fetch(url);
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
      className={`tts-button p-2 rounded-full transition-colors ${isLoading ? 'text-gray-400' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
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
