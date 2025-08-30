// /components/AiTtsButton.js - 专用于 AI 助手的多引擎 TTS 按钮
import React, { useState, useRef, useCallback } from 'react';

export const TTS_ENGINE = {
  GOOGLE_GENAI: 'google_genai',
  EXTERNAL_API: 'external_api',
  SYSTEM_TTS: 'system_tts'
};

const AiTtsButton = ({
  text,
  lang = 'zh-CN',
  apiKey = '',
  ttsSettings = {},
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);

  const synthesizeSpeech = useCallback(async (textToSpeak) => {
    if (!textToSpeak || textToSpeak.trim() === '') return;

    setIsLoading(true);
    setError(null);

    const {
      selectedTtsEngine = TTS_ENGINE.GOOGLE_GENAI,
      googleVoiceName = 'cmn-CN-Wavenet-A',
      googlePitch = 0,
      googleRate = 1,
      externalVoice = 'zh-CN-XiaochenMultilingualNeural',
      externalRate = '-20%',
      externalPitch = '0%'
    } = ttsSettings;

    try {
      let audioBlob;

      if (selectedTtsEngine === TTS_ENGINE.GOOGLE_GENAI) {
        if (!apiKey.trim()) throw new Error('请在设置中提供 Google Gemini API 密钥。');
        const googleTtsUrl = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`;
        const response = await fetch(googleTtsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text: textToSpeak },
            voice: { languageCode: lang, name: googleVoiceName },
            audioConfig: { audioEncoding: 'MP3', speakingRate: googleRate, pitch: googlePitch }
          })
        });
        if (!response.ok) { const data = await response.json(); throw new Error(`Google TTS: ${data.error?.message || response.statusText}`); }
        const data = await response.json();
        if (!data.audioContent) throw new Error('Google TTS 未返回音频内容。');
        const binaryString = window.atob(data.audioContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        audioBlob = new Blob([bytes.buffer], { type: 'audio/mpeg' });
      } else if (selectedTtsEngine === TTS_ENGINE.EXTERNAL_API) {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(textToSpeak)}&v=${externalVoice}&r=${externalRate}&p=${externalPitch}&o=audio-24khz-48kbitrate-mono-mp3`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`外部 TTS API 错误 (状态码: ${response.status})`);
        audioBlob = await response.blob();
      } else {
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(textToSpeak);
          utterance.lang = lang;
          window.speechSynthesis.speak(utterance);
          setIsLoading(false);
          return;
        } else {
          throw new Error('浏览器不支持系统 TTS。');
        }
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
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [text, lang, apiKey, ttsSettings]);

  return (
    <button
      onClick={(e) => {
          e.stopPropagation();
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

export default AiTtsButton;
