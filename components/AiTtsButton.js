// /components/AiTtsButton.js - v64 (现代化样式 + 精准朗读规则版)
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TTS_ENGINE } from './AiChatAssistant'; // 从主组件导入引擎类型

/**
 * [核心修改] 更新文本清理规则
 * @param {string} text - 原始文本
 * @returns {string} - 清理后的文本
 */
const cleanTextForSpeech = (text) => {
  if (!text) return '';
  // 移除 Markdown 格式
  let cleaned = text.replace(/\*\*/g, '').replace(/#{1,6}\s/g, '').replace(/[-*]\s/g, '');
  
  // [朗读规则] 移除【】及其内容、拼音
  cleaned = cleaned.replace(/【.*?】|\[.*?\]/g, ''); 
  cleaned = cleaned.replace(/\b[a-zA-ZüÜ]+[1-5]\b\s*/g, '');

  // 移除 Emoji (保留，因为不希望朗读表情)
  const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
  cleaned = cleaned.replace(emojiRegex, '');

  return cleaned.trim();
};

const AiTtsButton = ({ text, ttsSettings = {} }) => {
  const [playbackState, setPlaybackState] = useState('idle');
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);
  
  const {
    ttsEngine = TTS_ENGINE.THIRD_PARTY,
    thirdPartyTtsVoice = 'zh-CN-XiaoxiaoMultilingualNeural',
    systemTtsVoiceURI = ''
  } = ttsSettings;

  // 组件卸载时的清理函数
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src);
        }
      }
    };
  }, []);

  const synthesizeSpeech = useCallback(async (textToSpeak) => {
    const cleanedText = cleanTextForSpeech(textToSpeak);
    if (!cleanedText) return;

    setPlaybackState('loading');
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
        utterance.onend = () => setPlaybackState('idle');
        utterance.onerror = (e) => { console.error('系统TTS错误:', e); setPlaybackState('idle'); };
        utterance.onpause = () => setPlaybackState('paused');
        utterance.onresume = () => setPlaybackState('playing');

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        setPlaybackState('playing');
      } else {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanedText)}&v=${thirdPartyTtsVoice}&r=-20%&&p=0%o=audio-24khz-48kbitrate-mono-mp3`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API错误 (状态码: ${response.status})`);
        
        const audioBlob = await response.blob();
        if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
        
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => setPlaybackState('idle');
        audio.onpause = () => setPlaybackState('paused');
        audio.onplay = () => setPlaybackState('playing');
        audio.onerror = () => { console.error('音频播放错误'); setPlaybackState('idle'); };
        
        await audio.play();
        setPlaybackState('playing');
      }
    } catch (err) {
      console.error('朗读失败:', err);
      setPlaybackState('idle');
    }
  }, [ttsEngine, thirdPartyTtsVoice, systemTtsVoiceURI]);

  const pause = () => {
    if (ttsEngine === TTS_ENGINE.SYSTEM) {
      window.speechSynthesis.pause();
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlaybackState('paused');
  };

  const resume = () => {
    if (ttsEngine === TTS_ENGINE.SYSTEM) {
      window.speechSynthesis.resume();
    } else if (audioRef.current) {
      audioRef.current.play();
    }
    setPlaybackState('playing');
  };

  const handleTogglePlayback = (e) => {
    e.stopPropagation();
    switch (playbackState) {
      case 'idle':
        synthesizeSpeech(text);
        break;
      case 'playing':
        pause();
        break;
      case 'paused':
        resume();
        break;
      default:
        break;
    }
  };
  
  const renderIcon = () => {
    switch (playbackState) {
      case 'loading':
        return (
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case 'playing':
        // [核心修改] 使用更现代的暂停图标
        return <i className="fas fa-pause h-5 w-5 flex items-center justify-center"></i>;
      case 'paused':
      case 'idle':
      default:
        // [核心修改] 使用更现代的播放图标
        return <i className="fas fa-play h-5 w-5 flex items-center justify-center"></i>;
    }
  };

  return (
    <button
      onClick={handleTogglePlayback}
      disabled={playbackState === 'loading'}
      // [核心修改] 现代化的按钮样式
      className={`p-2 rounded-full transition-all duration-200 transform active:scale-90
        ${playbackState === 'loading' ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-black/10 dark:hover:bg-white/10'}
        
        // --- 颜色方案选择 ---
        // 方案一: 优雅蓝灰色 (默认)
        text-sky-600
        
        // 方案二: 沉稳深灰色 (如需使用，请注释掉上面的颜色，并取消下面的注释)
        // text-gray-600
      `}
      title={playbackState === 'playing' ? "暂停" : "朗读"}
    >
      {renderIcon()}
    </button>
  );
};

export default AiTtsButton;
