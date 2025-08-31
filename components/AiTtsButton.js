// /components/AiTtsButton.js (最终优化版 - 过滤拼音和标点)
import React, { useState, useRef, useCallback, useEffect } from 'react';

const cleanTextForSpeech = (rawText) => {
    if (!rawText) return '';
    return rawText
        // 移除 Markdown 语法
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/#{1,6}\s/g, '')
        .replace(/[-*]\s/g, '')
        // **关键: 移除带音调的拼音字符 (如 ā, á, ǎ, à)**
        .replace(/[\u0100-\u017F]/g, '')
        // 移除所有中英文标点符号
        .replace(/[~`!@#$%^&*()_|+\-=?;:'",.<>{}[\\]\\\/，。？！；：“”‘’（）【】]/g, ' ')
        .trim();
};

const AiTtsButton = ({ text, ttsSettings = {}, TTS_ENGINE }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);
    const utteranceRef = useRef(null);

    const stopPlayback = useCallback(() => {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null; }
        if (window.speechSynthesis?.speaking) { window.speechSynthesis.cancel(); }
        utteranceRef.current = null;
        setIsLoading(false);
        setIsPlaying(false);
    }, []);

    useEffect(() => () => stopPlayback(), [stopPlayback]);

    const handleTogglePlayback = useCallback(async () => {
        if (isPlaying || isLoading) { stopPlayback(); return; }
        if (!TTS_ENGINE) { console.error("TTS_ENGINE prop is missing!"); return; }

        const { ttsEngine = TTS_ENGINE.THIRD_PARTY, thirdPartyTtsVoice = 'zh-CN-XiaoxiaoMultilingualNeural', systemTtsVoiceURI = '' } = ttsSettings;
        const cleanedText = cleanTextForSpeech(text);
        if (!cleanedText) return;

        setIsLoading(true);
        try {
            if (ttsEngine === TTS_ENGINE.SYSTEM) {
                if (!('speechSynthesis' in window)) throw new Error("Browser doesn't support System TTS.");
                const utterance = new SpeechSynthesisUtterance(cleanedText);
                if (systemTtsVoiceURI) {
                    const voice = window.speechSynthesis.getVoices().find(v => v.voiceURI === systemTtsVoiceURI);
                    if (voice) utterance.voice = voice;
                }
                utterance.onstart = () => { setIsLoading(false); setIsPlaying(true); };
                utterance.onend = stopPlayback;
                utterance.onerror = (e) => { console.error('System TTS Error:', e); stopPlayback(); };
                window.speechSynthesis.speak(utterance);
            } else {
                const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanedText)}&v=${thirdPartyTtsVoice}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error(`API Error (Status: ${response.status})`);
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                audioRef.current = audio;
                audio.oncanplaythrough = () => audio.play().catch(stopPlayback);
                audio.onplay = () => { setIsLoading(false); setIsPlaying(true); };
                audio.onended = stopPlayback;
                audio.onerror = (e) => { console.error('Audio Playback Error:', e); stopPlayback(); };
                audio.load();
            }
        } catch (err) { console.error('TTS Failed:', err); stopPlayback(); }
    }, [ttsSettings, text, stopPlayback, isLoading, isPlaying, TTS_ENGINE]);

    let iconClass = "fa-volume-up", title = "朗读";
    if (isLoading) { iconClass = "fa-spinner fa-spin"; title = "加载中..."; }
    else if (isPlaying) { iconClass = "fa-pause"; title = "暂停"; }

    return (
        <button onClick={handleTogglePlayback} disabled={isLoading} className={`p-2 rounded-full transition-colors ${isLoading ? 'text-gray-400' : 'hover:bg-black/10 dark:hover:bg-white/10'}`} title={title}>
            <i className={`fas ${iconClass}`}></i>
        </button>
    );
};
export default AiTtsButton;
