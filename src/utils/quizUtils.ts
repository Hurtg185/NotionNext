// src/utils/quizUtils.ts

import { pinyin } from 'pinyin-pro';
import { QuizType } from '../types/quiz';

// TTS 朗读功能
let currentSpeechSynthesisUtterance: SpeechSynthesisUtterance | null = null;

export const speakText = (text: string) => {
  if ('speechSynthesis' in window) {
    if (currentSpeechSynthesisUtterance && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1;
    utterance.pitch = 1;

    window.speechSynthesis.speak(utterance);
    currentSpeechSynthesisUtterance = utterance;

    return () => {
      if (currentSpeechSynthesisUtterance === utterance && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  } else {
    console.warn("当前浏览器不支持 SpeechSynthesis API。");
    return () => {};
  }
};

// 获取拼音
export const getPinyin = (text: string): string => {
  if (!text) return '';
  return pinyin(text, { toneType: 'num', separator: ' ' });
};

// 比较答案是否正确
export const checkAnswerCorrectness = (
  quizType: QuizType,
  selectedAnswer: string | string[],
  correctAnswer: string | string[] | undefined // 现在只处理 DanXuan 和 DuoXuan
): boolean => {
  if (correctAnswer === undefined || correctAnswer === null) return false;

  const normalizeString = (s: string) => s.trim().toUpperCase(); // 统一转大写，方便比较

  if (quizType === 'DanXuan') {
    return normalizeString(selectedAnswer as string) === normalizeString(correctAnswer as string);
  } else if (quizType === 'DuoXuan') {
    const selectedArr = Array.isArray(selectedAnswer) ? selectedAnswer.map(normalizeString).sort() : [];
    const correctArr = Array.isArray(correctAnswer) ? (correctAnswer as string[]).map(normalizeString).sort() : [];
    return JSON.stringify(selectedArr) === JSON.stringify(correctArr);
  }
  // 其他题型留待以后添加
  return false;
};
