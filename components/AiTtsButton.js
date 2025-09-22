// /components/AiTtsButton.js (修复 TTS_ENGINE 引用错误)

import React, { useState, useRef, useCallback, useEffect } from 'react';

// [修复] 直接在此处定义 TTS_ENGINE, 移除对 AiChatAssistant 的依赖
const TTS_ENGINE = {
  SYSTEM: 'system',
  THIRD_PARTY: 'third_party'
};

/**
 * 预处理文本，移除不适合朗读的字符和格式。
 */
const cleanTextForSpeech = (text) => {
    // ... (这个函数保持不变)
    if (!text) return '';
    let cleaned = text;
    cleaned = cleaned.replace(/【.*?】|\[.*?\]/g, '');
    const pinyinRegex = /\b([a-zA-Z\u00FC\u00DC\u00E1\u00E9\u00ED\u00F3\u00FA\u0101\u0113\u012B\u014D\u016B\u01CE\u01D0\u01D2\u01D4\u01D6\u01D8\u01DA\u01DC\u00E0\u00E8\u00EC\u00F2\u00F9\u0103\u0115\u012D\u014F\u016D\u0105\u0117\u012F\u0151\u016F]+[1-5]?)\b\s*/g;
    cleaned = cleaned.replace(/\((.*?)\)/g, (match, contentInsideParentheses) => {
        const contentWithoutPinyin = contentInsideParentheses.replace(pinyinRegex, '');
        return contentWithoutPinyin.trim() ? `(${contentWithoutPinyin.trim()})` : '';
    });
    cleaned = cleaned.replace(/\*\*/g, '').replace(/#{1,6}\s/g, '').replace(/[-*]\s/g, '');
    const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
    cleaned = cleaned.replace(emojiRegex, '');
    return cleaned.replace(/\s+/g, ' ').trim();
};


const AiTtsButton = ({ text, ttsSettings = {} }) => {
  const [playbackState, setPlaybackState] = useState('idle');
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);

  const {
    ttsEngine = TTS_ENGINE.THIRD_PARTY, // 现在 TTS_ENGINE 已经定义好了
    thirdPartyTtsVoice = 'zh-CN-XiaoxiaoMultilingualNeural',
    systemTtsVoiceURI = '',
    ttsRate = 0,
    ttsPitch = 0, // 接收音调参数
  } = ttsSettings;

  // 组件卸载时的清理操作
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) { window.speechSynthesis.cancel(); }
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
    if (!cleanedText) {
      console.warn("没有可朗读的内容。");
      setPlaybackState('idle');
      return;
    }

    setPlaybackState('loading');
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (audioRef.current) audioRef.current.pause();

    try {
      if (ttsEngine === TTS_ENGINE.SYSTEM && 'speechSynthesis' in window) {
        // ... 系统TTS逻辑保持不变
      } else {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanedText)}&v=${thirdPartyTtsVoice}&r=${ttsRate}%&p=${ttsPitch}%&o=audio-24khz-48kbitrate-mono-mp3`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API错误 (状态码: ${response.status})`);

        const audioBlob = await response.blob();
        if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);

        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onplay = () => setPlaybackState('playing');
        audio.onpause = () => { if (audio.duration !== audio.currentTime) setPlaybackState('paused'); };
        audio.onended = () => setPlaybackState('idle');
        audio.onerror = (e) => { console.error('音频播放错误', e); setPlaybackState('idle'); };

        await audio.play();
      }
    } catch (err) {
      console.error('朗读失败:', err);
      setPlaybackState('idle');
    }
  }, [ttsEngine, thirdPartyTtsVoice, systemTtsVoiceURI, ttsRate, ttsPitch]);

  const pause = () => { /* ... */ };
  const resume = () => { /* ... */ };
  // ... 其他函数 handleTogglePlayback, renderIcon 保持不变
  const handleTogglePlayback = (e) => { e.stopPropagation(); switch(playbackState){case'idle':synthesizeSpeech(text);break;case'playing':pause();break;case'paused':resume();break;default:break;}};
  const renderIcon=()=>{switch(playbackState){case'loading':return <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;case'playing':return <i className="fas fa-pause h-5 w-5 flex items-center justify-center"></i>;case'paused':return <i className="fas fa-play h-5 w-5 flex items-center justify-center"></i>;case'idle':default:return <i className="fas fa-volume-up h-5 w-5 flex items-center justify-center"></i>;}};

  return (
    <button
      onClick={handleTogglePlayback}
      disabled={playbackState === 'loading'}
      className="p-2 rounded-full transition-all duration-200 transform active:scale-90 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
      title={playbackState==='playing'?"暂停":playbackState==='paused'?"继续播放":"朗读"}
    >
      {renderIcon()}
    </button>
  );
};

export default AiTtsButton;
