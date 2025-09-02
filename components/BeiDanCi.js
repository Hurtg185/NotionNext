// /components/BeiDanCi.js - 终极修复版 v11：彻底解决编译错误
import React, { useState, useEffect, useCallback, useRef } from 'react';
import TextToSpeechButton from './TextToSpeechButton'; // 确保此组件路径正确

/**
 * 背单词卡片组件 (Flashcard)
 * - 采用最新的单行JSON对象传参方式。
 * - 恢复并优化了经典的三区交互模型，解决了所有交互冲突。
 * - 融合了玻璃拟态视觉效果，并增强了学习流程的智能化。
 * - 优化数据加载逻辑，确保卡片数据可靠显示。
 */
const BeiDanCi = ({ data: dataProp }) => {
  // --- State 初始化 ---
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // --- 从JSON解析的配置State - 直接在这里初始化，确保渲染时有值 ---
  const [parsedFlashcards, setParsedFlashcards] = useState([]);
  const [questionTitle, setQuestionTitle] = useState('背单词');
  const [lang, setLang] = useState('zh-CN');
  const [backgroundImages, setBackgroundImages] = useState([]);
  const [correctSoundUrl, setCorrectSoundUrl] = useState('');
  const [incorrectSoundUrl, setIncorrectSoundUrl] = useState('');

  // --- 语音识别State ---
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [feedback, setFeedback] = useState({ status: 'idle', message: '' });

  // --- Refs ---
  const speechRecognitionRef = useRef(null);
  const correctAudioRef = useRef(null);
  const incorrectAudioRef = useRef(null);
  const isComponentMounted = useRef(false); // 用于防止在onend中设置已卸载组件的状态

  // --- Prop 解析与数据初始化 (关键步骤) ---
  useEffect(() => {
    isComponentMounted.current = true; // 标记组件已挂载
    if (!dataProp) {
        console.error("BeiDanCi component: 'data' prop is missing or empty.");
        setParsedFlashcards([]); // 清空卡片数据
        return;
    }
    try {
      const allProps = JSON.parse(dataProp);
      
      const cards = allProps.flashcards || [];
      const shuffled = String(allProps.isShuffle) === 'true'
        ? [...cards].sort(() => Math.random() - 0.5)
        : cards;
      
      // 直接更新各个独立的State，确保立刻生效
      setParsedFlashcards(shuffled);
      setQuestionTitle(allProps.questionTitle || '背单词');
      setLang(allProps.lang || 'zh-CN');
      setBackgroundImages(allProps.backgroundImages || []);
      setCorrectSoundUrl(allProps.correctSoundUrl || '');
      setIncorrectSoundUrl(allProps.incorrectSoundUrl || '');

      // 重置交互相关State
      setCurrentIndex(0);
      setShowBack(false);
      setFeedback({ status: 'idle', message: '' });
      setRecognizedText('');

    } catch (e) {
      console.error("BeiDanCi component: Error parsing 'data' JSON string.", e);
      setParsedFlashcards([]); // 解析失败时清空数据
    }

    return () => {
      isComponentMounted.current = false; // 标记组件已卸载
    };
  }, [dataProp]); // 仅当dataProp变化时重新解析

  // --- 初始化语音识别和音频对象 ---
  useEffect(() => {
    // 确保相关配置和数据已加载
    if (typeof window === 'undefined' || !lang || parsedFlashcards.length === 0) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = lang;
      recognition.interimResults = false;
      
      recognition.onstart = () => {
        if (isComponentMounted.current) {
          setIsListening(true);
          setFeedback({ status: 'listening', message: '请说话...' });
        }
      };

      recognition.onend = () => {
        if (isComponentMounted.current) {
          setIsListening(false);
          if (feedback.status === 'listening') {
             setFeedback({ status: 'idle', message: '' });
          }
        }
      };

      recognition.onerror = (event) => {
         console.error('Speech recognition error:', event.error);
         if (isComponentMounted.current) {
             setIsListening(false);
             setFeedback({ status: 'error', message: '识别出错' });
         }
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim().replace(/[.,。，]/g, '');
        const currentWord = parsedFlashcards[currentIndex]?.word.trim();
        if (isComponentMounted.current) { // 确保组件仍挂载
          setRecognizedText(transcript);
          
          if (transcript === currentWord) {
            setFeedback({ status: 'correct', message: '回答正确！' });
            correctAudioRef.current?.play();
            setTimeout(() => setShowBack(true), 100); 
          } else {
            setFeedback({ status: 'incorrect', message: '再试一次' });
            incorrectAudioRef.current?.play();
          }
        }
      };
      speechRecognitionRef.current = recognition;
    } else { 
      console.warn("此浏览器不支持语音识别功能。"); 
    }
    
    // 清理函数：组件卸载时停止识别
    return () => {
      if (speechRecognitionRef.current && isListening) {
        speechRecognitionRef.current.stop();
      }
    };
  }, [lang, parsedFlashcards, currentIndex, feedback.status, isListening]); // 简化依赖项

  // 单独处理音频 URL 的变化
  useEffect(() => {
    if (correctSoundUrl) correctAudioRef.current = new Audio(correctSoundUrl);
    if (incorrectSoundUrl) incorrectAudioRef.current = new Audio(incorrectSoundUrl);
  }, [correctSoundUrl, incorrectSoundUrl]);


  // --- 交互逻辑 ---
  const handleToggleBack = useCallback(() => setShowBack(prev => !prev), []);

  const changeCard = (newIndex) => {
    if (isTransitioning || parsedFlashcards.length === 0) return;
    setIsTransitioning(true);
    setShowBack(false);
    setRecognizedText('');
    setFeedback({ status: 'idle', message: '' });
    if (speechRecognitionRef.current && isListening) {
      speechRecognitionRef.current.stop();
    }
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setIsTransitioning(false);
    }, 200);
  };

  const currentCard = parsedFlashcards[currentIndex];
  const currentBackgroundImage = backgroundImages[currentIndex % backgroundImages.length] || '';
  
  const handleNext = useCallback(() => changeCard((currentIndex + 1) % parsedFlashcards.length), [currentIndex, parsedFlashcards.length, isTransitioning, changeCard]);
  const handlePrev = useCallback(() => changeCard((currentIndex - 1 + parsedFlashcards.length) % parsedFlashcards.length), [currentIndex, parsedFlashcards.length, isTransitioning, changeCard]);
  
  const handleListen = useCallback(() => {
    if (isListening || !speechRecognitionRef.current || !currentCard?.word) return; // 确保有当前单词才启动
    setRecognizedText('');
    setFeedback({ status: 'idle', message: '' });
    try {
      speechRecognitionRef.current.start();
    } catch(e) {
      console.error("Speech recognition could not start:", e);
      setFeedback({ status: 'error', message: '无法启动麦克风 (请检查权限)' }); // 修正：移除了多余的引号
    }
  }, [isListening, currentCard]);

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (parsedFlashcards.length === 0 || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleToggleBack(); }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); handleListen(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleToggleBack, handleListen, parsedFlashcards.length]);
  
  // --- 渲染部分 ---
  const feedbackBorderColor = () => {
    switch (feedback.status) {
      case 'correct': return 'border-green-500';
      case 'incorrect': return 'border-red-500';
      case 'listening': return 'border-blue-500';
      default: return 'border-gray-300 dark:border-gray-600';
    }
  };

  // 关键：在卡片数据准备好之前，显示加载状态
  if (parsedFlashcards.length === 0) {
    return (
      <div className="max-w-4xl mx-auto my-8 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700">
        <p className="text-center text-gray-600 dark:text-gray-300">正在加载或没有卡片数据... (请检查Notion代码块或数据格式)</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto my-8 p-4 bg-transparent">
      <h3 className="text-2xl sm:text-3xl font-extrabold mb-6 text-gray-800 dark:text-gray-100 text-center">{questionTitle}</h3>

      <div className="relative w-full overflow-hidden rounded-2xl shadow-xl my-4 touch-action-pan-y" style={{ height: '550px', maxWidth: '700px', margin: '0 auto' }}>
        {/* 背景图层 */}
        <div className="absolute inset-0 z-0 transition-opacity duration-500" style={{ backgroundImage: `url('${currentBackgroundImage}')`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: isTransitioning ? 0 : 1 }}>
          <div className="absolute inset-0 bg-black opacity-30"></div>
        </div>
        
        <div className={`absolute inset-0 z-10 transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          {/* 正面 */}
          <div className={`w-full h-full p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-all duration-300 ${showBack ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
            <p className="text-5xl sm:text-7xl font-bold leading-tight text-white select-none flex items-center drop-shadow-lg">
              {currentCard.word}
              <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 text-4xl sm:text-5xl drop-shadow-md" />
            </p>
            {currentCard.pinyin && <p className="text-xl sm:text-2xl text-white/80 mt-2 font-light select-none drop-shadow-md">{currentCard.pinyin}</p>}
          </div>

          {/* 背面 */}
          <div className={`absolute inset-0 p-6 sm:p-8 flex flex-col items-center justify-center transition-all duration-300 ease-in-out ${showBack ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'} text-white`}>
            <div onClick={e => e.stopPropagation()} className="w-full h-full max-h-full flex flex-col justify-center overflow-y-auto custom-scrollbar p-4 text-center bg-black/30 rounded-lg backdrop-blur-md border border-white/20">
              <div className="space-y-4">
                <h4 className="text-3xl sm:text-4xl font-extrabold flex items-center justify-center drop-shadow-md">{currentCard.word}<TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 text-3xl"/></h4>
                {currentCard.pinyin && <p className="text-xl sm:text-2xl flex items-center justify-center drop-shadow-sm text-yellow-300"><span className="font-semibold mr-2 text-white">拼音:</span>{currentCard.pinyin}<TextToSpeechButton text={currentCard.pinyin} lang={lang} className="ml-2"/></p>}
                {currentCard.meaning && <p className="text-xl sm:text-2xl flex items-center justify-center drop-shadow-sm"><span className="font-semibold mr-2">释义:</span>{currentCard.meaning}<TextToSpeechButton text={currentCard.meaning} lang={lang} className="ml-2"/></p>}
                {currentCard.example && <div className="mt-4 pt-4 border-t border-white/20"><p className="text-lg sm:text-xl italic flex items-start justify-center drop-shadow-sm"><span className="font-semibold not-italic mr-2">例句:</span>{currentCard.example}<TextToSpeechButton text={currentCard.example} lang={lang} className="ml-2 shrink-0"/></p>{currentCard.exampleTranslation && <p className="text-base sm:text-lg flex items-start justify-center drop-shadow-sm opacity-80 mt-2"><span className="font-semibold mr-2">翻译:</span>{currentCard.exampleTranslation}<TextToSpeechButton text={currentCard.exampleTranslation} lang={lang} className="ml-2 shrink-0"/></p>}</div>}
              </div>
            </div>
          </div>
        </div>
        
        {/* 交互覆盖层：左(1/5), 中(3/5), 右(1/5) */}
        <div className="absolute inset-x-0 bottom-0 h-1/4 z-20 grid grid-cols-5 pointer-events-none">
          <div className="col-span-1 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePrev(); }}></div>
          <div className="col-span-3 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); handleToggleBack(); }}></div>
          <div className="col-span-1 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); handleNext(); }}></div>
        </div>
      </div>
      
      {/* 语音识别和进度显示模块 */}
      <div className="flex justify-center items-center w-full max-w-4xl mx-auto mt-6 sm:mt-8 px-4 gap-3 sm:gap-5">
        <div className={`flex-grow h-14 bg-white dark:bg-gray-700 rounded-lg border-2 shadow-md transition-colors duration-300 ${feedbackBorderColor()}`}>
          <input type="text" readOnly value={recognizedText || feedback.message} placeholder="点击麦克风，说出单词" className="w-full h-full bg-transparent text-gray-800 dark:text-gray-200 text-center text-lg placeholder-gray-400 dark:placeholder-gray-500 outline-none"/>
        </div>
        <button onClick={handleListen} disabled={isListening} className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'} text-white text-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`} aria-label="开始语音识别">
          <i className="fas fa-microphone"></i>
        </button>
        <span className="text-gray-600 dark:text-gray-300 text-xl sm:text-2xl font-medium self-center w-20 text-center">{currentIndex + 1} / {parsedFlashcards.length}</span>
      </div>
    </div>
  );
};

export default BeiDanCi;
