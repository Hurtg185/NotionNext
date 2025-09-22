// /components/AiTtsButton.js - v70 (TTS朗读器生产级组件 - 增加 JSDoc 注释)

import React, { useState, useRef, useCallback, useEffect } from 'react';

// 假设 TTS_ENGINE 从外部导入，例如：
// export const TTS_ENGINE = { SYSTEM: 'system', THIRD_PARTY: 'third_party' };
/**
 * 预处理文本，移除不适合朗读的字符和格式。
 * 规则：
 * 1. 移除【】或[]及其内部的所有内容。
 * 2. 仅移除英文括号()内部的拼音，保留括号外面的拼音。
 * 3. 移除基础的 Markdown 符号。
 * 4. 移除 Emoji 字符。
 * @param {string} text - 原始文本。
 * @returns {string} 清理后用于朗读的文本。
 */
const cleanTextForSpeech = (text) => {
  if (!text) return '';

  let cleaned = text;

  // 规则 1: 全局移除【】或[]及其内部的所有内容
  cleaned = cleaned.replace(/【.*?】|\[.*?\]/g, '');

  // 规则 2: [核心逻辑] 只移除括号()内部的拼音
  const pinyinRegex = /\b([a-zA-Z\u00FC\u00DC\u00E1\u00E9\u00ED\u00F3\u00FA\u0101\u0113\u012B\u014D\u016B\u01CE\u01D0\u01D2\u01D4\u01D6\u01D8\u01DA\u01DC\u00E0\u00E8\u00EC\u00F2\u00F9\u0103\u0115\u012D\u014F\u016D\u0105\u0117\u012F\u0151\u016F]+[1-5]?)\b\s*/g;
  cleaned = cleaned.replace(/\((.*?)\)/g, (match, contentInsideParentheses) => {
    // 创建一个不包含拼音的括号内容
    const contentWithoutPinyin = contentInsideParentheses.replace(pinyinRegex, '');
    // 如果清理后括号内还有内容，则保留括号和内容，否则整个移除
    return contentWithoutPinyin.trim() ? `(${contentWithoutPinyin.trim()})` : '';
  });

  // 规则 3: 移除 Markdown 格式
  cleaned = cleaned.replace(/\*\*/g, '').replace(/#{1,6}\s/g, '').replace(/[-*]\s/g, '');

  // 规则 4: 移除 Emoji
  const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
  cleaned = cleaned.replace(emojiRegex, '');

  // 最后，清理多余的空格并返回
  return cleaned.replace(/\s+/g, ' ').trim();
};

/**
 * @typedef {'idle' | 'loading' | 'playing' | 'paused'} PlaybackState
 */

/**
 * 一个多功能文本转语音（TTS）按钮组件。
 * 支持系统内置 TTS 和第三方 API，可控制播放/暂停，并能自动清理文本。
 *
 * @param {object} props
 * @param {string} props.text - 需要朗读的原始文本。
 * @param {object} [props.ttsSettings={}] - TTS 相关配置。
 * @param {string} [props.ttsSettings.ttsEngine='third_party'] - 使用的 TTS 引擎 ('system' 或 'third_party')。
 * @param {string} [props.ttsSettings.thirdPartyTtsVoice='zh-CN-XiaoxiaoMultilingualNeural'] - 第三方 API 使用的语音模型。
 * @param {string} [props.ttsSettings.systemTtsVoiceURI=''] - 系统 TTS 使用的 voiceURI。
 * @param {number} [props.ttsSettings.ttsRate=0] - 语速调整，范围通常为 -100 到 100。
 * @returns {JSX.Element}
 */
const AiTtsButton = ({ text, ttsSettings = {} }) => {
  /** @type {[PlaybackState, React.Dispatch<React.SetStateAction<PlaybackState>>]} */
  const [playbackState, setPlaybackState] = useState('idle');
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);

  const {
    ttsEngine = TTS_ENGINE.THIRD_PARTY,
    thirdPartyTtsVoice = 'zh-CN-XiaoxiaoMultilingualNeural',
    systemTtsVoiceURI = '',
    ttsRate = 0,
  } = ttsSettings;

  // 组件卸载时的清理操作
  useEffect(() => {
    return () => {
      // 停止所有正在进行的语音合成
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      // 停止并清理第三方音频
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
        const utterance = new SpeechSynthesisUtterance(cleanedText);
        if (systemTtsVoiceURI) {
          const selectedVoice = window.speechSynthesis.getVoices().find(v => v.voiceURI === systemTtsVoiceURI);
          if (selectedVoice) utterance.voice = selectedVoice;
        }
        // 将 -100 到 100 的 ttsRate 转换为 0.1 到 2.0 的 rate
        utterance.rate = Math.max(0.1, Math.min(2, 1 + (ttsRate / 100))); 
        utterance.onstart = () => setPlaybackState('playing');
        utterance.onend = () => setPlaybackState('idle');
        utterance.onerror = (e) => { console.error('系统TTS错误:', e); setPlaybackState('idle'); };
        utterance.onpause = () => setPlaybackState('paused');
        utterance.onresume = () => setPlaybackState('playing');

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } else {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanedText)}&v=${thirdPartyTtsVoice}&r=${ttsRate}%&p=0&o=audio-24khz-48kbitrate-mono-mp3`;
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
  }, [ttsEngine, thirdPartyTtsVoice, systemTtsVoiceURI, ttsRate]);

  const pause = () => {
    if (playbackState !== 'playing') return;
    if (ttsEngine === TTS_ENGINE.SYSTEM) {
      window.speechSynthesis.pause();
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const resume = () => {
    if (playbackState !== 'paused') return;
    if (ttsEngine === TTS_ENGINE.SYSTEM) {
      window.speechSynthesis.resume();
    } else if (audioRef.current) {
      audioRef.current.play();
    }
  };

  const handleTogglePlayback = (e) => {
    e.stopPropagation();
    switch (playbackState) {
      case 'idle': synthesizeSpeech(text); break;
      case 'playing': pause(); break;
      case 'paused': resume(); break;
      default: break;
    }
  };
  
  const renderIcon = () => {
    switch (playbackState) {
      case 'loading':
        return <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;
      case 'playing':
        return <i className="fas fa-pause h-5 w-5 flex items-center justify-center"></i>; // 改为暂停图标更直观
      case 'paused':
        return <i className="fas fa-play h-5 w-5 flex items-center justify-center"></i>; // 改为播放图标更直观
      case 'idle':
      default:
        return <i className="fas fa-volume-up h-5 w-5 flex items-center justify-center"></i>;
    }
  };

  return (
    <button
      onClick={handleTogglePlayback}
      disabled={playbackState === 'loading'}
      className="p-2 rounded-full transition-all duration-200 transform active:scale-90 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
      title={
        playbackState === 'playing' ? "暂停" :
        playbackState === 'paused' ? "继续播放" : "朗读"
      }
    >
      {renderIcon()}
    </button>
  );
};

export default AiTtsButton;
