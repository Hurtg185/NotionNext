import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { FaVolumeUp, FaCheck, FaTimes, FaArrowRight, FaLightbulb, FaSpinner } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

/* ===== IndexedDB / audioController / cssStyles
   ⚠️ 这三块我没有动，你原样保留即可
===== */

const XuanZeTi = ({ data: rawData, onCorrect, onIncorrect, onNext }) => {
  const data = rawData?.content || rawData || {};
  const question = data.question || {};
  const questionText = typeof question === 'string' ? question : question.text || '';
  const options = data.options || [];

  const correctAnswers = useMemo(() => {
    const raw = data.correctAnswer || [];
    return (Array.isArray(raw) ? raw : [raw]).map(String);
  }, [data.correctAnswer]);

  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRight, setIsRight] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  /** ✅ 防止重复下一题 */
  const nextLockRef = useRef(false);

  /** ✅ 题目切换时统一 reset */
  useEffect(() => {
    nextLockRef.current = false;
    setSelectedIds([]);
    setIsSubmitted(false);
    setIsRight(false);

    audioController.stop();
    audioController.playMixed(
      questionText,
      {},
      () => setIsPlaying(true),
      () => setIsPlaying(false)
    );
  }, [data?.id]); // ❗关键修复点

  const toggleOption = (id) => {
    if (isSubmitted) return;
    const sid = String(id);
    setSelectedIds(prev =>
      prev.includes(sid) ? prev.filter(i => i !== sid) : [...prev, sid]
    );

    const opt = options.find(o => String(o.id) === sid);
    if (opt) audioController.playMixed(opt.text);
  };

  const handleSubmit = () => {
    if (!selectedIds.length) return;

    const correct =
      selectedIds.length === correctAnswers.length &&
      selectedIds.every(id => correctAnswers.includes(id));

    setIsRight(correct);
    setIsSubmitted(true);

    if (correct) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
      new Audio('https://audio.886.best/chinese-vocab-audio/correct.mp3').play().catch(() => {});
    } else {
      navigator.vibrate?.(200);
      new Audio('https://audio.886.best/chinese-vocab-audio/incorrect.mp3').play().catch(() => {});
    }
  };

  const safeNext = () => {
    if (nextLockRef.current) return;
    nextLockRef.current = true;

    audioController.stop();

    if (isRight) onCorrect?.();
    else onIncorrect?.();

    onNext?.();
  };

  const renderRichText = (text) => {
    const parts = text.match(/([\u4e00-\u9fa5]+|[^\u4e00-\u9fa5]+)/g) || [];
    return parts.map((part, i) => {
      if (/[\u4e00-\u9fa5]/.test(part)) {
        const py = pinyin(part, { type: 'array', toneType: 'symbol' });
        return part.split('').map((char, j) => (
          <div key={`${i}-${j}`} className="zh-seg">
            <span className="zh-py">{py[j]}</span>
            <span className="zh-char">{char}</span>
          </div>
        ));
      }
      return <span key={i} className="my-seg">{part}</span>;
    });
  };

  return (
    <div className="xzt-container">
      <style>{cssStyles}</style>

      <div className="xzt-scroll-area">
        <div className="scene-wrapper">
          <img
            src="https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/1765952194374.png"
            className="teacher-img"
            alt="Teacher"
          />
          <div className="bubble-container">
            <div className="bubble-tail" />
            <div className="flex flex-wrap items-end">
              {renderRichText(questionText)}
            </div>
            <div
              className={`mt-2 self-end p-2 rounded-full ${
                isPlaying ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-500'
              }`}
              onClick={() =>
                audioController.playMixed(
                  questionText,
                  {},
                  () => setIsPlaying(true),
                  () => setIsPlaying(false)
                )
              }
            >
              {isPlaying ? <FaSpinner className="animate-spin" /> : <FaVolumeUp />}
            </div>
          </div>
        </div>

        <div className="options-grid">
          {options.map(opt => {
            const sid = String(opt.id);
            const isSel = selectedIds.includes(sid);
            const isCorrect = correctAnswers.includes(sid);

            let cls = 'option-card';
            if (isSubmitted) {
              if (isCorrect) cls += ' correct';
              else if (isSel) cls += ' wrong';
            } else if (isSel) cls += ' selected';

            return (
              <div key={sid} className={cls} onClick={() => toggleOption(sid)}>
                <div>{opt.text}</div>
              </div>
            );
          })}
        </div>
      </div>

      {!isSubmitted && (
        <div className="submit-bar">
          <button className="submit-btn" disabled={!selectedIds.length} onClick={handleSubmit}>
            提交
          </button>
        </div>
      )}

      <div className={`result-sheet ${isSubmitted ? 'show' : ''} ${isRight ? 'is-correct' : 'is-wrong'}`}>
        <div className="flex items-center gap-3 text-xl font-black mb-4">
          {isRight ? <FaCheck /> : <FaTimes />}
          {isRight ? '正确' : '错误'}
        </div>

        <button className="next-btn" onClick={safeNext}>
          下一题 <FaArrowRight />
        </button>
      </div>
    </div>
  );
};

export default XuanZeTi;
