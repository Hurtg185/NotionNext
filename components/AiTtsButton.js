// /components/AiTtsButton.js - v30 (最终正确版 - 遵循 generateContent API)
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TTS_ENGINE } from './AiChatAssistant';

const cleanTextForSpeech = (text) => {
  if (!text) return '';
  return text.replace(/\*\*/g, '').replace(/#{1,6}\s/g, '').replace(/[-*]\s/g, '');
};

const AiTtsButton = ({ text, ttsSettings = {} }) => {
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const synthesizeSpeech = useCallback(async (textToSpeak) => {
    console.log("--- [TTS] 朗读按钮被点击 ---");

    const {
      ttsEngine = TTS_ENGINE.GEMINI_TTS,
      geminiTtsModel = 'gemini-2.5-flash-preview-tts', // <-- 关键点1: 使用您指定的模型
      geminiTtsVoice = 'Kore',
      apiKey = ''
    } = ttsSettings;

    const cleanedText = cleanTextForSpeech(textToSpeak);
    if (!cleanedText) return;

    setIsLoading(true);

    try {
      if (ttsEngine === TTS_ENGINE.GEMINI_TTS) {
        if (!apiKey) throw new Error("API Key 为空！");

        // --- 核心逻辑：完全按照截图的方式构建请求 ---
        // 关键点2: 使用 generateContent 端点
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiTtsModel}:generateContent?key=${apiKey}`;

        // 关键点3: 构建正确的请求体
        const body = {
          contents: [{
            parts: [{ text: cleanedText }]
          }],
          generationConfig: {
            ttsVoice: geminiTtsVoice,
            responseMimeType: 'audio/mpeg'
          }
        };

        console.log("[TTS] 正在发送请求...", { url, body });

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Gemini TTS API 错误 (状态码: ${response.status})`);
        }

        const data = await response.json();
        // 关键点4: 从正确的路径解析音频数据
        const audioContent = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (!audioContent) throw new Error('Gemini TTS 未能返回有效的音频内容。');
        
        const audio = new Audio("data:audio/mp3;base64," + audioContent);
        audioRef.current = audio;
        
        audio.onended = () => setIsLoading(false);
        audio.onerror = (e) => { 
          console.error('[TTS] 音频播放时发生错误!', e);
          setIsLoading(false); 
        };
        
        await audio.play();

      } else {
        setIsLoading(false);
      }
    } catch (err) {
      console.error('--- [TTS] 朗读过程中捕获到严重错误 ---', err);
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
