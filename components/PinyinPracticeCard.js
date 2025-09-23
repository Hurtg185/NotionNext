// /components/PinyinPracticeCard.js - 最终独立版 (内置TTS, 无外部依赖)

"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';

// --- 常量与图标 ---
const CUBE_SIZE = 340;
const DRAG_BUFFER = 60;
const SpeakerIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>;
const MicIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;
const StopIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>;
const ArrowLeftIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>;
const ArrowRightIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>;

// --- [核心] 精细化拼音对比器 ---
const PronunciationChecker = ({ correctWord, studentText }) => {
  const [analysis, setAnalysis] = useState(null);
  const [isPinyinLibReady, setIsPinyinLibReady] = useState(false);

  useEffect(() => {
    if (typeof window.pinyinPro !== 'undefined') { setIsPinyinLibReady(true); return; }
    const intervalId = setInterval(() => {
      if (typeof window.pinyinPro !== 'undefined') {
        setIsPinyinLibReady(true);
        clearInterval(intervalId);
      }
    }, 200);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!isPinyinLibReady) { setAnalysis({ message: '拼音库加载中...' }); return; }
    if (!studentText || !correctWord) { setAnalysis(null); return; }

    const standardInfo = window.pinyinPro.pinyin(correctWord, { segment: 'beta', toneType: 'num' }).map(item => ({...item, initial: item.initial || ''}));
    const userInfo = window.pinyinPro.pinyin(studentText, { segment: 'beta', toneType: 'num' }).map(item => ({...item, initial: item.initial || ''}));
    setAnalysis({ standardInfo, userInfo });

  }, [correctWord, studentText, isPinyinLibReady]);

  if (!analysis) return null;

  return (
    <div className="pronunciation-checker">
      <h3 className="checker-title">发音分析</h3>
      {analysis.message ? (
        <p className="checker-message">{analysis.message}</p>
      ) : (
        <div className="checker-grid">
          {analysis.standardInfo.map((std, i) => {
            const user = analysis.userInfo[i] || { initial: '', final: '', tone: 0 };
            const initialCorrect = std.initial === user.initial;
            const finalCorrect = std.final === user.final;
            const toneCorrect = std.tone === user.tone;
            const isAllCorrect = initialCorrect && finalCorrect && toneCorrect;
            return (
              <div key={i} className={`syllable-analysis ${isAllCorrect ? 'all-correct' : ''}`}>
                <div className="syllable-parts">
                  <span className={initialCorrect ? 'correct' : 'error'}>{std.initial}</span>
                  <span className={finalCorrect ? 'correct' : 'error'}>{std.final}</span>
                </div>
                <div className={`tone-analysis ${toneCorrect ? 'correct' : 'error'}`}>
                  声调: {std.tone} vs {user.tone || '?'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- 主组件 ---
export default function PinyinPracticeCard({
  flashcards: flashcardsProp,
  questionTitle = '单词学习',
  lang = 'zh-CN',
  backgroundImages: backgroundImagesProp = [],
  isShuffle: isShuffleProp = false
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [displayFlashcards, setDisplayFlashcards] = useState([]);
  const [parsedBackgroundImages, setParsedBackgroundImages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  
  const rotateY = useMotionValue(0);
  const speechRecognitionRef = useRef(null);

  useEffect(() => {
    let cards = [];
    if (typeof flashcardsProp === 'string') { try { cards = JSON.parse(flashcardsProp); } catch (e) { console.error("解析卡片JSON失败", e); }
    } else if (Array.isArray(flashcardsProp)) { cards = flashcardsProp; }
    const shuffle = String(isShuffleProp) === 'true';
    setDisplayFlashcards(shuffle ? [...cards].sort(() => Math.random() - 0.5) : cards);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [flashcardsProp, isShuffleProp]);

  useEffect(() => {
    let images = [];
    if (typeof backgroundImagesProp === 'string') { try { images = JSON.parse(backgroundImagesProp); } catch (e) { console.error("解析图片JSON失败", e); }
    } else if (Array.isArray(backgroundImagesProp)) { images = backgroundImagesProp; }
    setParsedBackgroundImages(images);
  }, [backgroundImagesProp]);
  
  const currentCard = useMemo(() => displayFlashcards[currentIndex], [displayFlashcards, currentIndex]);

  const handleSwipe = useCallback((direction) => {
    if (displayFlashcards.length === 0) return;
    setIsFlipped(false);
    setRecognizedText('');
    const newIndex = (currentIndex + direction + displayFlashcards.length) % displayFlashcards.length;
    setCurrentIndex(newIndex);
  }, [currentIndex, displayFlashcards.length]);

  useEffect(() => {
    animate(rotateY, -currentIndex * 90, { type: 'spring', stiffness: 250, damping: 30 });
  }, [currentIndex, rotateY]);

  const bind = useDrag(({ down, movement: [mx], velocity: [vx], memo, last, event }) => {
    if (event.target.closest('button')) return;
    if (down) { rotateY.set(memo + mx); }
    else {
      if (last) {
        if (Math.abs(mx) > DRAG_BUFFER || Math.abs(vx) > 0.4) { handleSwipe(mx > 0 ? -1 : 1); }
        else { animate(rotateY, -currentIndex * 90, { type: 'spring', stiffness: 250, damping: 30 }); }
      }
    }
    return rotateY.get();
  }, { from: () => rotateY.get() });
  
  const playTTS = useCallback((text) => {
    const params = new URLSearchParams({ t: text.trim(), v: 'zh-CN-XiaochenMultilingualNeural', r: '-20%' });
    new Audio(`https://t.leftsite.cn/tts?${params.toString()}`).play().catch(console.error);
  }, []);

  const handleMicClick = useCallback(() => {
    if (isListening) { speechRecognitionRef.current?.stop(); return; }
    if (speechRecognitionRef.current) { speechRecognitionRef.current.start(); return; }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (e) => console.error('语音识别错误:', e.error);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        setRecognizedText(transcript);
      };
      speechRecognitionRef.current = recognition;
      recognition.start();
    }
  }, [isListening, lang]);

  if (!currentCard) {
    return (
      <div className="study-pro-container">
        <p className="loading-text">正在加载卡片...</p>
      </div>
    );
  }

  return (
    <div className="study-pro-container">
      <h2 className="study-pro-title">{questionTitle}</h2>
      
      <div className="study-pro-scene" {...bind()}>
        <motion.div className="study-pro-cube" style={{ rotateY, width: CUBE_SIZE, height: CUBE_SIZE }}>
          {displayFlashcards.map((card, i) => {
            const image = parsedBackgroundImages[i % parsedBackgroundImages.length] || card.image;
            return (
              <div key={card.word + i} className="study-pro-face-wrapper" style={{ transform: `rotateY(${i * 90}deg) translateZ(${CUBE_SIZE / 2}px)` }}>
                <div className="study-pro-flipper" onClick={() => i === currentIndex && setIsFlipped(f => !f)}>
                  <motion.div className="study-pro-cardface front" style={{ backgroundImage: `url(${image})`, transform: (i === currentIndex && isFlipped) ? 'rotateY(180deg)' : 'rotateY(0deg)'}}>
                    <div className="study-pro-overlay" />
                    <p className="study-pro-pinyin">{window.pinyinPro?.pinyin(card.word) || card.pinyin}</p>
                    <p className="study-pro-word">{card.word}</p>
                    <div className="tts-button-corner">
                      <button onClick={(e) => { e.stopPropagation(); playTTS(card.word); }}><SpeakerIcon /></button>
                    </div>
                  </motion.div>
                  <motion.div className="study-pro-cardface back" style={{transform: (i === currentIndex && isFlipped) ? 'rotateY(0deg)' : 'rotateY(-180deg)'}}>
                    <p className="study-pro-meaning">{card.meaning}</p>
                    {card.example && <p className="study-pro-example">{card.example}</p>}
                  </motion.div>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      <div className="study-pro-controls">
        <button className="arrow-btn" onClick={() => handleSwipe(-1)}><ArrowLeftIcon /></button>
        <button className={`mic-btn ${isListening ? 'listening' : ''}`} onClick={handleMicClick}>
          {isListening ? <StopIcon /> : <MicIcon />}
        </button>
        <button className="arrow-btn" onClick={() => handleSwipe(1)}><ArrowRightIcon /></button>
      </div>
      
      {recognizedText && <PronunciationChecker correctWord={currentCard?.word} studentText={recognizedText} />}
    </div>
  );
  }
