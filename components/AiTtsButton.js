// /components/AiTtsButton.js (Microsoft TTS 专用版 + 音乐动画图标)
import React, { useState, useRef, useCallback, useEffect } from 'react';

// --- 1. 发音人数据已内置 ---
// 精选的 Microsoft Azure TTS 发音人列表
export const MICROSOFT_TTS_VOICES = [
  // --- 中文 (大陆) ---
  { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' },
  { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' },
  { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' },
  { name: '云泽 (男, 叙事)', value: 'zh-CN-YunzeNeural' },
  { name: '晓梦 (女, 播音)', value: 'zh-CN-XiaomengNeural' },
  { name: '云扬 (男, 阳光)', value: 'zh-CN-YunyangNeural' },
  { name: '晓伊 (女, 动漫)', value: 'zh-CN-XiaoyiNeural' },
  // --- 中文 (台湾) ---
  { name: '晓臻 (女, 台湾)', value: 'zh-TW-HsiaoChenNeural' },
  { name: '允喆 (男, 台湾)', value: 'zh-TW-YunJheNeural' },
  // --- 英语 (美国) ---
  { name: 'Ava (女, 美国, 多语言)', value: 'en-US-AvaMultilingualNeural' },
  { name: 'Andrew (男, 美国, 多语言)', value: 'en-US-AndrewMultilingualNeural' },
  // --- 日语 ---
  { name: '七海 (女, 日本)', value: 'ja-JP-NanamiNeural' },
  { name: '圭太 (男, 日本)', value: 'ja-JP-KeitaNeural' },
  // --- 缅甸语 ---
  { name: '妮拉 (女, 缅甸)', value: 'my-MM-NilarNeural' },
  { name: '蒂哈 (男, 缅甸)', value: 'my-MM-ThihaNeural' },
];

/**
 * 文本清理函数
 */
const cleanTextForSpeech = (text) => {
  if (!text) return '';
  let cleaned = text;
  // ... (文本清理逻辑保持不变)
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
 * 一个专为 Microsoft TTS 设计的，带有音乐动画图标的朗读按钮
 * @param {string} text - 需要朗读的文本
 * @param {string} voice - Microsoft 的发音人
 * @param {number} rate - 语速, 范围 -100 到 100
 * @param {number} pitch - 音调, 范围 -100 到 100
 */
const AiTtsButton = ({ 
  text, 
  voice = 'zh-CN-XiaoxiaoMultilingualNeural', 
  rate = 0,
  pitch = 0
}) => {
  const [playbackState, setPlaybackState] = useState('idle'); // idle, loading, playing, paused
  const audioRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src?.startsWith('blob:')) URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, []);

  const startPlayback = useCallback(async (textToSpeak) => {
    if (playbackState === 'playing') {
      audioRef.current?.pause();
      return;
    }
    if (playbackState === 'paused') {
      audioRef.current?.play();
      return;
    }

    const cleanedText = cleanTextForSpeech(textToSpeak);
    if (!cleanedText) return;

    setPlaybackState('loading');
    abortControllerRef.current = new AbortController();

    try {
      const params = new URLSearchParams({
        t: cleanedText,
        v: voice,
        r: `${rate}%`,
        p: `${pitch}%`
      });
      const url = `https://t.leftsite.cn/tts?${params.toString()}`;
      const response = await fetch(url, { signal: abortControllerRef.current.signal });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 请求失败: ${response.status} ${errorText}`);
      }
      
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      
      if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onplay = () => setPlaybackState('playing');
      audio.onpause = () => {
        if (audio.currentTime < audio.duration) setPlaybackState('paused');
      };
      audio.onended = () => setPlaybackState('idle');
      audio.onerror = (e) => { console.error('音频播放错误:', e); setPlaybackState('idle'); };

      await audio.play();

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('语音合成失败:', err);
        alert(`语音合成失败: ${err.message}`);
      }
      setPlaybackState('idle');
    }
  }, [voice, rate, pitch, playbackState]);

  // --- 3. 全新的音乐动画图标组件 ---
  const AnimatedMusicIcon = ({ state }) => {
    // 定义每个声波条的动画样式
    const barStyle = (animationDelay) => ({
      animation: state === 'playing' ? `sound-wave 1.2s ease-in-out ${animationDelay} infinite alternate` : 'none',
    });

    return (
      <div className="relative w-6 h-6 flex items-center justify-center">
        {/* 加载中 Spinner */}
        <div className={`absolute transition-opacity duration-300 ${state === 'loading' ? 'opacity-100' : 'opacity-0'}`}>
           <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>
        
        {/* 音乐声波图标 */}
        <div className={`absolute transition-opacity duration-300 ${state !== 'loading' ? 'opacity-100' : 'opacity-0'}`}>
           <div className="flex items-end justify-center w-6 h-6 gap-0.5">
             <span className="w-1 h-2 bg-current rounded-full" style={barStyle('0s')}></span>
             <span className="w-1 h-4 bg-current rounded-full" style={barStyle('0.2s')}></span>
             <span className="w-1 h-5 bg-current rounded-full" style={barStyle('0.4s')}></span>
             <span className="w-1 h-3 bg-current rounded-full" style={barStyle('0.6s')}></span>
           </div>
        </div>
        {/* 定义动画的关键帧 */}
        <style jsx>{`
          @keyframes sound-wave {
            0% { transform: scaleY(0.2); }
            100% { transform: scaleY(1); }
          }
        `}</style>
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
      <AnimatedMusicIcon state={playbackState} />
    </button>
  );
};

export default AiTtsButton;
