// /components/AiTtsButton.js - v23 最终版
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
      // 修复：更新默认值为非HD版本
      thirdPartyTtsVoice = 'zh-CN-XiaoxiaoMultilingualNeural', 
      systemTtsVoiceURI = ''
    } = ttsSettings;
    
    const cleanedText = cleanTextForSpeech(textToSpeak);
    if (!cleanedText) return;

    setIsLoading(true);

    window.speechSynthesis.cancel();
    if (audioRef.current) audioRef.current.pause();

    try {
      if (ttsEngine === TTS_ENGINE.SYSTEM && 'speechSynthesis' in window) {
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
