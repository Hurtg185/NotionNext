import React, { useState, useRef, useCallback, useEffect } from 'react';

// --- 发音人数据已内置 ---
export const MICROSOFT_TTS_VOICES = [
  { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' },
  { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' },
  { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' },
  { name: '云泽 (男, 叙事)', value: 'zh-CN-YunzeNeural' },
  { name: '晓梦 (女, 播音)', value: 'zh-CN-XiaomengNeural' },
  { name: '云扬 (男, 阳光)', value: 'zh-CN-YunyangNeural' },
  { name: '晓伊 (女, 动漫)', value: 'zh-CN-XiaoyiNeural' },
  { name: '晓臻 (女, 台湾)', value: 'zh-TW-HsiaoChenNeural' },
  { name: '允喆 (男, 台湾)', value: 'zh-TW-YunJheNeural' },
  { name: 'Ava (女, 美国, 多语言)', value: 'en-US-AvaMultilingualNeural' },
  { name: 'Andrew (男, 美国, 多语言)', value: 'en-US-AndrewMultilingualNeural' },
  { name: '七海 (女, 日本)', value: 'ja-JP-NanamiNeural' },
  { name: '圭太 (男, 日本)', value: 'ja-JP-KeitaNeural' },
  { name: '妮拉 (女, 缅甸)', value: 'my-MM-NilarNeural' },
  { name: '蒂哈 (男, 缅甸)', value: 'my-MM-ThihaNeural' },
];

// --- 加强版文本清理函数 ---
const cleanTextForSpeech = (text) => {
    if (!text) return '';
    let cleaned = text;
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    cleaned = cleaned.replace(/!\[.*?\]\(.*?\)|\[(.*?)\]\(.*?\)/g, '$1');
    cleaned = cleaned.replace(/```[\s\S]*?```|`[^`]*`/g, '');
    cleaned = cleaned.replace(/(\*\*|__|\*|_|~~|#+\s*|[\*\-]\s*)/g, '');
    cleaned = cleaned.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s.,?!;:()'"-]/g, '');
    const pinyinRegex = /\b([a-zA-Z\u00FC\u00DC\u00E1\u00E9\u00ED\u00F3\u00FA\u0101\u0113\u012B\u014D\u016B\u01CE\u01D0\u01D2\u01D4\u01D6\u01D8\u01DA\u01DC\u00E0\u00E8\u00EC\u00F2\u00F9\u0103\u0115\u012D\u014F\u016D\u0105\u0117\u012F\u0151\u016F]+[1-5]?)\b\s*/g;
    cleaned = cleaned.replace(/\((.*?)\)/g, (match, content) => content.replace(pinyinRegex, ''));
    return cleaned.replace(/\s+/g, ' ').trim();
};


const AiTtsButton = ({ 
  text, 
  voice = 'zh-CN-XiaoxiaoMultilingualNeural', 
  rate = 0,
}) => {
  const [playbackState, setPlaybackState] = useState('idle');
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
      // --- 【核心修复】 ---
      // 始终使用 OpenAI 兼容的 POST 请求方式
      const url = 'https://t.leftsite.cn/tts';
      // 将 rate (-100 to 100) 转换为 speed (0.25 to 4.0)
      const speed = Math.max(0.25, Math.min(4.0, 1.0 + (rate / 100)));

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'tts-1', // 兼容接口通常需要这个模型名
          input: cleanedText,
          voice: voice,   // 这里传入的是 Microsoft 的发音人名字
          speed: speed
        }),
        signal: abortControllerRef.current.signal
      });
      // --- 修复结束 ---

      if (!response.ok) {
        // 尝试解析JSON错误体以获得更清晰的信息
        try {
            const errData = await response.json();
            throw new Error(errData.error || `API 请求失败，状态码: ${response.status}`);
        } catch (e) {
            throw new Error(`API 请求失败，状态码: ${response.status}`);
        }
      }
      
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      
      if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onplay = () => setPlaybackState('playing');
      audio.onpause = () => { if (audio.currentTime < audio.duration) setPlaybackState('paused'); };
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
  }, [voice, rate, playbackState]);

  // --- 动画图标组件 ---
  const AnimatedMusicIcon = ({ state }) => {
    const barStyle = (animationDelay) => ({
      animation: state === 'playing' ? `sound-wave 1.2s ease-in-out ${animationDelay} infinite alternate` : 'none',
    });

    return (
      <div className="relative w-6 h-6 flex items-center justify-center">
        <div className={`absolute transition-opacity duration-300 ${state === 'loading' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
           <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>
        <div className={`absolute transition-opacity duration-300 ${state === 'idle' || state === 'paused' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5 L18 12 L8 19z" />
            </svg>
        </div>
        <div className={`absolute transition-opacity duration-300 ${state === 'playing' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
           <div className="flex items-end justify-center w-6 h-6 gap-0.5">
             <span className="w-1 h-2 bg-current rounded-full" style={barStyle('0s')}></span>
             <span className="w-1 h-4 bg-current rounded-full" style={barStyle('0.2s')}></span>
             <span className="w-1 h-5 bg-current rounded-full" style={barStyle('0.4s')}></span>
             <span className="w-1 h-3 bg-current rounded-full" style={barStyle('0.6s')}></span>
           </div>
        </div>
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
