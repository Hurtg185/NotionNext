// components/PronunciationChecker.js
'use client';

import { useState, useEffect } from 'react';

// 这个组件接收两个参数：正确的文本和学生识别出的文本
const PronunciationChecker = ({ correctText, studentText }) => {
  const [result, setResult] = useState({
    isCorrect: false,
    message: '等待学生发音...',
    correctPinyin: '',
    studentPinyin: '',
  });

  useEffect(() => {
    // 只有当学生有输入时才进行检查
    if (!studentText || !correctText) {
      return;
    }

    // 检查 pinyin-pro 库是否已经通过 CDN 加载完成
    if (typeof window.pinyinPro === 'undefined') {
      console.warn("拼音库 (pinyin-pro) 尚未加载，请稍候...");
      setResult(prev => ({ ...prev, message: '拼音库加载中...' }));
      return;
    }

    // 使用 pinyin-pro 库将文本转换为带声调的拼音
    // { toneType: 'symbol' } 表示输出带声调符号的拼音，如 pīn yīn
    const correctPinyin = window.pinyinPro.pinyin(correctText, { toneType: 'symbol' });
    const studentPinyin = window.pinyinPro.pinyin(studentText, { toneType: 'symbol' });

    // 比较两个拼音字符串是否完全一致
    if (correctPinyin === studentPinyin) {
      setResult({
        isCorrect: true,
        message: '发音非常标准，太棒了！',
        correctPinyin,
        studentPinyin,
      });
    } else {
      setResult({
        isCorrect: false,
        message: '发音不太准确，请注意红色部分的拼音差异。',
        correctPinyin,
        studentPinyin,
      });
    }
  }, [correctText, studentText]); // 当文本变化时，重新检查

  return (
    <div className="p-4 border rounded-lg bg-white/10 text-white">
      <h3 className="font-bold text-lg">发音分析结果</h3>
      <p className={`mt-2 font-semibold ${result.isCorrect ? 'text-green-400' : 'text-yellow-400'}`}>
        {result.message}
      </p>
      <div className="mt-4 text-sm">
        <p>
          <span className="font-semibold w-20 inline-block">标准发音:</span>
          <span className="ml-2 font-mono tracking-wider">{result.correctPinyin}</span>
        </p>
        <p className="mt-1">
          <span className="font-semibold w-20 inline-block">你的发音:</span>
          {/* 如果不正确，用红色高亮学生的发音 */}
          <span className={`ml-2 font-mono tracking-wider ${!result.isCorrect ? 'text-red-400' : ''}`}>
            {result.studentPinyin || '...'}
          </span>
        </p>
      </div>
    </div>
  );
};

export default PronunciationChecker;
