// /components/BeiDanCi.js - 美化增强版 v13：恢复美观与功能
import React, { useState, useEffect, useCallback, useRef } from 'react';
import TextToSpeechButton from './TextToSpeechButton'; // 确保此组件路径正确

/**
 * 美化增强版背单词卡片组件
 * 恢复所有设计和功能优化，包括背景图、玻璃拟态、优化播放按钮、自动翻面等。
 */
const BeiDanCi = ({ data: dataProp }) => {
  // --- State 初始化 ---
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 默认配置和卡片数据，即使JSON解析失败也能显示
  const [flashcards, setFlashcards] = useState([
    { word: "你好", pinyin: "nǐ hǎo", meaning: "Hello", example: "你好，世界。", exampleTranslation: "Hello, world." },
    { word: "测试", pinyin: "cè shì", meaning: "Test", example: "这是一个测试。", exampleTranslation: "This is a test." }
  ]);
  const [questionTitle, setQuestionTitle] = useState('精简背单词');
  const [lang, setLang] = useState('zh-CN');
  const [backgroundImages, setBackgroundImages] = useState([]);
  const [correctSoundUrl, setCorrectSoundUrl] = useState('/sounds/correct.mp3'); // 默认值
  const [incorrectSoundUrl, setIncorrectSoundUrl] = useState('/sounds/wrong.mp3'); // 默认值

  // 语音识别和音频
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [feedback, setFeedback] = useState({ status: 'idle', message: '' }); // idle, listening, correct, incorrect
  
  const speechRecognitionRef = useRef(null);
  const correctAudioRef = useRef(null);
  const incorrectAudioRef = useRef(null);
  const isComponentMounted = useRef(false);

  // --- 数据解析与 State 设置 ---
  useEffect(() => {
    isComponentMounted.current = true;
    let parsedData = {};
    if (dataProp) {
        try {
            parsedData = JSON.parse(dataProp);
        } catch (e) {
            console.error("BeiDanCi component: Error parsing 'data' JSON string.", e);
            // 保持flashcards为默认值
        }
    }

    // 更新配置，如果传入数据有效则使用，否则保持默认
    const newFlashcards = (parsedData.flashcards && parsedData.flashcards.length > 0) 
                          ? parsedData.flashcards 
                          : [{ word: "你好", pinyin: "nǐ hǎo", meaning: "Hello", example: "你好，世界。", exampleTranslation: "Hello, world." },{ word: "测试", pinyin: "cè shì", meaning: "Test", example: "这是一个测试。", exampleTranslation: "This is a test." }]; // 确保这里有默认值

    const finalFlashcards = String(parsedData.isShuffle) === 'true'
                            ? [...newFlashcards].sort(() => Math.random() - 0.5)
                            : newFlashcards;
    
    setFlashcards(finalFlashcards);
    setQuestionTitle(parsedData.questionTitle || '精简背单词');
    setLang(parsedData.lang || 'zh-CN');
    setBackgroundImages(parsedData.backgroundImages || []); // 恢复背景图
    setCorrectSoundUrl(parsedData.correctSoundUrl || '/sounds/correct.mp3');
    setIncorrectSoundUrl(parsedData.incorrectSoundUrl || '/sounds/wrong.mp3');
    
    // 重置交互状态
    setCurrentIndex(0);
    setShowBack(false);
    setFeedback({ status: 'idle', message: '' });
    setRecognizedText('');

    return () => {
      isComponentMounted.current = false;
    };
  }, [dataProp]); // 仅在dataProp变化时重新解析

  // --- 语音识别初始化 ---
  useEffect(() => {
    if (typeof window === 'undefined' || !lang) return;

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
        const currentWord = flashcards[currentIndex]?.word.trim();
        if (isComponentMounted.current) {
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
    
    return () => {
      if (speechRecognitionRef.current && isListening) {
        speechRecognitionRef.current.stop();
      }
    };
  }, [lang, flashcards, currentIndex, feedback.status, isListening]);


  // 单独处理音频 URL 的变化
  useEffect(() => {
    if (correctSoundUrl) correctAudioRef.current = new Audio(correctSoundUrl);
    if (incorrectSoundUrl) incorrectAudioRef.current = new Audio(incorrectSoundUrl);
  }, [correctSoundUrl, incorrectSoundUrl]);


  // --- 交互逻辑 ---
  const handleToggleBack = useCallback(() => setShowBack(prev => !prev), []);

  const changeCard = (newIndex) => {
    if (isTransitioning || flashcards.length === 0) return;
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
  
  const handleNext = useCallback(() => changeCard((currentIndex + 1) % flashcards.length), [currentIndex, flashcards.length, isTransitioning, changeCard]);
  const handlePrev = useCallback(() => changeCard((currentIndex - 1 + flashcards.length) % flashcards.length), [currentIndex, flashcards.length, isTransitioning, changeCard]);
  
  const handleListen = useCallback(() => {
    if (isListening || !speechRecognitionRef.current || !flashcards[currentIndex]?.word) return;
    setRecognizedText('');
    setFeedback({ status: 'idle', message: '' });
    try {
      speechRecognitionRef.current.start();
    } catch(e) {
      console.error("Speech recognition could not start:", e);
      setFeedback({ status: 'error', message: '无法启动麦克风 (请检查权限)' });
    }
  }, [isListening, currentIndex, flashcards]);

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (flashcards.length === 0 || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleToggleBack(); }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); handleListen(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleToggleBack, handleListen, flashcards.length]);
  
  // --- 渲染部分 ---
  const currentCard = flashcards[currentIndex];
  // 如果没有背景图，则默认提供一个纯色背景，而不是完全透明
  const currentBackgroundImage = backgroundImages[currentIndex % backgroundImages.length] || ''; 

  const feedbackBorderColor = () => {
    switch (feedback.status) {
      case 'correct': return 'border-green-500';
      case 'incorrect': return 'border-red-500';
      case 'listening': return 'border-blue-500';
      default: return 'border-gray-300 dark:border-gray-600'; 
    }
  };

  // 如果卡片数据为空，但不是由于解析错误（即有默认数据），则显示默认卡片
  // 否则，如果连默认数据都没有，那才显示“无数据”提示 (这种情况在有默认值后基本不会出现)
  if (!currentCard) {
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
        {currentBackgroundImage ? (
            <div className="absolute inset-0 z-0 transition-opacity duration-500" style={{ backgroundImage: `url('${currentBackgroundImage}')`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: isTransitioning ? 0 : 1 }}>
              <div className="absolute inset-0 bg-black opacity-30"></div> {/* 蒙版 */}
            </div>
        ) : (
            <div className="absolute inset-0 z-0 bg-gray-700 dark:bg-gray-900"></div> /* 纯色默认背景 */
        )}
        
        {/* 内容容器 */}
        <div className={`absolute inset-0 z-10 transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          {/* 正面 */}
          <div className={`w-full h-full p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-all duration-300 ${showBack ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
            <p className="text-5xl sm:text-7xl font-bold leading-tight text-white select-none flex items-center drop-shadow-lg">
              {currentCard.word}
              {/* 美化后的播放按钮 */}
              <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors duration-200"/>
            </p>
            {currentCard.pinyin && <p className="text-xl sm:text-2xl text-white/80 mt-2 font-light select-none drop-shadow-md">{currentCard.pinyin}</p>}
          </div>

          {/* 背面 */}
          <div className={`absolute inset-0 p-6 sm:p-8 flex flex-col items-center justify-center transition-all duration-300 ease-in-out ${showBack ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'} text-white`}>
            <div onClick={e => e.stopPropagation()} className="w-full h-full max-h-full flex flex-col justify-center overflow-y-auto custom-scrollbar p-4 text-center bg-black/30 rounded-lg backdrop-blur-md border border-white/20">
              <div className="space-y-4">
                <h4 className="text-3xl sm:text-4xl font-extrabold flex items-center justify-center drop-shadow-md">
                    {currentCard.word}
                    <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors duration-200"/>
                </h4>
                {currentCard.pinyin && <p className="text-xl sm:text-2xl flex items-center justify-center drop-shadow-sm text-yellow-300"><span className="font-semibold mr-2 text-white">拼音:</span>{currentCard.pinyin}<TextToSpeechButton text={currentCard.pinyin} lang={lang} className="ml-2 w-6 h-6 flex items-center justify-center text-yellow-300/70 hover:text-yellow-300 transition-colors duration-200"/></p>}
                {currentCard.meaning && <p className="text-xl sm:text-2xl flex items-center justify-center drop-shadow-sm"><span className="font-semibold mr-2">释义:</span>{currentCard.meaning}<TextToSpeechButton text={currentCard.meaning} lang={lang} className="ml-2 w-6 h-6 flex items-center justify-center text-white/70 hover:text-white transition-colors duration-200"/></p>}
                {currentCard.example && <div className="mt-4 pt-4 border-t border-white/20"><p className="text-lg sm:text-xl italic flex items-start justify-center drop-shadow-sm"><span className="font-semibold not-italic mr-2">例句:</span>{currentCard.example}<TextToSpeechButton text={currentCard.example} lang={lang} className="ml-2 shrink-0 w-6 h-6 flex items-center justify-center text-white/70 hover:text-white transition-colors duration-200"/></p>{currentCard.exampleTranslation && <p className="text-base sm:text-lg flex items-start justify-center drop-shadow-sm opacity-80 mt-2"><span className="font-semibold mr-2">翻译:</span>{currentCard.exampleTranslation}<TextToSpeechButton text={currentCard.exampleTranslation} lang={lang} className="ml-2 shrink-0 w-6 h-6 flex items-center justify-center text-white/70 hover:text-white transition-colors duration-200"/></p>}</div>}
              </div>
            </div>
          </div>
        </div>
        
        {/* 交互覆盖层：左下(1/5), 中下(3/5), 右下(1/5) - 区域精确化 */}
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
        <span className="text-gray-600 dark:text-gray-300 text-xl sm:text-2xl font-medium self-center w-20 text-center">{currentIndex + 1} / {flashcards.length}</span>
      </div>
    </div>
  );
};

export default BeiDanCi;
