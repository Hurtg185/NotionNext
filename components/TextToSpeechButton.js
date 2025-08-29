// /components/TextToSpeechButton.js
import React, { useState, useEffect, useRef } from 'react';

/**
 * 文本朗读按钮组件
 * 利用浏览器 SpeechSynthesis API 朗读指定文本。
 * 点击时，只会触发朗读，不会触发父元素的点击事件（通过 e.stopPropagation()）。
 *
 * @param {object} props - 组件属性
 * @param {string} props.text - 要朗读的文本。
 * @param {string} [props.lang='zh-CN'] - 朗读语言，例如 'zh-CN' (中文), 'en-US' (英文)。
 * @param {number} [props.rate=1] - 朗读语速 (0.1 - 10, 默认 1)。
 * @param {number} [props.pitch=1] - 朗读音高 (0 - 2, 默认 1)。
 * @param {string} [props.voiceName] - 指定朗读声音的名称 (可选)。
 */
const TextToSpeechButton = ({ text, lang = 'zh-CN', rate = 1, pitch = 1, voiceName }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthRef = useRef(null); // SpeechSynthesis 实例
  const utteranceRef = useRef(null); // SpeechSynthesisUtterance 实例

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;

      // 清理函数，在组件卸载或依赖变化时停止朗读
      return () => {
        if (synthRef.current && synthRef.current.speaking) {
          synthRef.current.cancel();
        }
      };
    }
  }, []);

  const speak = () => {
    if (!synthRef.current || !text) {
      console.warn("SpeechSynthesis not available or text is empty.");
      return;
    }

    // 如果正在说话，先停止
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;

    // 尝试设置指定的声音
    if (voiceName) {
      const voices = synthRef.current.getVoices();
      const selectedVoice = voices.find(voice => voice.name === voiceName && voice.lang === lang);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      } else {
        console.warn(`Voice "${voiceName}" not found for language "${lang}". Using default.`);
      }
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (event) => {
      console.error('SpeechSynthesisUtterance.onerror', event);
      setIsSpeaking(false);
    };

    utteranceRef.current = utterance; // 保存 utterance 引用以便停止
    synthRef.current.speak(utterance);
  };

  const stop = () => {
    if (synthRef.current && synthRef.current.speaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  // === 关键修改：在 handleClick 中阻止事件冒泡 ===
  const handleClick = (e) => {
    e.stopPropagation(); // <--- 阻止事件冒泡到父元素！
    if (isSpeaking) {
      stop();
    } else {
      speak();
    }
  };
  // ===============================================

  const isDisabled = typeof window === 'undefined' || !window.speechSynthesis || !text;

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`ml-2 p-1 rounded-full text-primary dark:text-secondary hover:bg-primary/[0.1] dark:hover:bg-secondary/[0.1] transition-colors duration-200 flex-shrink-0 // flex-shrink-0 防止按钮被挤压
                  ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={isSpeaking ? '停止朗读' : '朗读'}
    >
      {isSpeaking ? (
        <i className="fas fa-stop text-base"></i>
      ) : (
        <i className="fas fa-volume-up text-base"></i>
      )}
    </button>
  );
};

export default TextToSpeechButton;
