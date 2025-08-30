// /components/TextToSpeechButton.js - 支持 Google GenAI TTS 和外部 API TTS
import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * TTS 引擎枚举
 */
const TTS_ENGINE = {
  GOOGLE_GENAI: 'google_genai',
  EXTERNAL_API: 'external_api',
  SYSTEM_TTS: 'system_tts' // 备用系统TTS，以防万一
};

/**
 * 文本朗读按钮组件。
 * 支持多种 TTS 引擎，可通过设置面板选择。
 * @param {string} text - 要朗读的文本。
 * @param {string} [lang='zh-CN'] - 朗读的语言，默认为中文。
 * @param {string} [apiKey=''] - Google GenAI API Key (如果选择 Google GenAI 引擎)。
 * @param {string} [selectedTtsEngine=TTS_ENGINE.GOOGLE_GENAI] - 当前选中的 TTS 引擎。
 * @param {string} [googleVoiceName='cmn-CN-Wavenet-A'] - Google TTS 的发音人名称 (仅限 Google GenAI 引擎)。
 * @param {string} [googlePitch=0] - Google TTS 语调 (-20 ~ 20)。
 * @param {string} [googleRate=1] - Google TTS 语速 (0.25 ~ 4.0)。
 * @param {string} [externalVoice='zh-CN-XiaochenMultilingualNeural'] - 外部 API 的发音人名称 (仅限外部 API 引擎)。
 * @param {string} [externalRate='-20%'] - 外部 API 的语速。
 * @param {string} [externalPitch='0%'] - 外部 API 的语调。
 * @param {string} [className=''] - 附加到按钮的 CSS 类名。
 */
const TextToSpeechButton = ({
  text,
  lang = 'zh-CN',
  apiKey = '', // 从 AiChatAssistant 传递下来
  selectedTtsEngine = TTS_ENGINE.GOOGLE_GENAI, // 从 AiChatAssistant 传递下来
  googleVoiceName = 'cmn-CN-Wavenet-A', // 默认 Google 中文女声
  googlePitch = 0,
  googleRate = 1,
  externalVoice = 'zh-CN-XiaochenMultilingualNeural', // 默认晓辰
  externalRate = '-20%',
  externalPitch = '0%',
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);

  const synthesizeSpeech = useCallback(async (textToSpeak) => {
    if (!textToSpeak || textToSpeak.trim() === '') {
      setError('没有可朗读的文本。');
      return;
    }
    if (selectedTtsEngine === TTS_ENGINE.GOOGLE_GENAI && !apiKey.trim()) {
      setError('请在设置中提供 Google Gemini API 密钥以使用 Google TTS。');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let audioBlob;

      if (selectedTtsEngine === TTS_ENGINE.GOOGLE_GENAI) {
        // --- Google GenAI TTS API 调用 ---
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

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Google TTS API 错误: ${errorData.error?.message || response.statusText}`);
        }
        const data = await response.json();
        if (!data.audioContent) throw new Error('Google TTS 未返回音频内容。');
        
        // Base64 解码并创建 Blob
        const base64 = data.audioContent;
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        audioBlob = new Blob([bytes.buffer], { type: 'audio/mpeg' });

      } else if (selectedTtsEngine === TTS_ENGINE.EXTERNAL_API) {
        // --- 外部 API TTS 调用 (t.leftsite.cn) ---
        const externalApiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(textToSpeak)}&v=${externalVoice}&r=${externalRate}&p=${externalPitch}&o=audio-24khz-48kbitrate-mono-mp3`;
        const response = await fetch(externalApiUrl);
        if (!response.ok) {
          throw new Error(`外部 TTS API 错误 (状态码: ${response.status})`);
        }
        audioBlob = await response.blob();
      } else { // Fallback to System TTS if no valid engine selected or config missing
          if ('speechSynthesis' in window) {
              const utterance = new SpeechSynthesisUtterance(textToSpeak);
              utterance.lang = lang;
              window.speechSynthesis.speak(utterance);
              setIsLoading(false); // 系统TTS不显示加载状态
              return;
          } else {
              throw new Error('浏览器不支持系统 TTS 语音合成。');
          }
      }
      
      // 播放音频
      if (audioBlob) {
          if (audioRef.current && audioRef.current.src) {
              URL.revokeObjectURL(audioRef.current.src);
              audioRef.current.pause();
          }
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          await audio.play();
      }

    } catch (err) {
      console.error('朗读失败:', err);
      setError(`朗读失败: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [text, lang, apiKey, selectedTtsEngine, googleVoiceName, googlePitch, googleRate, externalVoice, externalRate, externalPitch]);


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

export default TextToSpeechButton;
