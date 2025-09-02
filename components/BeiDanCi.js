// /components/BeiDanCi.js - 终极稳定版 v22 (基于v5，集成所有功能，移除宽度限制)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import TextToSpeechButton from './TextToSpeechButton'; // 导入朗读组件
import JumpToCardModal from './JumpToCarcModal'; // 导入页码跳转组件

/**
 * 背单词卡片组件 (Flashcard)
 * - 基于 v5 稳定版本，保证基础布局和数据加载正常。
 * - 彻底移除卡片宽度限制，使其能够占据父容器的全部宽度。
 * - 集成了语音识别、对错反馈、自动切换下一张。
 * - 集成页码跳转弹窗，并更新页码显示样式。
 * - 卡片背面支持词性、谐音、2个例句等新字段。
 * - 恢复 v5 的区域点击交互，移除额外箭头。
 */
const BeiDanCi = ({
  flashcards: flashcardsProp,
  questionTitle = '背单词',
  lang = 'zh-CN',
  backgroundImages: backgroundImagesProp = [],
  isShuffle: isShuffleProp = false,
  correctSoundUrl = '/sounds/correct.mp3', // 添加默认音效
  incorrectSoundUrl = '/sounds/wrong.mp3'
}) => {
  // --- State (基于 v5 结构) ---
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false); // 用于卡片切换动画
  const [displayFlashcards, setDisplayFlashcards] = useState([]);
  const [parsedBackgroundImages, setParsedBackgroundImages] = useState([]);
  const [internalIsShuffle, setInternalIsShuffle] = useState(false);

  // --- 新增功能相关 State ---
  const [isModalOpen, setIsModalOpen] = useState(false); // 控制页码跳转弹窗
  const [isListening, setIsListening] = useState(false); // 语音识别是否在进行
  const [recognizedText, setRecognizedText] = useState(''); // 语音识别结果
  const [feedback, setFeedback] = useState({ status: 'idle', message: '' }); // 语音识别反馈
  const [cardFeedbackClass, setCardFeedbackClass] = useState(''); // 卡片边框颜色反馈
  const autoAdvanceTimeoutRef = useRef(null); // 自动切换定时器

  const speechRecognitionRef = useRef(null); // 语音识别实例
  const correctAudioRef = useRef(null); // 正确音效
  const incorrectAudioRef = useRef(null); // 错误音效

  // --- Prop 解析和数据初始化 (严格遵循 v5 的稳定结构) ---
  useEffect(() => {
    let cards = [];
    if (typeof flashcardsProp === 'string') {
      try { cards = JSON.parse(flashcardsProp); } catch (e) { console.error("Error parsing flashcards JSON string:", e); cards = []; }
    } else if (Array.isArray(flashcardsProp)) { cards = flashcardsProp; }

    if (!cards || cards.length === 0) {
      setDisplayFlashcards([]);
      setCurrentIndex(0); // 确保在无数据时重置
      setShowBack(false);
      return;
    }

    // 处理洗牌逻辑
    setDisplayFlashcards(internalIsShuffle ? [...cards].sort(() => Math.random() - 0.5) : [...cards]);
    setCurrentIndex(0);
    setShowBack(false);
  }, [flashcardsProp, internalIsShuffle]);

  useEffect(() => {
    let images = [];
    if (typeof backgroundImagesProp === 'string') {
      try { images = JSON.parse(backgroundImagesProp); } catch (e) { console.error("Error parsing backgroundImages JSON string:", e); images = []; }
    } else if (Array.isArray(backgroundImagesProp)) { images = backgroundImagesProp; }
    setParsedBackgroundImages(images);
  }, [backgroundImagesProp]);

  useEffect(() => {
    setInternalIsShuffle(String(isShuffleProp) === 'true');
  }, [isShuffleProp]);

  // --- 语音识别和音频初始化 ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 初始化音效播放器
      correctAudioRef.current = new Audio(correctSoundUrl);
      incorrectAudioRef.current = new Audio(incorrectSoundUrl);

      // 初始化 Web Speech API
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false; // 非连续识别
        recognition.lang = lang; // 设置语言
        recognition.interimResults = false; // 不返回中间结果
        
        recognition.onstart = () => {
          setIsListening(true);
          setFeedback({ status: 'listening', message: '请说话...' });
        };
        recognition.onend = () => {
          setIsListening(false);
          // 如果识别结束但未收到结果，恢复为空闲状态
          setFeedback(prev => (prev.status === 'listening' ? { status: 'idle', message: '' } : prev));
        };
        recognition.onerror = (event) => {
           console.error('Speech recognition error:', event.error);
           setIsListening(false);
           setFeedback({ status: 'error', message: '识别出错' });
        };
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript.trim().replace(/[.,。，]/g, ''); // 移除标点
          setRecognizedText(transcript);
          
          const currentWord = displayFlashcards[currentIndex]?.word.trim();
          if (transcript === currentWord) {
            setFeedback({ status: 'correct', message: '正确' });
            correctAudioRef.current?.play();
            setCardFeedbackClass('border-green-500'); // 卡片边框变绿
            setTimeout(() => setShowBack(true), 200); // 延迟翻面
            // 答对后 4 秒自动切换下一张卡片
            autoAdvanceTimeoutRef.current = setTimeout(() => {
              handleNext(); // 调用切换下一张卡片的函数
            }, 4000);
          } else {
            setFeedback({ status: 'incorrect', message: '错误' });
            incorrectAudioRef.current?.play();
            setCardFeedbackClass('border-red-500'); // 卡片边框变红
          }
          // 无论对错，1.5 秒后清除边框颜色反馈
          setTimeout(() => setCardFeedbackClass(''), 1500);
        };
        speechRecognitionRef.current = recognition;
      } else {
        console.warn("此浏览器不支持语音识别功能。");
      }
    }
    // 组件卸载时，清除可能存在的自动切换定时器
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, correctSoundUrl, incorrectSoundUrl, displayFlashcards, currentIndex]); // 省略了 handleNext 依赖

  // --- 交互逻辑 (基于 v5，并增加了语音状态和自动切换重置) ---
  const handleToggleBack = useCallback(() => {
    // 关键：只允许从正面翻到背面 (单向)
    if (!showBack) {
      setShowBack(true);
    }
  }, [showBack]); // 依赖 showBack 确保最新状态

  const changeCard = (newIndex) => {
    if (isTransitioning || displayFlashcards.length === 0) return;
    
    // 切换卡片前，清除自动切换定时器
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
    }

    setIsTransitioning(true);
    setShowBack(false); // 确保新卡片从正面开始
    // 重置语音识别状态和反馈
    setRecognizedText('');
    setFeedback({ status: 'idle', message: '' });
    setCardFeedbackClass(''); // 清除卡片边框颜色
    if (speechRecognitionRef.current && isListening) {
      speechRecognitionRef.current.stop(); // 停止可能正在进行的语音识别
    }
    
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setIsTransitioning(false);
    }, 300); // 动画时长
  };

  // useCallback 包裹确保函数引用稳定，避免不必要的重新渲染
  const handleNext = useCallback(() => {
    const newIndex = (currentIndex + 1) % displayFlashcards.length;
    changeCard(newIndex);
  }, [currentIndex, displayFlashcards.length, changeCard]); // 依赖 changeCard

  const handlePrev = useCallback(() => {
    const newIndex = (currentIndex - 1 + displayFlashcards.length) % displayFlashcards.length;
    changeCard(newIndex);
  }, [currentIndex, displayFlashcards.length, changeCard]); // 依赖 changeCard

  // 处理语音识别按钮点击
  const handleListen = useCallback(() => {
    if (isListening || !speechRecognitionRef.current || displayFlashcards.length === 0) return;
    setRecognizedText('');
    setFeedback({ status: 'listening', message: '请说话...' }); // 立即显示提示信息
    speechRecognitionRef.current.start();
  }, [isListening, displayFlashcards.length]);

  // 页码跳转：关闭弹窗并跳转到指定卡片
  const handleJump = useCallback((index) => {
    changeCard(index);
    setIsModalOpen(false);
  }, [changeCard]);

  // 键盘事件监听 (来自 v5，增加了语音快捷键 'm')
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (displayFlashcards.length === 0 || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleToggleBack();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        handleListen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleToggleBack, handleListen, displayFlashcards.length]);

  // --- 渲染部分 ---
  const currentCard = displayFlashcards[currentIndex];
  // 如果没有背景图，则默认提供一个纯色背景，而不是完全透明
  const currentBackgroundImage = parsedBackgroundImages[currentIndex % parsedBackgroundImages.length] || '';
  const feedbackColor = feedback.status === 'correct' ? 'text-green-400' : 'text-red-400';

  // 如果没有卡片数据，显示提示
  if (!currentCard) {
    return (
      <div className="max-w-4xl mx-auto my-8 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700">
        <p className="text-lg font-semibold text-center text-gray-600 dark:text-gray-300">没有卡片数据。请检查 Notion 代码块或数据格式。</p>
      </div>
    );
  }

  return (
    // 关键修正：移除外层容器的 max-w 限制，让它尽可能宽
    <div className="w-full mx-auto my-8 p-4 bg-transparent"> 
      {isModalOpen && <JumpToCardModal total={displayFlashcards.length} current={currentIndex} onJump={handleJump} onClose={() => setIsModalOpen(false)} />}
      
      <h3 className="text-2xl sm:text-3xl font-extrabold mb-6 text-gray-800 dark:text-gray-100 text-center">
        {questionTitle}
      </h3>

      <div 
        className={`relative w-full overflow-hidden rounded-3xl shadow-2xl my-4 transition-all duration-500 border-4 border-transparent ${cardFeedbackClass}`}
        style={{ height: '550px', maxWidth: '700px', margin: '0 auto' }} // 恢复 v5 的固定尺寸，但取消了外层容器的 max-w 限制
      >
        {/* 背景图层 (来自 v5) */}
        {currentBackgroundImage ? (
            <div className="absolute inset-0 z-0 transition-opacity duration-500" style={{ backgroundImage: `url('${currentBackgroundImage}')`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: isTransitioning ? 0 : 1 }}>
              <div className="absolute inset-0 bg-black opacity-40 backdrop-blur-sm"></div> {/* 磨砂玻璃效果 */}
            </div>
        ) : (
            <div className="absolute inset-0 z-0 bg-gray-700 dark:bg-gray-900"></div> /* 纯色默认背景 */
        )}
        
        {/* 页码 (点击弹出跳转组件，无背景) */}
        <div 
          className="absolute top-4 right-5 z-40 text-white text-lg font-bold drop-shadow-lg cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
          onClick={() => setIsModalOpen(true)} // 点击打开跳转弹窗
        >
          {currentIndex + 1}<span className="text-white/50"> / {displayFlashcards.length}</span>
        </div>

        {/* 内容容器 */}
        <div className={`absolute inset-0 z-20 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          {/* 正面 */}
          <div className={`w-full h-full p-6 flex flex-col items-center justify-center text-center transition-opacity duration-300 ${showBack ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="flex-grow"></div>
            <p className="text-6xl sm:text-8xl font-bold text-white select-none flex items-center drop-shadow-lg">
              {currentCard.word}
              <TextToSpeechButton text={currentCard.word} lang={lang} className="ml-4 w-12 h-12 text-3xl" />
            </p>
            {/* 语音识别结果 (显示在单词下方) */}
            <div className="h-8 mt-4 text-xl font-semibold">
              {feedback.status !== 'idle' && <span className={feedbackColor}>{recognizedText || feedback.message}</span>}
            </div>
            <div className="flex-grow"></div>
          </div>

          {/* 背面 (已添加新字段和玻璃效果) */}
          <div className={`absolute inset-0 p-6 flex flex-col items-center justify-center transition-opacity duration-300 ${showBack ? 'opacity-100' : 'opacity-0 pointer-events-none'} text-white`}>
            <div onClick={e => e.stopPropagation()} className="w-full h-full max-h-full p-6 bg-black/30 rounded-2xl border border-white/10 backdrop-blur-sm overflow-y-auto custom-scrollbar">
              <div className="w-full max-w-sm mx-auto text-left">
                <div className="space-y-3">
                  <h4 className="text-4xl font-bold flex items-center">{currentCard.word}<TextToSpeechButton text={currentCard.word} lang={lang} className="ml-3 w-9 h-9 text-2xl" /></h4>
                  {currentCard.pinyin && <p className="text-xl text-yellow-300">{currentCard.pinyin}</p>}
                  {currentCard.partOfSpeech && <p className="flex items-center text-base text-gray-300"><i className="fa-solid fa-book-open w-5 text-center mr-2 text-gray-400"></i><span className="font-semibold mr-2">【词性】</span> {currentCard.partOfSpeech}</p>}
                  {currentCard.homophone && <p className="flex items-center text-base text-gray-300"><i className="fa-solid fa-ear-listen w-5 text-center mr-2 text-gray-400"></i><span className="font-semibold mr-2">【谐音】</span> {currentCard.homophone}</p>}
                  {currentCard.meaning && <p className="text-xl font-semibold flex items-center">{currentCard.meaning}<TextToSpeechButton text={currentCard.meaning} lang={lang} className="ml-3 w-7 h-7 text-lg" /></p>}
                </div>
                <hr className="my-6 border-white/20" />
                <div className="space-y-4">
                  <p className="flex items-center text-sm text-gray-400 font-semibold"><i className="fa-solid fa-quote-left w-5 text-center mr-2"></i> 【例句】</p>
                  {currentCard.example1 && <div>
                    <p className="text-lg flex items-start"><span className="flex-grow">{currentCard.example1}</span><TextToSpeechButton text={currentCard.example1} lang={lang} className="ml-2 shrink-0 w-6 h-6 text-base" /></p>
                    {currentCard.example1Translation && <p className="text-sm text-gray-400 italic mt-1">{currentCard.example1Translation}</p>}
                  </div>}
                  {currentCard.example2 && <div>
                    <p className="text-lg flex items-start"><span className="flex-grow">{currentCard.example2}</span><TextToSpeechButton text={currentCard.example2} lang={lang} className="ml-2 shrink-0 w-6 h-6 text-base" /></p>
                    {currentCard.example2Translation && <p className="text-sm text-gray-400 italic mt-1">{currentCard.example2Translation}</p>}
                  </div>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-0 z-30 grid grid-cols-4 grid-rows-3 pointer-events-none">
          <div className="col-span-full row-span-full pointer-events-auto cursor-pointer" onClick={handleToggleBack}></div>
          <div className="col-start-1 row-start-3 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePrev(); }}></div>
          <div className="col-start-4 row-start-3 pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); handleNext(); }}></div>
        </div>
        
        <button onClick={(e) => { e.stopPropagation(); handleListen(); }} disabled={isListening} className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-40 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 text-white text-2xl shadow-lg ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-500/80 hover:bg-blue-600'}`}>
            <i className="fas fa-microphone"></i>
        </button>
      </div>
    </div>
  );
};

export default BeiDanCi;
