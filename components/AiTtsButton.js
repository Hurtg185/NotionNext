// /components/AiTtsButton.js (更新版)
import React, { useState, useRef, useEffect } from 'react';
import { TTS_ENGINE } from './AiChatAssistant'; // 引入常量

const AiTtsButton = ({ text, ttsSettings }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);
    const utteranceRef = useRef(null);

    // 清理函数，确保组件卸载时停止播放
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (window.speechSynthesis && utteranceRef.current) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);
    
    // 文本预处理，移除可能干扰朗读的 Markdown 字符
    const cleanTextForTts = (inputText) => {
        if (!inputText) return '';
        return inputText.replace(/[*#`_~]/g, ''); // 移除常见 Markdown 符号
    };

    const handlePlay = async () => {
        if (isPlaying) {
            handleStop();
            return;
        }

        const textToRead = cleanTextForTts(text);
        if (!textToRead) return;

        setIsPlaying(true);

        try {
            switch (ttsSettings.ttsEngine) {
                case TTS_ENGINE.SYSTEM:
                    playWithSystem(textToRead);
                    break;
                case TTS_ENGINE.OPENAI:
                    await playWithOpenAI(textToRead);
                    break;
                // case TTS_ENGINE.GOOGLE: // 类似地实现 Google TTS
                //     await playWithGoogle(textToRead);
                //     break;
                case TTS_ENGINE.MICROSOFT:
                default:
                    await playWithThirdParty(textToRead); // 假设是微软
                    break;
            }
        } catch (error) {
            console.error("TTS Error:", error);
            alert(`语音播放失败: ${error.message}`);
            setIsPlaying(false);
        }
    };

    const handleStop = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        setIsPlaying(false);
    };

    const playWithSystem = (textToRead) => {
        if (!window.speechSynthesis) {
            throw new Error("浏览器不支持系统语音合成。");
        }
        window.speechSynthesis.cancel(); // 取消之前的朗读
        const utterance = new SpeechSynthesisUtterance(textToRead);
        if (ttsSettings.systemTtsVoiceURI) {
            const voice = window.speechSynthesis.getVoices().find(v => v.voiceURI === ttsSettings.systemTtsVoiceURI);
            if (voice) utterance.voice = voice;
        }
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = (e) => {
            console.error("System TTS error:", e);
            setIsPlaying(false);
        };
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
    };
    
    const playWithOpenAI = async (textToRead) => {
        const { apiKey, model, voice } = ttsSettings.openaiTtsSettings;
        if (!apiKey) throw new Error("未配置 OpenAI TTS API Key。");

        const response = await fetch("https://api.openai.com/v1/audio/speech", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                input: textToRead,
                voice: voice,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || "OpenAI TTS 请求失败");
        }
        const blob = await response.blob();
        playAudioBlob(blob);
    };

    const playWithThirdParty = async (textToRead) => {
        // 这是您之前可能使用的第三方 TTS 接口，例如通过 Vercel Edge Function 代理的微软 TTS
        const voice = ttsSettings.microsoftTtsVoice;
        const response = await fetch(`/api/tts/microsoft?voice=${voice}&text=${encodeURIComponent(textToRead)}`);
        if (!response.ok) throw new Error("第三方 TTS 服务请求失败。");
        const blob = await response.blob();
        playAudioBlob(blob);
    };

    const playAudioBlob = (blob) => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.play();
        audio.onended = () => {
            setIsPlaying(false);
            URL.revokeObjectURL(url);
        };
         audio.onerror = () => {
            setIsPlaying(false);
            URL.revokeObjectURL(url);
            console.error("Audio playback error");
        };
    };

    return (
        <button onClick={handlePlay} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title={isPlaying ? "停止" : "朗读"}>
            <i className={`fas ${isPlaying ? 'fa-stop-circle text-red-500 animate-pulse' : 'fa-volume-up'}`}></i>
        </button>
    );
};

export default AiTtsButton;
