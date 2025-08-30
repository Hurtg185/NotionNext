// /components/AiTtsButton.js - v14: 支持第三方API和系统内置TTS双引擎
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TTS_ENGINE } from './AiChatAssistant'; // 从主组件导入引擎类型

const cleanTextForSpeech = (text) => { /* ... (保持不变) ... */ };

const AiTtsButton = ({ text, ttsSettings = {} }) => {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null); // 用于第三方API的Audio对象
  const utteranceRef = useRef(null); // 用于系统TTS的Utterance对象

  // 当组件卸载时，停止任何正在播放的语音
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const synthesizeSpeech = useCallback(async (textToSpeak) => {
    const {
      ttsEngine = TTS_ENGINE.THIRD_PARTY,
      thirdPartyTtsVoice = 'zh-CN-XiaochenMultilingualNeural',
      systemTtsVoiceURI = ''
    } = ttsSettings;
    
    const cleanedText = cleanTextForSpeech(textToSpeak);
    if (!cleanedText) return;

    setIsLoading(true);

    // 停止之前可能在播放的语音
    window.speechSynthesis.cancel();
    if (audioRef.current) audioRef.current.pause();

    try {
      // 逻辑分支：根据选择的引擎执行不同操作
      if (ttsEngine === TTS_ENGINE.SYSTEM && 'speechSynthesis' in window) {
        // --- 使用系统内置 TTS ---
        const utterance = new SpeechSynthesisUtterance(cleanedText);
        
        // 如果用户在设置中选择了特定的声音，则使用它
        if (systemTtsVoiceURI) {
          const selectedVoice = window.speechSynthesis.getVoices().find(v => v.voiceURI === systemTtsVoiceURI);
          if (selectedVoice) {
            utterance.voice = selectedVoice;
            utterance.lang = selectedVoice.lang; // 使用声音自带的语言代码
          }
        }
        
        utterance.onend = () => setIsLoading(false);
        utterance.onerror = (e) => {
          console.error('系统TTS错误:', e);
          setIsLoading(false);
        };
        
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);

      } else {
        // --- 使用第三方 API ---
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanedText)}&v=${thirdPartyTtsVoice}&r=-20%&p=0%&o=audio-24khz-48kbitrate-mono-mp3`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API错误 (状态码: ${response.status})`);
        
        const audioBlob = await response.blob();
        if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
        
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => setIsLoading(false);
        audio.onerror = () => {
          console.error('音频播放错误');
          setIsLoading(false);
        };
        await audio.play();
      }
    } catch (err) {
      console.error('朗读失败:', err);
      setIsLoading(false);
    }
  }, [ttsSettings]);

  // ... (返回的 JSX 按钮部分保持不变) ...
};

export default AiTtsButton;
