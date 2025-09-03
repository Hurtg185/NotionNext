// /components/AiTtsButton.js - v67 (恢复旧版图标 + 高级朗读规则)
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TTS_ENGINE } from './AiChatAssistant'; // 从主组件导入引擎类型

/**
 * [核心修改] 更新文本清理规则
 * @param {string} text - 原始文本
 * @returns {string} - 清理后的文本
 */
const cleanTextForSpeech = (text) => {
  if (!text) return '';
  
  let cleaned = text;

  // 规则 1: 移除【】或[]及其内部的所有内容
  cleaned = cleaned.replace(/【.*?】|\[.*?\]/g, '');

  // 规则 2: 移除独立的、带有声调数字的拼音
  cleaned = cleaned.replace(/\b[a-zA-ZüÜ]+[1-5]\b\s*/g, '');

  // 规则 3: 移除 Markdown 格式
  cleaned = cleaned.replace(/\*\*/g, '').replace(/#{1,6}\s/g, '').replace(/[-*]\s/g, '');
  
  // 规则 4: 移除 Emoji
  const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
  cleaned = cleaned.replace(emojiRegex, '');

  // 规则 5: 将括号()替换为空格，以保留其内部的文字
  cleaned = cleaned.replace(/[()]/g, ' ');

  // 最后，清理多余的空格并返回
  return cleaned.replace(/\s+/g, ' ').trim();
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
          <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case 'playing':
        // 恢复以前的暂停图标 (音量+静音)
        return <i className="fas fa-volume-mute h-5 w-5 flex items-center justify-center"></i>;
      case 'paused':
      case 'idle':
      default:
        // 恢复以前的播放图标 (音量)
        return <i className="fas fa-volume-up h-5 w-5 flex items-center justify-center"></i>;
    }
  };

  return (
    <button
      onClick={handleTogglePlayback}
      disabled={playbackState === 'loading'}
      className={`p-2 rounded-full transition-colors duration-200 transform active:scale-90 hover:bg-black/10 text-gray-500 disabled:cursor-not-allowed`}
      title={playbackState === 'playing' ? "暂停" : "朗读"}
    >
      {renderIcon()}
    </button>
  );
};

export default AiTtsButton;
