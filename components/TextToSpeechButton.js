// /components/TextToSpeechButton.js - 使用外部 API 的语音朗读组件 (晓辰版)

import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 使用外部 TTS API (https://t.leftsite.cn) 进行文本朗读的按钮组件。
 * 提供比系统 TTS 更一致的发音人（晓辰）和音质。
 * @param {string} text - 要朗读的文本。
 * @param {string} [lang='zh-CN'] - 朗读的语言，默认为中文。
 * @param {string} [voice='zh-CN-XiaochenMultilingualNeural'] - 指定发音人。
 * @param {string} [rate='-20%'] - 语速，默认为-20% (比正常慢一点)。
 * @param {string} [pitch='0%'] - 语调，默认为0%。
 * @param {string} [className=''] - 附加到按钮的 CSS 类名。
 */
const TextToSpeechButton = ({ // 注意：这里改回 TextToSpeechButton
  text,
  lang = 'zh-CN',
  voice = 'zh-CN-XiaochenMultilingualNeural', // 默认晓辰
  rate = '-20%', // 默认语速
  pitch = '0%',
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null); // 用于播放音频

  // API 配置 (直接来自你提供的脚本)
  const apiConfig = useRef({
    apiBaseUrl: 'https://t.leftsite.cn',
    voice: voice,
    rate: rate,
    pitch: pitch,
    outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
  });

  // 更新发音人、语速等配置
  useEffect(() => {
      apiConfig.current.voice = voice;
      apiConfig.current.rate = rate;
      apiConfig.current.pitch = pitch;
  }, [voice, rate, pitch]);


  const synthesizeSpeech = useCallback(async (textToSpeak) => {
    if (!textToSpeak || textToSpeak.trim() === '') {
      setError('没有可朗读的文本。');
      return;
    }
    if (!apiConfig.current.apiBaseUrl) {
      setError('TTS API 地址未配置。');
      return;
    }

    setIsLoading(true);
    setError(null);

    const encodedText = encodeURIComponent(textToSpeak);
    // 构建 API URL
    let url = `${apiConfig.current.apiBaseUrl}/tts?t=${encodedText}&v=${apiConfig.current.voice}&r=${apiConfig.current.rate}&p=${apiConfig.current.pitch}&o=${apiConfig.current.outputFormat}`;
    
    try {
      // 使用 fetch 请求音频 Blob
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API 错误 (状态码: ${response.status})`);
      }

      const audioBlob = await response.blob();
      
      // 如果正在播放，先暂停并释放旧的URL
      if (audioRef.current && audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current.pause();
      }
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio; // 保存当前音频对象

      await audio.play();

    } catch (err) {
      console.error('朗读失败:', err);
      setError(`朗读失败: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []); // 依赖列表为空，因为apiConfig.current 在 useEffect 内部更新


  return (
    <button
      onClick={() => synthesizeSpeech(text)}
      disabled={isLoading}
      className={`tts-button inline-flex items-center justify-center rounded-full w-8 h-8 sm:w-10 sm:h-10 text-white shadow-sm transition-all duration-200 ${
        isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
      } ${className}`}
      aria-label={`朗读: ${text}`}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
      )}
      {error && <span className="sr-only">错误: {error}</span>}
    </button>
  );
};

export default TextToSpeechButton; // 导出为 TextToSpeechButton
