// /components/AiTtsButton.js - v35 (独立组件，支持播放/暂停，移除标点)
import React, { useState, useRef, useCallback, useEffect } from 'react';
// TTS_ENGINE 将从 AiChatAssistant 导入
// export const TTS_ENGINE = { SYSTEM: 'system', THIRD_PARTY: 'third_party' }; // 不在这里定义

// 清理文本：移除Markdown和常见标点符号
const cleanTextForSpeech = (rawText) => {
    if (!rawText) return '';
    let cleaned = rawText
        .replace(/\*\*(.*?)\*\*/g, '$1') // 移除 **加粗**
        .replace(/#{1,6}\s/g, '')     // 移除 # 标题
        .replace(/[-*]\s/g, '')       // 移除 - * 列表标记
        .replace(/[~`!@#$%^&*()_|+\-=?;:'",.<>{}[\\]\\\/]/gi, ' '); // 移除常见标点
    return cleaned.trim();
};

const AiTtsButton = ({ text, ttsSettings = {}, TTS_ENGINE }) => { // 接收 TTS_ENGINE 作为 prop
    const [isLoading, setIsLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false); // 播放状态
    const audioRef = useRef(null);
    const utteranceRef = useRef(null); // 用于系统TTS

    // 停止当前所有播放，并重置状态
    const stopPlayback = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = ''; // 释放音频资源
            audioRef.current = null;
        }
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            utteranceRef.current = null;
        }
        setIsPlaying(false);
        setIsLoading(false);
    }, []);

    // 播放/暂停逻辑
    const handleTogglePlayback = useCallback(async () => {
        if (isPlaying || isLoading) { // 如果正在播放或加载中，则尝试停止
            stopPlayback();
            return;
        }

        // 此时是未播放状态，尝试开始播放
        const {
            ttsEngine = TTS_ENGINE.THIRD_PARTY,
            thirdPartyTtsVoice = 'zh-CN-XiaoxiaoMultilingualNeural',
            systemTtsVoiceURI = '',
        } = ttsSettings;
        
        const cleanedText = cleanTextForSpeech(text);
        if (!cleanedText) {
            console.warn("[TTS] 待朗读文本为空或已被清理为空，已中止。");
            return;
        }

        setIsLoading(true);

        try {
            switch (ttsEngine) {
                case TTS_ENGINE.SYSTEM:
                    if ('speechSynthesis' in window) {
                        const utterance = new SpeechSynthesisUtterance(cleanedText);
                        if (systemTtsVoiceURI) {
                            const selectedVoice = window.speechSynthesis.getVoices().find(v => v.voiceURI === systemTtsVoiceURI);
                            if (selectedVoice) {
                                utterance.voice = selectedVoice;
                                utterance.lang = selectedVoice.lang;
                            }
                        }
                        utterance.onstart = () => setIsPlaying(true);
                        utterance.onend = () => stopPlayback();
                        utterance.onerror = (e) => { console.error('系统TTS错误:', e); stopPlayback(); };
                        utteranceRef.current = utterance;
                        window.speechSynthesis.speak(utterance);
                    } else {
                        throw new Error("浏览器不支持系统TTS。");
                    }
                    break;

                case TTS_ENGINE.THIRD_PARTY:
                default:
                    // 请根据您的第三方API实际情况调整URL
                    // 例如，您之前提供的URL是：https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanedText)}&v=${thirdPartyTtsVoice}&r=-20%&&p=0%o=audio-24khz-48kbitrate-mono-mp3
                    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanedText)}&v=${thirdPartyTtsVoice}&r=-20%&&p=0%o=audio-24khz-48kbitrate-mono-mp3`;
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`第三方API错误 (状态码: ${response.status})`);
                    
                    const audioBlob = await response.blob();
                    const audioUrl = URL.createObjectURL(audioBlob); // 创建临时URL
                    
                    const audio = new Audio(audioUrl);
                    audioRef.current = audio;
                    
                    audio.onplay = () => setIsPlaying(true);
                    audio.onended = () => stopPlayback();
                    audio.onerror = () => { console.error('第三方音频播放错误'); stopPlayback(); };
                    
                    await audio.play();
                    break;
            }
        } catch (err) {
            console.error('朗读失败:', err);
            stopPlayback();
        } finally {
            setIsLoading(false); // 无论成功失败，加载状态结束
        }
    }, [ttsSettings, text, cleanTextForSpeech, stopPlayback, isLoading, isPlaying, TTS_ENGINE]);

    useEffect(() => {
        return () => stopPlayback(); // 组件卸载时确保停止所有播放
    }, [stopPlayback]);

    let iconClass = "fa-volume-up"; // 默认图标
    let title = "朗读";

    if (isLoading) {
        iconClass = "fa-spinner fa-spin"; // 加载时转圈
        title = "加载中...";
    } else if (isPlaying) {
        iconClass = "fa-pause"; // 播放时显示暂停图标
        title = "暂停";
    }
    // else 保持 fa-volume-up 和 "朗读"

    return (
        <button
            onClick={(e) => { e.stopPropagation(); handleTogglePlayback(); }}
            disabled={isLoading && !isPlaying} // 只有在加载中但未播放时才禁用（避免重复点击）
            className={`p-2 rounded-full transition-colors ${isLoading && !isPlaying ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
            title={title}
        >
            <i className={`fas ${iconClass}`}></i>
        </button>
    );
};

export default AiTtsButton;
