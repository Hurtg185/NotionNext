// components/WordCard.js

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import {
    FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown,
    FaHeart, FaRegHeart, FaPlayCircle, FaStop, FaVolumeUp, FaRedo,
    FaHome
} from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// --- 数据库和辅助函数 ---
const DB_NAME = 'ChineseLearningDB';
const STORE_NAME = 'favoriteWords';

function openDB() {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') return reject("Server side");
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject('Database Error');
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

async function toggleFavorite(word) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const existing = await new Promise((resolve) => {
            const getReq = store.get(word.id);
            getReq.onsuccess = () => resolve(getReq.result);
            getReq.onerror = () => resolve(null);
        });
        if (existing) {
            store.delete(word.id);
            return false;
        } else {
            const wordToStore = { ...word };
            store.put(wordToStore);
            return true;
        }
    } catch (e) { return false; }
}

async function isFavorite(id) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        return new Promise((resolve) => {
            const getReq = store.get(id);
            getReq.onsuccess = () => resolve(!!getReq.result);
            getReq.onerror = () => resolve(false);
        });
    } catch (e) { return false; }
}

const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: 'တရုတ် (အမျိုးသမီး)' },
    { value: 'zh-CN-XiaoyouNeural', label: 'တရုတ် (အမျိုးသမီး - ကလေး)' },
    { value: 'my-MM-NilarNeural', label: 'ဗမာ (အမျိုးသမီး)' },
    { value: 'my-MM-ThihaNeural', label: 'ဗမာ (အမျိုးသား)' },
];

let sounds = null;
let _howlInstance = null;

// 全局停止音频函数
const stopAllAudio = () => {
    if (_howlInstance) {
        _howlInstance.stop();
        _howlInstance.unload();
        _howlInstance = null;
    }
    if (sounds) {
        Object.values(sounds).forEach(s => s.stop());
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
};

const initSounds = () => {
    if (!sounds && typeof window !== 'undefined') {
        sounds = {
            switch: new Howl({ src: ['/sounds/switch-card.mp3'], volume: 0.5 }),
            correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }),
            incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.8 }),
        };
    }
};

/**
 * 🔥 核心修改：TTS 播放逻辑 (GET 请求 + CF 缓存代理)
 */
const playTTS = async (text, voice, rate, onEndCallback, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    stopAllAudio();

    if (!text || !voice) {
        if (onEndCallback) onEndCallback();
        return;
    }

    // 1. 将参数转换为 GET 查询字符串
    // t = text, v = voice, r = rate
    const rateValue = Math.round(rate / 2);
    const apiUrl = `/api/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rateValue}`;

    try {
        // 2. 发送 GET 请求 (Cloudflare 只缓存 GET)
        const response = await fetch(apiUrl);

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        _howlInstance = new Howl({
            src: [audioUrl],
            format: ['mpeg'],
            html5: true,
            onend: () => {
                URL.revokeObjectURL(audioUrl);
                if (onEndCallback) onEndCallback();
            },
            onloaderror: () => { URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); },
            onplayerror: () => { URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); }
        });

        _howlInstance.play();
    } catch (error) {
        // 兜底方案：使用浏览器自带语音
        if (typeof window !== 'undefined' && window.speechSynthesis) {
             const u = new SpeechSynthesisUtterance(text);
             u.lang = voice.includes('my') ? 'my-MM' : 'zh-CN';
             u.rate = rate >= 0 ? 1 + (rate / 100) : 1 + (rate / 200);
             u.onend = () => { if(onEndCallback) onEndCallback(); };
             u.onerror = () => { if(onEndCallback) onEndCallback(); };
             window.speechSynthesis.speak(u);
        } else {
             if (onEndCallback) onEndCallback();
        }
    }
};

// 播放R2音频文件的函数
const playR2Audio = (word, onEndCallback, settings, defaultLevel) => {
    const targetLevel = word.hsk_level || defaultLevel;

    if (!word || !word.id || !targetLevel) {
        const textToRead = word.audioText || word.chinese;
        playTTS(textToRead, settings.voiceChinese, settings.speechRateChinese, onEndCallback);
        return;
    }

    stopAllAudio();

    const formattedId = String(word.id).padStart(4, '0');
    const audioSrc = `https://audio.886.best/chinese-vocab-audio/hsk${targetLevel}/${formattedId}.mp3`;

    _howlInstance = new Howl({
        src: [audioSrc],
        html5: true,
        onend: () => {
            if (onEndCallback) onEndCallback();
        },
        onloaderror: (id, err) => {
            const textToRead = word.audioText || word.chinese;
            playTTS(textToRead, settings.voiceChinese, settings.speechRateChinese, onEndCallback);
        },
        onplayerror: (id, err) => {
            if (onEndCallback) onEndCallback();
        }
    });

    _howlInstance.play();
};

const playSoundEffect = (type) => {
    if (typeof window === 'undefined') return;
    initSounds();
    stopAllAudio();
    if (sounds && sounds[type]) sounds[type].play();
};

/**
 * 🔥 核心修复：防止 Hydration Error (418/423)
 */
const useCardSettings = () => {
    const defaultSettings = {
        order: 'sequential', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, autoBrowse: false, autoBrowseDelay: 6000, voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', speechRateChinese: -60, speechRateBurmese: -60, backgroundImage: ''
    };

    const [settings, setSettings] = useState(defaultSettings);

    // 只有在客户端加载后才读取 localStorage
    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem('learningWordCardSettings');
            if (savedSettings) {
                setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
            }
        } catch (e) { console.error("Load settings error", e); }
    }, []);

    // 保存设置
    useEffect(() => {
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem('learningWordCardSettings', JSON.stringify(settings));
            }
        } catch (e) { }
    }, [settings]);

    return [settings, setSettings];
};

// =================================================================================
// 拼读组件
// =================================================================================
const SpellingModal = ({ wordObj, settings, level, onClose }) => {
    const [status, setStatus] = useState('');
    const isStoppingRef = useRef(false);
    const preloadedSounds = useRef({});
    const word = wordObj.chinese;

    useEffect(() => {
        const urlsToPreload = new Set();
        if (word) {
            word.split('').forEach(char => {
                const pData = pinyinConverter(char, { type: 'all', toneType: 'symbol', multiple: false })[0];
                if (pData && pData.pinyin) {
                    const encodedFilename = encodeURIComponent(pData.pinyin);
                    urlsToPreload.add(`https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodedFilename}.mp3`);
                }
            });
        }
        preloadedSounds.current = {};
        urlsToPreload.forEach(url => {
            preloadedSounds.current[url] = new Howl({ src: [url], html5: true, preload: true });
        });
        return () => {
            Object.values(preloadedSounds.current).forEach(sound => sound.unload());
        };
    }, [word]);

    const playPreloadedAudio = (filename) => {
        return new Promise((resolve) => {
            if (isStoppingRef.current) { resolve(); return; }
            stopAllAudio();
            const encodedFilename = encodeURIComponent(filename);
            const audioSrc = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodedFilename}.mp3`;
            const sound = preloadedSounds.current[audioSrc];
            if (sound) {
                sound.once('end', resolve);
                sound.once('loaderror', resolve);
                _howlInstance = sound;
                sound.play();
            } else {
                const fallbackSound = new Howl({ src: [audioSrc], html5: true, onend: resolve, onloaderror: resolve });
                _howlInstance = fallbackSound;
                fallbackSound.play();
            }
        });
    };

    const startSpelling = useCallback(async () => {
        if (!word) return;
        isStoppingRef.current = false;
        await new Promise(r => setTimeout(r, 100));
        const chars = word.split('');
        for (let i = 0; i < chars.length; i++) {
            if (isStoppingRef.current) break;
            const char = chars[i];
            const pData = pinyinConverter(char, { type: 'all', toneType: 'symbol', multiple: false })[0];
            setStatus(`${i}-full`);
            await playPreloadedAudio(pData.pinyin);
            await new Promise(r => setTimeout(r, 250));
        }
        if (!isStoppingRef.current) {
            setStatus('all-full');
            await new Promise(resolve => playR2Audio(wordObj, resolve, settings, level));
        }
        if (!isStoppingRef.current) { setTimeout(onClose, 1200); }
    }, [word, wordObj, settings, level, onClose]);

    useEffect(() => { startSpelling(); return () => { isStoppingRef.current = true; stopAllAudio(); }; }, [startSpelling]);

    return (
        <div style={styles.comparisonOverlay} onClick={onClose}>
            <div style={{...styles.comparisonPanel, maxWidth: '400px'}} onClick={e => e.stopPropagation()}>
                <div style={styles.recordHeader}><h3>ပေါင်း၍ဖတ်ခြင်း (拼读演示)</h3><button style={styles.closeButtonSimple} onClick={onClose}><FaTimes /></button></div>
                <div style={{...styles.recordContent, justifyContent: 'center'}}>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center'}}>
                        {word && word.split('').map((char, index) => {
                            const pData = pinyinConverter(char, { type: 'all', toneType: 'symbol', multiple: false })[0];
                            const initial = pData.initial;
                            const fullPinyin = pData.pinyin;
                            const finalPart = initial ? fullPinyin.replace(initial, '') : fullPinyin;
                            const isActive = status === `${index}-full` || status === 'all-full';
                            const color = isActive ? '#ef4444' : '#9ca3af';
                            return (
                                <div key={index} style={{textAlign: 'center'}}>
                                    <div style={{fontSize: '1.4rem', marginBottom: '8px', height: '30px', fontFamily: 'Roboto, Arial'}}>
                                        {initial && (<span style={{color: color, fontWeight: isActive ? 'bold' : 'normal'}}>{initial}</span>)}
                                        <span style={{color: color, fontWeight: isActive ? 'bold' : 'normal'}}>{finalPart}</span>
                                    </div>
                                    <div style={{fontSize: '3rem', fontWeight: 'bold', color: isActive ? '#2563eb' : '#1f2937'}}>{char}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

// 录音对比、设置、跳转组件 (保持逻辑)
const PronunciationComparison = ({ correctWord, settings, onClose }) => {
    const [status, setStatus] = useState('idle'); const [userAudioUrl, setUserAudioUrl] = useState(null); const mediaRecorderRef = useRef(null); const streamRef = useRef(null); const localAudioRef = useRef(null);
    useEffect(() => { return () => { if (userAudioUrl) URL.revokeObjectURL(userAudioUrl); if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); stopAllAudio(); }; }, [userAudioUrl]);
    const startRecording = async () => { stopAllAudio(); try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream; const recorder = new MediaRecorder(stream); const chunks = []; recorder.ondataavailable = e => chunks.push(e.data); recorder.onstop = () => { const blob = new Blob(chunks, { type: 'audio/webm' }); const url = URL.createObjectURL(blob); setUserAudioUrl(url); setStatus('review'); }; mediaRecorderRef.current = recorder; recorder.start(); setStatus('recording'); } catch (err) { alert("麦克风启动失败"); } };
    const stopRecording = () => { if (mediaRecorderRef.current) mediaRecorderRef.current.stop(); };
    const resetRecording = () => { if (userAudioUrl) URL.revokeObjectURL(userAudioUrl); setUserAudioUrl(null); setStatus('idle'); };
    const playStandard = () => playTTS(correctWord, settings.voiceChinese, settings.speechRateChinese);
    const playUser = () => { if (!userAudioUrl) return; stopAllAudio(); localAudioRef.current = new Howl({ src: [userAudioUrl], format: ['webm'], html5: true }); localAudioRef.current.play(); };
    return (
        <div style={styles.comparisonOverlay} onClick={onClose}>
            <div style={styles.comparisonPanel} onClick={e => e.stopPropagation()}>
                <div style={styles.recordHeader}><h3>အသံထွက် လေ့ကျင့်ရန်</h3><button style={styles.closeButtonSimple} onClick={onClose}><FaTimes /></button></div>
                <div style={styles.recordContent}>
                    <div style={styles.textWordChinese}>{correctWord}</div>
                    <div style={styles.actionArea}>
                        {status === 'idle' && (<button style={styles.bigRecordBtn} onClick={startRecording}><FaMicrophone size={32} /></button>)}
                        {status === 'recording' && (<button style={{...styles.bigRecordBtn, background: '#ef4444'}} onClick={stopRecording}><FaStop size={32} /></button>)}
                        {status === 'review' && (<div style={styles.reviewContainer}><div style={styles.reviewRow}><button style={styles.circleBtnBlue} onClick={playStandard}><FaVolumeUp size={24} /></button><button style={styles.circleBtnGreen} onClick={playUser}><FaPlayCircle size={24} /></button></div><button style={styles.retryLink} onClick={resetRecording}><FaRedo size={14} /> ပြန်အသံသွင်းမယ်</button></div>)}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SettingsPanel = ({ settings, setSettings, onClose }) => {
    const handleSettingChange = (key, value) => { setSettings(prev => ({...prev, [key]: value})); };
    return (
        <div style={styles.settingsModal} onClick={onClose}>
            <div style={styles.settingsContent} onClick={(e) => e.stopPropagation()}>
                <button style={styles.closeButton} onClick={onClose}><FaTimes /></button>
                <h2 style={{marginTop: 0}}>Settings</h2>
                <div style={styles.settingGroup}><label>Order</label><div style={styles.settingControl}><button onClick={() => handleSettingChange('order', 'sequential')} style={{...styles.settingButton, background: settings.order === 'sequential' ? '#4299e1' : '#f3f4f6', color: settings.order === 'sequential' ? 'white' : '#4b5563' }}>Sequential</button><button onClick={() => handleSettingChange('order', 'random')} style={{...styles.settingButton, background: settings.order === 'random' ? '#4299e1' : '#f3f4f6', color: settings.order === 'random' ? 'white' : '#4b5563' }}>Random</button></div></div>
                <div style={styles.settingGroup}><label>Chinese Voice</label><select style={styles.settingSelect} value={settings.voiceChinese} onChange={(e) => handleSettingChange('voiceChinese', e.target.value)}>{TTS_VOICES.filter(v => v.value.startsWith('zh')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div>
            </div>
        </div>
    );
};

const JumpModal = ({ max, current, onJump, onClose }) => {
    const [inputValue, setInputValue] = useState(current + 1);
    const handleJump = () => { const num = parseInt(inputValue, 10); if (num >= 1 && num <= max) onJump(num - 1); };
    return ( <div style={styles.jumpModalOverlay} onClick={onClose}><div style={styles.jumpModalContent} onClick={e => e.stopPropagation()}><h3>Go to</h3><input type="number" style={styles.jumpModalInput} value={inputValue} onChange={(e) => setInputValue(e.target.value)} /><button style={styles.jumpModalButton} onClick={handleJump}>Go</button></div></div> );
};

// =================================================================================
// ===== 主组件: WordCard =====
// =================================================================================
const WordCard = ({ words = [], isOpen, onClose, progressKey = 'default', level }) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const [settings, setSettings] = useCardSettings();
  const [activeCards, setActiveCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecordingOpen, setIsRecordingOpen] = useState(false);
  const [isSpellingOpen, setIsSpellingOpen] = useState(false);
  const [writerChar, setWriterChar] = useState(null);
  const [isFavoriteCard, setIsFavoriteCard] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const autoBrowseTimerRef = useRef(null);
  const lastDirection = useRef(0);

  const getPinyin = useCallback((wordObj) => {
      if (wordObj.pinyin) return wordObj.pinyin;
      if (!wordObj.chinese) return '';
      return pinyinConverter(wordObj.chinese, { toneType: 'symbol', separator: ' ', v: true }).replace(/·/g, ' ');
  }, []);

  const processedCards = useMemo(() => {
    let mapped = words.map(w => ({
        id: w.id, hsk_level: w.hsk_level, chinese: w.chinese || w.word, audioText: w.audioText || w.chinese || w.word,
        pinyin: w.pinyin, burmese: w.burmese || w.meaning, explanation: w.explanation, mnemonic: w.mnemonic, example: w.example, example2: w.example2,
    })).filter(w => w.chinese);
    if (settings.order === 'random') {
        mapped = [...mapped].sort(() => Math.random() - 0.5);
    }
    return mapped;
  }, [words, settings.order]);

  // 进度恢复
  useEffect(() => {
    setActiveCards(processedCards.length > 0 ? processedCards : []);
    if (isMounted && progressKey && processedCards.length > 0) {
        const savedIndex = localStorage.getItem(`word_progress_${progressKey}`);
        const parsed = parseInt(savedIndex, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < processedCards.length) setCurrentIndex(parsed);
    }
  }, [processedCards, progressKey, isMounted]);

  // 进度保存
  useEffect(() => {
      if (isMounted && progressKey && activeCards.length > 0) {
          localStorage.setItem(`word_progress_${progressKey}`, currentIndex);
      }
  }, [currentIndex, progressKey, activeCards.length, isMounted]);

  const currentCard = activeCards.length > 0 ? activeCards[currentIndex] : null;

  useEffect(() => {
      if (currentCard?.id) {
          isFavorite(currentCard.id).then(res => setIsFavoriteCard(res));
      }
      setIsRevealed(false);
  }, [currentCard]);

  const navigate = useCallback((direction) => {
    if (activeCards.length === 0) return;
    lastDirection.current = direction;
    setCurrentIndex(prev => (prev + direction + activeCards.length) % activeCards.length);
  }, [activeCards.length]);

  // 自动播放逻辑
  useEffect(() => {
    if (!isOpen || !currentCard || !isMounted) return;
    clearTimeout(autoBrowseTimerRef.current);
    stopAllAudio();
    const playSequence = () => {
        const playTtsChain = () => {
            if (settings.autoPlayBurmese && currentCard.burmese && isRevealed) {
                playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, () => {
                    if (settings.autoPlayExample && currentCard.example && isRevealed) {
                        playTTS(currentCard.example, settings.voiceChinese, settings.speechRateChinese, () => {
                            if (settings.autoPlayExample && currentCard.example2 && isRevealed) {
                                playTTS(currentCard.example2, settings.voiceChinese, settings.speechRateChinese);
                            }
                        });
                    }
                });
            }
        };
        if (settings.autoPlayChinese && currentCard.chinese) {
            playR2Audio(currentCard, playTtsChain, settings, level);
        } else { playTtsChain(); }
    };
    const timer = setTimeout(playSequence, 600);
    return () => clearTimeout(timer);
  }, [currentIndex, currentCard, settings, isOpen, isRevealed, level, isMounted]);

  const handleToggleFavorite = async (e) => {
      e.stopPropagation();
      if (!currentCard) return;
      const success = await toggleFavorite(currentCard);
      setIsFavoriteCard(success);
  };

  const pageTransitions = useTransition(isOpen, { from: { opacity: 0, transform: 'translateY(100%)' }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: 'translateY(100%)' } });
  const cardTransitions = useTransition(currentIndex, { key: currentCard?.id || currentIndex, from: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '100%' : '-100%'})` }, enter: { opacity: 1, transform: 'translateY(0%)' }, leave: { opacity: 0, transform: `translateY(${lastDirection.current > 0 ? '-100%' : '100%'})`, position: 'absolute' }, onStart: () => { if(currentCard) playSoundEffect('switch'); } });

  const bind = useDrag(({ down, movement: [mx, my], velocity: { magnitude: vel }, direction: [xDir, yDir], event }) => {
      if (event.target.closest('[data-no-gesture]') || down) return;
      if (Math.abs(mx) > Math.abs(my)) { if (Math.abs(mx) > 80) onClose(); }
      else { if (Math.abs(my) > 60) navigate(yDir < 0 ? 1 : -1); }
  }, { filterTaps: true, preventDefault: true });

  if (!isMounted) return null;

  const cardContent = pageTransitions((style, item) => {
    const bgUrl = settings.backgroundImage;
    const backgroundStyle = bgUrl ? { background: `url(${bgUrl}) center/cover no-repeat` } : {};
    return item && (
      <animated.div style={{ ...styles.fullScreen, ...backgroundStyle, ...style }}>
        <div style={styles.gestureArea} {...bind()} onClick={() => setIsRevealed(!isRevealed)} />
        {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
        {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
        {isRecordingOpen && currentCard && (<PronunciationComparison correctWord={currentCard.chinese} settings={settings} onClose={() => setIsRecordingOpen(false)} />)}
        {isSpellingOpen && currentCard && (<SpellingModal wordObj={currentCard} settings={settings} level={level} onClose={() => setIsSpellingOpen(false)} />)}
        {isJumping && <JumpModal max={activeCards.length} current={currentIndex} onJump={(i) => {setCurrentIndex(i); setIsJumping(false);}} onClose={() => setIsJumping(false)} />}

        {activeCards.length > 0 && currentCard ? (
            cardTransitions((cardStyle, i) => {
              const cardData = activeCards[i];
              return (
                <animated.div key={cardData.id} style={{ ...styles.animatedCardShell, ...cardStyle }}>
                  <div style={styles.cardContainer}>
                        <div style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); playR2Audio(cardData, null, settings, level); }}>
                            <div style={styles.pinyin}>{getPinyin(cardData)}</div>
                            <div style={styles.textWordChinese}>{cardData.chinese}</div>
                        </div>
                        {isRevealed && (
                            <div style={styles.revealedContent}>
                                <div style={styles.textWordBurmese} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)}>{cardData.burmese}</div>
                                {cardData.explanation && <div style={styles.explanationBox} onClick={(e) => playTTS(cardData.explanation, settings.voiceBurmese, settings.speechRateBurmese, null, e)}>{cardData.explanation}</div>}
                                {cardData.mnemonic && <div style={styles.mnemonicBox}>{cardData.mnemonic}</div>}
                                {cardData.example && (
                                    <div style={styles.exampleBox} onClick={(e) => playTTS(cardData.example, settings.voiceChinese, settings.speechRateChinese, null, e)}>
                                        <div style={styles.examplePinyin}>{pinyinConverter(cardData.example, { toneType: 'symbol' })}</div>
                                        <div style={styles.exampleText}>{cardData.example}</div>
                                    </div>
                                )}
                                {cardData.example2 && (
                                    <div style={styles.exampleBox} onClick={(e) => playTTS(cardData.example2, settings.voiceChinese, settings.speechRateChinese, null, e)}>
                                        <div style={styles.examplePinyin}>{pinyinConverter(cardData.example2, { toneType: 'symbol' })}</div>
                                        <div style={styles.exampleText}>{cardData.example2}</div>
                                    </div>
                                )}
                            </div>
                        )}
                  </div>
                </animated.div>
              );
            })
        ) : (
            <div style={styles.completionContainer}><h2>🎉 ပြီးပါပြီ</h2><button style={styles.knowButton} onClick={onClose}>ပိတ်မည်</button></div>
        )}

        <div style={styles.rightControls} data-no-gesture="true">
            <button style={styles.rightIconButton} onClick={(e) => { e.stopPropagation(); window.location.href = 'https://886.best'; }}><FaHome size={18} /></button>
            <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)}><FaCog size={18} /></button>
            <button style={styles.rightIconButton} onClick={() => setIsSpellingOpen(true)}><span style={{ fontWeight: 'bold', color: '#d97706' }}>拼</span></button>
            <button style={styles.rightIconButton} onClick={() => setIsRecordingOpen(true)}><FaMicrophone size={18} /></button>
            {currentCard?.chinese?.length <= 5 && <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)}><FaPenFancy size={18} /></button>}
            <button style={styles.rightIconButton} onClick={handleToggleFavorite}>{isFavoriteCard ? <FaHeart color="#f87171" /> : <FaRegHeart />}</button>
        </div>

        <div style={styles.bottomControlsContainer} data-no-gesture="true">
            <div style={styles.bottomCenterCounter} onClick={() => setIsJumping(true)}>{currentIndex + 1} / {activeCards.length}</div>
            <div style={styles.knowButtonsWrapper}>
                <button style={{...styles.knowButtonBase, ...styles.dontKnowButton}} onClick={() => { stopAllAudio(); if(isRevealed) navigate(1); else setIsRevealed(true); }}>မသိဘူး</button>
                <button style={{...styles.knowButtonBase, ...styles.knowButton}} onClick={() => { stopAllAudio(); const newCards = activeCards.filter(c => c.id !== currentCard.id); setActiveCards(newCards); if(currentIndex >= newCards.length) setCurrentIndex(0); }}>သိတယ်</button>
            </div>
        </div>
      </animated.div>
  )});

  return createPortal(cardContent, document.body);
};

const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', backgroundColor: '#f0f4f8' },
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '60px 15px 130px 15px' },
    cardContainer: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', zIndex: 2 },
    pinyin: { fontSize: '1.4rem', color: '#d97706', marginBottom: '0.8rem', fontWeight: 'bold' },
    textWordChinese: { fontSize: '2.4rem', fontWeight: 'bold', color: '#1f2937' },
    revealedContent: { marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
    textWordBurmese: { fontSize: '1.3rem', color: '#4b5563' },
    explanationBox: { color: '#16a34a', fontSize: '1.1rem', cursor: 'pointer' },
    mnemonicBox: { color: '#6b7280', fontSize: '1.0rem', background: 'transparent' },
    exampleBox: { padding: '10px', borderBottom: '1px dashed #e5e7eb', cursor: 'pointer' },
    examplePinyin: { fontSize: '0.95rem', color: '#d97706' },
    exampleText: { fontSize: '1.2rem' },
    rightControls: { position: 'fixed', bottom: '45%', right: '10px', zIndex: 101, display: 'flex', flexDirection: 'column', gap: '12px' },
    rightIconButton: { background: 'white', border: '1px solid #e5e7eb', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
    bottomControlsContainer: { position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', zIndex: 101 },
    bottomCenterCounter: { background: 'rgba(0,0,0,0.05)', padding: '5px 15px', borderRadius: '15px', fontSize: '0.9rem', cursor: 'pointer' },
    knowButtonsWrapper: { display: 'flex', width: '100%', maxWidth: '400px', gap: '15px' },
    knowButtonBase: { flex: 1, padding: '15px', borderRadius: '15px', border: 'none', fontSize: '1.1rem', fontWeight: 'bold', color: 'white' },
    dontKnowButton: { background: '#f59e0b' },
    knowButton: { background: '#10b981' },
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 },
    comparisonPanel: { background: 'white', borderRadius: '20px', width: '90%', maxWidth: '350px', overflow: 'hidden' },
    recordHeader: { padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' },
    recordContent: { padding: '20px', textAlign: 'center' },
    bigRecordBtn: { width: '70px', height: '70px', borderRadius: '50%', background: '#3b82f6', color: 'white', border: 'none' },
    reviewContainer: { display: 'flex', flexDirection: 'column', gap: '15px' },
    reviewRow: { display: 'flex', justifyContent: 'center', gap: '20px' },
    circleBtnBlue: { width: '50px', height: '50px', borderRadius: '50%', background: '#3b82f6', color: 'white', border: 'none' },
    circleBtnGreen: { width: '50px', height: '50px', borderRadius: '50%', background: '#10b981', color: 'white', border: 'none' },
    retryLink: { background: 'none', border: 'none', color: '#666', textDecoration: 'underline' },
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 },
    settingsContent: { background: 'white', padding: '20px', borderRadius: '15px', width: '85%', maxWidth: '400px', position: 'relative' },
    closeButton: { position: 'absolute', top: '10px', right: '10px', border: 'none', background: 'none', fontSize: '1.2rem' },
    settingGroup: { marginBottom: '15px' },
    settingControl: { display: 'flex', gap: '10px' },
    settingButton: { flex: 1, padding: '8px', border: 'none', borderRadius: '8px' },
    settingSelect: { width: '100%', padding: '8px' },
    jumpModalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002 },
    jumpModalContent: { background: 'white', padding: '20px', borderRadius: '15px' },
    jumpModalInput: { width: '60px', padding: '5px', textAlign: 'center', marginRight: '10px' },
    jumpModalButton: { padding: '5px 15px', background: '#4299e1', color: 'white', border: 'none', borderRadius: '5px' },
    completionContainer: { textAlign: 'center' },
    closeButtonSimple: { border: 'none', background: 'none' }
};

export default WordCard;
