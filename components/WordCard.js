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
            store.put({ ...word });
            return true;
        }
    } catch (e) { return false; }
}

async function isFavorite(id) {
    try {
        const db = await openDB();
        if (!db) return false;
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
    { value: 'zh-CN-XiaoxiaoMultilingualNeural', label: '晓晓 (多语言)' },
    { value: 'zh-CN-YunyiMultilingualNeural', label: '云希 (多语言)' },
    { value: 'zh-CN-XiaochenMultilingualNeural', label: '晓辰 (多语言)' },
    { value: 'zh-CN-XiaoyanNeural', label: '晓颜 (通用)' },
    { value: 'zh-CN-YunxiaNeural', label: '云夏 (男童)' },
    { value: 'zh-CN-XiaoyouNeural', label: '晓晓 (女童)' },
    { value: 'en-US-AvaMultilingualNeural', label: 'Ava (英语)' },
    { value: 'fr-FR-VivienneMultilingualNeural', label: 'Vivienne (法语)' },
    { value: 'fr-FR-RemyMultilingualNeural', label: 'Remy (法语)' },
    { value: 'my-MM-NilarNeural', label: 'Nilar (缅语)' },
    { value: 'my-MM-ThihaNeural', label: 'Thiha (缅语)' },
];

let _currentAudio = null; // 用于控制原生 Audio 对象
let sounds = null;

const stopAllAudio = () => {
    if (_currentAudio) {
        _currentAudio.pause();
        _currentAudio.currentTime = 0;
        _currentAudio = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
};

const initSounds = () => {
    if (!sounds && typeof window !== 'undefined') {
        sounds = {
            switch: new Audio('/sounds/switch-card.mp3'),
            correct: new Audio('/sounds/correct.mp3'),
            incorrect: new Audio('/sounds/incorrect.mp3'),
        };
    }
};

/**
 * 播放逻辑：彻底修复 TTS (GET + CF Proxy)
 */
const playTTS = (text, voice, rate, onEndCallback) => {
    stopAllAudio();
    if (!text || !voice) return;

    // 语速映射
    const rateValue = Math.round(rate / 2);
    const apiUrl = `/api/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rateValue}`;

    const audio = new Audio(apiUrl);
    _currentAudio = audio;
    audio.onended = () => { if (onEndCallback) onEndCallback(); };
    audio.onerror = () => {
        console.error("Audio proxy error, using system fallback");
        if (window.speechSynthesis) {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = voice.includes('my') ? 'my-MM' : 'zh-CN';
            window.speechSynthesis.speak(u);
        }
    };
    audio.play().catch(e => console.warn("Auto-play blocked"));
};

/**
 * 播放逻辑：修复 HSK1/HSK2 R2 音频路径
 */
const playR2Audio = (word, onEndCallback, settings, defaultLevel) => {
    stopAllAudio();
    // 强制使用组件传入的 level (如果是 HSK2 页面，defaultLevel 应该是 2)
    const targetLevel = word.hsk_level || defaultLevel;

    if (!word || !word.id || !targetLevel) {
        playTTS(word.chinese, settings.voiceChinese, settings.speechRateChinese, onEndCallback);
        return;
    }

    const formattedId = String(word.id).padStart(4, '0');
    // 路径：hsk1 或 hsk2
    const audioSrc = `https://audio.886.best/chinese-vocab-audio/hsk${targetLevel}/${formattedId}.mp3`;

    const audio = new Audio(audioSrc);
    _currentAudio = audio;
    audio.onended = onEndCallback;
    audio.onerror = () => {
        // 如果 R2 找不到文件，自动切换到 TTS
        console.warn(`R2 audio not found: ${audioSrc}, fallback to TTS`);
        playTTS(word.chinese, settings.voiceChinese, settings.speechRateChinese, onEndCallback);
    };
    audio.play().catch(e => console.warn("Auto-play blocked"));
};

const playSoundEffect = (type) => {
    if (typeof window === 'undefined') return;
    initSounds();
    if (sounds && sounds[type]) {
        sounds[type].currentTime = 0;
        sounds[type].play().catch(() => {});
    }
};

// =================================================================================
// 🔥 拼读子组件
// =================================================================================
const SpellingModal = ({ wordObj, settings, level, onClose }) => {
    const [status, setStatus] = useState('');
    const isStoppingRef = useRef(false);
    const word = wordObj.chinese;

    const startSpelling = useCallback(async () => {
        if (!word) return;
        isStoppingRef.current = false;

        const chars = word.split('');
        for (let i = 0; i < chars.length; i++) {
            if (isStoppingRef.current) break;
            const py = pinyinConverter(chars[i], { toneType: 'symbol' });
            setStatus(`${i}-full`);
            
            const spellUrl = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodeURIComponent(py)}.mp3`;
            const audio = new Audio(spellUrl);
            _currentAudio = audio;
            
            await new Promise(res => {
                audio.onended = res;
                audio.onerror = res;
                audio.play().catch(res);
            });
            await new Promise(r => setTimeout(r, 200));
        }

        if (!isStoppingRef.current) {
            setStatus('all-full');
            playR2Audio(wordObj, () => { setTimeout(onClose, 1000); }, settings, level);
        }
    }, [word, wordObj, settings, level, onClose]);

    useEffect(() => { startSpelling(); return () => { isStoppingRef.current = true; stopAllAudio(); }; }, [startSpelling]);

    return (
        <div style={styles.comparisonOverlay} onClick={onClose}>
            <div style={styles.comparisonPanel} onClick={e => e.stopPropagation()}>
                <div style={styles.recordHeader}><h3>ပေါင်း၍ဖတ်ခြင်း</h3><button style={styles.closeButtonSimple} onClick={onClose}><FaTimes /></button></div>
                <div style={styles.recordContent}>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center'}}>
                        {word && word.split('').map((char, index) => {
                            const isActive = status === `${index}-full` || status === 'all-full';
                            return (
                                <div key={index} style={{textAlign: 'center'}}>
                                    <div style={{fontSize: '1.2rem', color: isActive ? '#ef4444' : '#9ca3af', fontWeight: isActive ? 'bold' : 'normal'}}>
                                        {pinyinConverter(char, {toneType: 'symbol'})}
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
// =================================================================================
// ===== 主组件: WordCard =====
// =================================================================================
const WordCard = ({ words = [], isOpen, onClose, progressKey = 'default', level }) => {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState({
      order: 'sequential', autoPlayChinese: true, autoPlayBurmese: true, autoPlayExample: true, 
      voiceChinese: 'zh-CN-XiaoyouNeural', voiceBurmese: 'my-MM-NilarNeural', 
      speechRateChinese: -20, speechRateBurmese: -60, backgroundImage: ''
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFavoriteCard, setIsFavoriteCard] = useState(false);
  const [isSpellingOpen, setIsSpellingOpen] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [writerChar, setWriterChar] = useState(null);
  const [isRecordingOpen, setIsRecordingOpen] = useState(false);

  // 1. 核心修复：防止 418 错误，挂载后加载配置
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('learningWordCardSettings');
    if (saved) setSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
    
    const savedIndex = localStorage.getItem(`word_progress_${progressKey}`);
    if (savedIndex) setCurrentIndex(parseInt(savedIndex, 10) || 0);
  }, [progressKey]);

  // 2. 保存设置与进度
  useEffect(() => {
    if (mounted) {
        localStorage.setItem('learningWordCardSettings', JSON.stringify(settings));
        localStorage.setItem(`word_progress_${progressKey}`, currentIndex);
    }
  }, [settings, currentIndex, progressKey, mounted]);

  const processedCards = useMemo(() => {
    let mapped = words.map(w => ({
        id: w.id, hsk_level: w.hsk_level, chinese: w.chinese || w.word, audioText: w.audioText || w.chinese || w.word,
        pinyin: w.pinyin, burmese: w.burmese || w.meaning, explanation: w.explanation, mnemonic: w.mnemonic, example: w.example, example2: w.example2,
    })).filter(w => w.chinese);
    if (settings.order === 'random') { mapped = [...mapped].sort(() => Math.random() - 0.5); }
    return mapped;
  }, [words, settings.order]);

  const currentCard = useMemo(() => processedCards[currentIndex], [processedCards, currentIndex]);

  useEffect(() => {
    if (currentCard?.id) isFavorite(currentCard.id).then(setIsFavoriteCard);
    setIsRevealed(false);
  }, [currentCard]);

  // 3. 自动播放
  useEffect(() => {
    if (!isOpen || !currentCard || !mounted) return;
    stopAllAudio();
    const playSeq = () => {
        if (settings.autoPlayChinese) {
            playR2Audio(currentCard, () => {
                if (settings.autoPlayBurmese && isRevealed) 
                    playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese);
            }, settings, level);
        }
    };
    const t = setTimeout(playSeq, 500);
    return () => clearTimeout(t);
  }, [currentIndex, isRevealed, isOpen, mounted, level, currentCard, settings]);

  const navigate = useCallback((dir) => {
    if (words.length === 0) return;
    setCurrentIndex(prev => (prev + dir + words.length) % words.length);
  }, [words.length]);

  const bind = useDrag(({ down, movement: [mx, my], last, event }) => {
    if (event.target.closest('[data-no-gesture]')) return;
    if (last && Math.abs(my) > 60) navigate(my > 0 ? -1 : 1);
  }, { filterTaps: true, preventDefault: true });

  if (!mounted || !isOpen) return null;

  const handleToggleFavorite = async (e) => {
      e.stopPropagation();
      if (!currentCard) return;
      const success = await toggleFavorite(currentCard);
      setIsFavoriteCard(success);
  };
  
  return createPortal(
    <div style={styles.fullScreen}>
        <div style={styles.gestureArea} {...bind()} onClick={() => setIsRevealed(!isRevealed)} />
        
        {/* 右侧控制栏 */}
        <div style={styles.rightControls} data-no-gesture="true">
            <button style={styles.rightIconButton} onClick={() => window.location.href = 'https://886.best'}><FaHome/></button>
            <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)}><FaCog/></button>
            <button style={styles.rightIconButton} onClick={() => setIsSpellingOpen(true)}><span style={{fontWeight:'bold', color:'#d97706'}}>拼</span></button>
            <button style={styles.rightIconButton} onClick={() => setIsRecordingOpen(true)}><FaMicrophone/></button>
            {currentCard?.chinese?.length <= 5 && <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)}><FaPenFancy/></button>}
            <button style={styles.rightIconButton} onClick={handleToggleFavorite}>
                {isFavoriteCard ? <FaHeart color="#f87171"/> : <FaRegHeart/>}
            </button>
            <button style={styles.rightIconButton} onClick={onClose}><FaTimes/></button>
        </div>

        {/* 卡片核心 */}
        <div style={styles.cardContainer}>
            <div style={styles.pinyin}>{currentCard?.pinyin || pinyinConverter(currentCard?.chinese || '', {toneType:'symbol', separator:' '})}</div>
            <div style={styles.textWordChinese} onClick={(e) => { e.stopPropagation(); playR2Audio(currentCard, null, settings, level); }}>
                {currentCard?.chinese}
            </div>
            {isRevealed && (
                <div style={styles.revealedContent}>
                    <div style={styles.textWordBurmese} onClick={(e) => { e.stopPropagation(); playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese); }}>
                        {currentCard.burmese}
                    </div>
                    <div style={styles.exampleBox} onClick={(e) => { e.stopPropagation(); playTTS(currentCard.example, settings.voiceChinese, settings.speechRateChinese); }}>
                        <div style={styles.examplePinyin}>{pinyinConverter(currentCard.example || '', {toneType:'symbol', separator: ' '})}</div>
                        <div style={styles.exampleText}>{currentCard.example}</div>
                    </div>
                </div>
            )}
        </div>

        {/* 底部交互 */}
        <div style={styles.bottomControlsContainer}>
            <div style={styles.bottomCenterCounter} onClick={()=>setIsJumping(true)}>{currentIndex + 1} / {words.length}</div>
            <div style={styles.knowButtonsWrapper}>
                <button style={{...styles.knowButtonBase, background:'#f59e0b'}} onClick={() => setIsRevealed(true)}>မသိဘူး</button>
                <button style={{...styles.knowButtonBase, background:'#10b981'}} onClick={() => navigate(1)}>သိတယ်</button>
            </div>
        </div>
        
        {/* 弹窗 */}
        {isSpellingOpen && <SpellingModal wordObj={currentCard} settings={settings} level={level} onClose={()=>setIsSpellingOpen(false)} />}
        {isRecordingOpen && <PronunciationComparison correctWord={currentCard.chinese} settings={settings} onClose={()=>setIsRecordingOpen(false)} />}
        {isJumping && (<div style={styles.jumpModalOverlay} onClick={()=>setIsJumping(false)}><div style={styles.jumpModalContent} onClick={e=>e.stopPropagation()}><h3>Go to</h3><input type="number" style={styles.jumpModalInput} onChange={e=>{const v=parseInt(e.target.value); if(v>0&&v<=words.length){setCurrentIndex(v-1); setIsJumping(false);}}} /></div></div>)}
        {isSettingsOpen && (<div style={styles.settingsModal} onClick={() => setIsSettingsOpen(false)}><div style={styles.settingsContent} onClick={e => e.stopPropagation()}><h3 style={{marginBottom:'20px'}}>Audio Settings</h3><div style={{marginBottom:'15px'}}><label style={{display:'block', fontSize:'0.8rem', color:'#666'}}>Chinese Voice</label><select style={styles.settingSelect} value={settings.voiceChinese} onChange={e => setSettings({...settings, voiceChinese: e.target.value})}>{TTS_VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div><button style={styles.jumpModalButton} onClick={() => setIsSettingsOpen(false)}>Close</button></div></div>)}
        {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}

    </div>,
    document.body
  );
};

const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
    gestureArea: { position: 'absolute', inset: 0, zIndex: 1 },
    cardContainer: { textAlign: 'center', zIndex: 2, padding: '20px', width:'100%' },
    pinyin: { fontSize: '1.4rem', color: '#d97706', fontWeight: 'bold', marginBottom: '10px' },
    textWordChinese: { fontSize: '3.5rem', fontWeight: 'bold', color: '#1f2937', cursor: 'pointer' },
    revealedContent: { marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems:'center' },
    textWordBurmese: { fontSize: '1.6rem', color: '#4b5563', cursor: 'pointer' },
    exampleBox: { padding: '15px', borderBottom: '1px dashed #cbd5e1', cursor: 'pointer', maxWidth:'350px' },
    examplePinyin: { fontSize: '0.9rem', color: '#d97706', marginBottom:'5px' },
    exampleText: { fontSize: '1.2rem', color: '#334155' },
    rightControls: { position: 'fixed', top: '20px', right: '15px', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 100 },
    rightIconButton: { width: '42px', height: '42px', borderRadius: '50%', border: '1px solid #e2e8f0', background: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    bottomControlsContainer: { position: 'fixed', bottom: '30px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', zIndex: 10 },
    bottomCenterCounter: { background: 'rgba(0,0,0,0.05)', padding: '6px 15px', borderRadius: '20px', fontSize:'0.9rem', cursor:'pointer' },
    knowButtonsWrapper: { display: 'flex', gap: '15px', width: '85%', maxWidth: '400px' },
    knowButtonBase: { flex: 1, padding: '16px', border: 'none', borderRadius: '18px', color: 'white', fontWeight: 'bold', fontSize: '1.2rem', cursor:'pointer', boxShadow:'0 4px 10px rgba(0,0,0,0.1)' },
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
    settingsContent: { background: 'white', padding: '30px', borderRadius: '25px', width: '85%', maxWidth: '350px' },
    settingSelect: { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '5px' },
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 },
    comparisonPanel: { background: 'white', borderRadius: '30px', width: '90%', maxWidth: '380px', overflow: 'hidden' },
    recordHeader: { padding: '20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems:'center' },
    recordContent: { padding: '30px', textAlign: 'center' },
    closeButtonSimple: { border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' },
    jumpModalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10002 },
    jumpModalContent: { background:'white', padding:'25px', borderRadius:'20px', textAlign:'center' },
    jumpModalInput: { width:'80px', padding:'10px', textAlign:'center', fontSize:'1.5rem', border:'2px solid #e2e8f0', borderRadius:'10px' },
    jumpModalButton: { width:'100%', padding:'12px', background:'#2563eb', color:'white', border:'none', borderRadius:'10px', marginTop:'20px', fontWeight:'bold' }
};

export default WordCard;
