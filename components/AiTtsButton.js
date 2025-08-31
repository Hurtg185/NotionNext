// /components/AiTtsButton.js - v27: 引入新的 Gemini TTS 调用方式
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TTS_ENGINE } from './AiChatAssistant'; // 从主组件导入引擎类型

const cleanTextForSpeech = (text) => {
  if (!text) return '';
  return text.replace(/\*\*/g, '').replace(/#{1,6}\s/g, '').replace(/[-*]\s/g, '');
};

const AiTtsButton = ({ text, ttsSettings = {} }) => {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const synthesizeSpeech = useCallback(async (textToSpeak) => {
    const {
      ttsEngine = TTS_ENGINE.THIRD_PARTY,
      geminiTtsModel = 'models/gemini-2.5-flash-preview-tts', // 新增：Gemini TTS 模型
      geminiTtsVoice = 'Zephyr', // 新增：Gemini TTS 发音人
      thirdPartyTtsVoice = 'zh-CN-XiaoxiaoMultilingualNeural',
      systemTtsVoiceURI = '',
      apiKey = '' // 确保能从 settings 获取 API Key
    } = ttsSettings;
    
    const cleanedText = cleanTextForSpeech(textToSpeak);
    if (!cleanedText) return;

    setIsLoading(true);

    window.speechSynthesis.cancel();
    if (audioRef.current) audioRef.current.pause();

    try {
      if (ttsEngine === TTS_ENGINE.GEMINI_TTS && apiKey) {
        // --- 新的 Gemini TTS 调用逻辑 ---
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiTtsModel}:generateContent?key=${apiKey}`;
        const body = {
          contents: [{
            parts: [{ text: cleanedText }]
          }],
          generationConfig: {
            ttsVoice: geminiTtsVoice,
            responseMimeType: 'audio/mpeg'
          }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Gemini TTS API 错误`);
        }

        const data = await response.json();
        const audioContent = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioContent) throw new Error('Gemini TTS 未能返回音频内容。');
        
        const binaryString = window.atob(audioContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const audioBlob = new Blob([bytes.buffer], { type: 'audio/mpeg' });
        
        if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => setIsLoading(false);
        audio.onerror = () => { console.error('音频播放错误'); setIsLoading(false); };
        await audio.play();

      } else if (ttsEngine === TTS_ENGINE.SYSTEM && 'speechSynthesis' in window) {
        // --- 系统内置 TTS ---
        const utterance = new SpeechSynthesisUtterance(cleanedText);
        if (systemTtsVoiceURI) {
          const selectedVoice = window.speechSynthesis.getVoices().find(v => v.voiceURI === systemTtsVoiceURI);
          if (selectedVoice) {
            utterance.voice = selectedVoice;
            utterance.lang = selectedVoice.lang;
          }
        }
        utterance.onend = () => setIsLoading(false);
        utterance.onerror = (e) => { console.error('系统TTS错误:', e); setIsLoading(false); };
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } else {
        // --- 第三方 API ---
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanedText)}&v=${thirdPartyTtsVoice}&r=-20%&&p=0%o=audio-24khz-48kbitrate-mono-mp3`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API错误 (状态码: ${response.status})`);
        
        const audioBlob = await response.blob();
        if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
        
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => setIsLoading(false);
        audio.onerror = () => { console.error('音频播放错误'); setIsLoading(false); };
        await audio.play();
      }
    } catch (err) {
      console.error('朗读失败:', err);
      setIsLoading(false);
    }
  }, [ttsSettings]);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); synthesizeSpeech(text); }}
      disabled={isLoading}
      className={`p-2 rounded-full transition-colors ${isLoading ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
      title="朗读"
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
