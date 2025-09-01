import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TTS_ENGINE } from './AiChatAssistant'; // 从主组件导入引擎类型

/**
 * 清理文本，移除不适合朗读的字符，包括Markdown、括号内的拼音和注释。
 * @param {string} text - 原始文本
 * @returns {string} - 清理后的文本
 */
const cleanTextForSpeech = (text) => {
  if (!text) return '';
  // 移除 Markdown 格式
  let cleaned = text.replace(/\*\*/g, '').replace(/#{1,6}\s/g, '').replace(/[-*]\s/g, '');
  // 移除括号里的拼音或英文注释（同时处理中英文括号）
  cleaned = cleaned.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '');
  // 移除一些可能被误读的符号，可以根据需要添加
  cleaned = cleaned.replace(/[【】]/g, '');
  return cleaned.trim();
};

const AiTtsButton = ({ text, ttsSettings = {} }) => {
  // 使用一个更详细的状态机来管理播放状态：'idle', 'loading', 'playing', 'paused'
  const [playbackState, setPlaybackState] = useState('idle');
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);
  
  // 从 ttsSettings 中解构出引擎类型，方便在组件内使用
  const {
    ttsEngine = TTS_ENGINE.THIRD_PARTY,
    thirdPartyTtsVoice = 'zh-CN-XiaoxiaoMultilingualNeural',
    systemTtsVoiceURI = ''
  } = ttsSettings;

  // 组件卸载时的清理函数
  useEffect(() => {
    return () => {
      // 停止所有语音活动
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        // 如果是 blob URL，需要释放以防内存泄漏
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

    // 停止任何正在进行的朗读
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
        utterance.onerror = (e) => {
          console.error('系统TTS错误:', e);
          setPlaybackState('idle');
        };
        // 监听暂停和恢复事件，以处理从浏览器开发者工具或其他地方触发的暂停/恢复
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
        audio.onerror = () => {
          console.error('音频播放错误');
          setPlaybackState('idle');
        };
        
        await audio.play();
        setPlaybackState('playing'); // 成功开始播放后更新状态
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
    // 注意：状态会由 onpause 事件处理器更新，但为了立即响应UI，也可以在这里设置
    setPlaybackState('paused');
  };

  const resume = () => {
    if (ttsEngine === TTS_ENGINE.SYSTEM) {
      window.speechSynthesis.resume();
    } else if (audioRef.current) {
      audioRef.current.play();
    }
    // 注意：状态会由 onplay/onresume 事件处理器更新
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
      // 在 'loading' 状态下，按钮被禁用，不会触发点击
      default:
        break;
    }
  };
  
  // 根据播放状态决定按钮图标
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
        // 使用暂停图标
        return <i className="fas fa-pause h-5 w-5 flex items-center justify-center"></i>;
      case 'paused':
      case 'idle':
      default:
        // 使用播放图标
        return <i className="fas fa-volume-up h-5 w-5 flex items-center justify-center"></i>;
    }
  };

  return (
    <button
      onClick={handleTogglePlayback}
      disabled={playbackState === 'loading'}
      className={`p-2 rounded-full transition-colors ${playbackState === 'loading' ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
      title={playbackState === 'playing' ? "暂停" : "朗读"}
    >
      {renderIcon()}
    </button>
  );
};

export default AiTtsButton;
