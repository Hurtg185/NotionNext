import React, { useState, useRef, useCallback, useEffect } from 'react';

// --- 常量定义 ---
// 发音服务提供商
export const TTS_PROVIDER = {
  MICROSOFT: 'microsoft',
  OPENAI: 'openai'
};

// OpenAI 提供的标准发音人
export const OPENAI_VOICES = [
  { name: 'Alloy - 平衡中性', value: 'alloy' },
  { name: 'Echo - 高级人工智能', value: 'echo' },
  { name: 'Fable - 英式语调', value: 'fable' },
  { name: 'Onyx - 威严有力', value: 'onyx' },
  { name: 'Nova - 温暖清晰', value: 'nova' },
  { name: 'Shimmer - 轻快乐观', value: 'shimmer' }
];

/**
 * 文本清理函数 (保持您提供的最终版规则)
 * 规则: 移除【】[], 移除()内的拼音, 移除Markdown和Emoji
 * @param {string} text - 原始文本
 * @returns {string} - 清理后的文本
 */
const cleanTextForSpeech = (text) => {
  if (!text) return '';
  let cleaned = text;
  cleaned = cleaned.replace(/【.*?】|\[.*?\]/g, '');
  const pinyinRegex = /\b([a-zA-Z\u00FC\u00DC\u00E1\u00E9\u00ED\u00F3\u00FA\u0101\u0113\u012B\u014D\u016B\u01CE\u01D0\u01D2\u01D4\u01D6\u01D8\u01DA\u01DC\u00E0\u00E8\u00EC\u00F2\u00F9\u0103\u0115\u012D\u014F\u016D\u0105\u0117\u012F\u0151\u016F]+[1-5]?)\b\s*/g;
  cleaned = cleaned.replace(/\((.*?)\)/g, (match, contentInsideParentheses) => {
    return contentInsideParentheses.replace(pinyinRegex, '');
  });
  cleaned = cleaned.replace(/\*\*|__|\*|_|~~|`/g, '').replace(/^(#+\s*|[\*\-]\s*)/gm, '');
  const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
  cleaned = cleaned.replace(emojiRegex, '');
  return cleaned.replace(/\s+/g, ' ').trim();
};


/**
 * 一个支持双API和动态图标的TTS按钮
 * @param {string} text - 需要朗读的文本
 * @param {string} provider - 'microsoft' 或 'openai'
 * @param {string} voice - 对应 provider 的发音人
 * @param {number} rate - 语速, 范围 -100 到 100
 * @param {number} pitch - 音调, 范围 -100 到 100 (主要用于 Microsoft)
 */
const AiTtsButton = ({ 
  text, 
  provider = TTS_PROVIDER.MICROSOFT, 
  voice = 'zh-CN-XiaoxiaoMultilingualNeural', 
  rate = 0,
  pitch = 0
}) => {
  const [playbackState, setPlaybackState] = useState('idle'); // idle, loading, playing, paused
  const audioRef = useRef(null);
  const abortControllerRef = useRef(null);

  // 组件卸载时停止一切活动
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src);
        }
      }
    };
  }, []);

  // 停止播放
  const stopPlayback = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setPlaybackState('idle');
  }, []);

  // 开始或恢复播放
  const startPlayback = useCallback(async (textToSpeak) => {
    if (playbackState === 'playing') {
      audioRef.current?.pause();
      setPlaybackState('paused');
      return;
    }
    if (playbackState === 'paused') {
      audioRef.current?.play();
      setPlaybackState('playing');
      return;
    }

    const cleanedText = cleanTextForSpeech(textToSpeak);
    if (!cleanedText) return;

    setPlaybackState('loading');
    abortControllerRef.current = new AbortController();

    try {
      let response;
      if (provider === TTS_PROVIDER.MICROSOFT) {
        const params = new URLSearchParams({
          t: cleanedText,
          v: voice,
          r: `${rate}%`,
          p: `${pitch}%`
        });
        const url = `https://t.leftsite.cn/tts?${params.toString()}`;
        response = await fetch(url, { signal: abortControllerRef.current.signal });

      } else if (provider === TTS_PROVIDER.OPENAI) {
        const url = 'https://oai-tts.zwei.de.eu.org/v1/audio/speech';
        const speed = Math.max(0.25, Math.min(4.0, 1.0 + (rate / 100))); // 将百分比转为0.25-4.0的倍率
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'tts-1',
            input: cleanedText,
            voice: voice,
            speed: speed
          }),
          signal: abortControllerRef.current.signal
        });
      }

      if (!response || !response.ok) {
        const errorText = await response?.text();
        throw new Error(`API 请求失败: ${response?.status} ${errorText}`);
      }
      
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      
      // 清理旧的 audio 元素
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src?.startsWith('blob:')) URL.revokeObjectURL(audioRef.current.src);
      }
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onplay = () => setPlaybackState('playing');
      audio.onpause = () => {
        // onended 也会触发 onpause，所以需要判断
        if (audio.currentTime < audio.duration) {
            setPlaybackState('paused');
        }
      };
      audio.onended = () => setPlaybackState('idle');
      audio.onerror = (e) => {
        console.error('音频播放错误:', e);
        setPlaybackState('idle');
      }

      await audio.play();

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('语音合成失败:', err);
        alert(`语音合成失败: ${err.message}`);
      }
      setPlaybackState('idle');
    }

  }, [provider, voice, rate, pitch, playbackState]);


  // 动态图标组件
  const AnimatedIcon = ({ state }) => {
    return (
      <div className="relative w-6 h-6 flex items-center justify-center">
        {/* 加载中 Spinner */}
        <div className={`absolute transition-opacity duration-300 ${state === 'loading' ? 'opacity-100' : 'opacity-0'}`}>
           <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>
        
        {/* 播放/暂停图标 */}
        <div className={`absolute transition-opacity duration-300 ${state !== 'loading' ? 'opacity-100' : 'opacity-0'}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="transition-transform duration-300 ease-in-out">
            {/* 暂停图标的路径 (两条竖线) */}
            <path d="M9 4 H11 V20 H9z M13 4 H15 V20 H13z" className={`transition-all duration-300 ease-in-out ${state === 'playing' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} />
            {/* 播放图标的路径 (三角形) */}
            <path d="M8 5 L18 12 L8 19z" className={`transition-all duration-300 ease-in-out ${state !== 'playing' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} />
          </svg>
        </div>
      </div>
    );
  };
  
  return (
    <button
      onClick={(e) => { e.stopPropagation(); startPlayback(text); }}
      disabled={playbackState === 'loading'}
      className="p-2 rounded-full transition-colors duration-200 transform active:scale-90 hover:bg-black/10 text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
      title={playbackState === 'playing' ? "暂停" : "朗读"}
    >
      <AnimatedIcon state={playbackState} />
    </button>
  );
};

export default AiTtsButton;
