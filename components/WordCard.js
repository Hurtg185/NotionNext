// components/WordCard.js

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import {
    FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown,
    FaHeart, FaRegHeart, FaPlayCircle, FaStop, FaVolumeUp, FaRedo,
    FaHome, FaEyeSlash
} from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// =================================================================================
// --- 数据库逻辑 (IndexedDB) ---
// =================================================================================
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

// =================================================================================
// --- 音频常量与全局控制 ---
// =================================================================================
const TTS_VOICES = [
    { value: 'zh-CN-XiaoxiaoNeural', label: 'တရုတ် (အမျိုးသမီး)' },
    { value: 'zh-CN-XiaoyouNeural', label: 'တရုတ် (ကလေး)' },
    { value: 'my-MM-NilarNeural', label: 'ဗမာ (အမျိုးသမီး)' },
    { value: 'my-MM-ThihaNeural', label: 'ဗမာ (အမျိုးသား)' },
];

let sounds = null;
let _howlInstance = null;

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

// =================================================================================
// --- 🔥 核心：集成 CF Workers 代理的音频播放引擎 ---
// =================================================================================

const playTTS = async (text, voice, rate, onEndCallback, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    stopAllAudio();

    if (!text || !voice) {
        if (onEndCallback) onEndCallback();
        return;
    }

    // 🔥 集成 Cloudflare Workers 代理逻辑，实现 90 天强缓存
    // 接口格式：/api/tts?t=文本&v=发音人&r=语速
    const url = `/api/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate || 0}`;

    _howlInstance = new Howl({
        src: [url],
        format: ['mpeg'],
        html5: true,
        onend: () => {
            if (onEndCallback) onEndCallback();
        },
        onloaderror: (id, err) => {
            console.error("TTS Proxy Error", err);
            if (onEndCallback) onEndCallback();
        }
    });

    _howlInstance.play();
};

const playR2Audio = (word, onEndCallback, settings, defaultLevel) => {
    // 检查设置：是否强制走 TTS
    if (!settings.useAudioFile || !word || !word.id) {
        playTTS(word.chinese, settings.voiceChinese, settings.speechRateChinese, onEndCallback);
        return;
    }

    const targetLevel = word.hsk_level || defaultLevel;
    if (!targetLevel) {
        playTTS(word.chinese, settings.voiceChinese, settings.speechRateChinese, onEndCallback);
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
        onloaderror: () => {
            // R2 加载失败则自动降级到本地缓存代理 TTS
            playTTS(word.chinese, settings.voiceChinese, settings.speechRateChinese, onEndCallback);
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

// =================================================================================
// --- 配置 Hook ---
// =================================================================================
const useCardSettings = () => {
    const [settings, setSettings] = useState(() => {
        try {
            if (typeof window === 'undefined') return {};
            const savedSettings = localStorage.getItem('learningWordCardSettings_v5');
            const defaultSettings = {
                order: 'sequential', 
                autoPlayChinese: true, 
                autoPlayBurmese: true, 
                autoPlayExample: true, 
                autoBrowse: false, 
                autoBrowseDelay: 6000, 
                useAudioFile: true, 
                voiceChinese: 'zh-CN-XiaoyouNeural', 
                voiceBurmese: 'my-MM-ThihaNeural', // 🔥 默认男声
                speechRateChinese: -20, 
                speechRateBurmese: -10, 
                backgroundImage: ''
            };
            return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
        } catch (error) {
            return { order: 'sequential', voiceBurmese: 'my-MM-ThihaNeural' };
        }
    });
    useEffect(() => { 
        if (typeof window !== 'undefined') {
            localStorage.setItem('learningWordCardSettings_v5', JSON.stringify(settings)); 
        }
    }, [settings]);
    return [settings, setSettings];
};

// =================================================================================
// --- 子组件：拼读演示 (SpellingModal) ---
// =================================================================================
const SpellingModal = ({ wordObj, settings, level, onClose }) => {
    const [status, setStatus] = useState('');
    const isStoppingRef = useRef(false);
    const word = wordObj.chinese;

    const playUnit = (filename) => {
        return new Promise((resolve) => {
            if (isStoppingRef.current) return resolve();
            stopAllAudio();
            const url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${encodeURIComponent(filename)}.mp3`;
            const sound = new Howl({
                src: [url],
                html5: true,
                onend: resolve,
                onloaderror: resolve
            });
            _howlInstance = sound;
            sound.play();
        });
    };

    const startSpelling = useCallback(async () => {
        if (!word) return;
        isStoppingRef.current = false;
        const chars = word.split('');
        for (let i = 0; i < chars.length; i++) {
            if (isStoppingRef.current) break;
            const pData = pinyinConverter(chars[i], { toneType: 'symbol' });
            setStatus(`${i}-full`);
            await playUnit(pData);
            await new Promise(r => setTimeout(r, 200));
        }
        if (!isStoppingRef.current) {
            setStatus('all-full');
            await new Promise(resolve => playR2Audio(wordObj, resolve, settings, level));
        }
        if (!isStoppingRef.current) {
            setTimeout(onClose, 1200);
        }
    }, [word, wordObj, settings, level, onClose]);

    useEffect(() => {
        startSpelling();
        return () => { isStoppingRef.current = true; stopAllAudio(); };
    }, [startSpelling]);

    return (
        <div style={styles.comparisonOverlay} onClick={onClose}>
            <div style={{...styles.comparisonPanel, maxWidth: '400px'}} onClick={e => e.stopPropagation()}>
                <div style={styles.recordHeader}><h3>ပေါင်း၍ဖတ်ခြင်း (拼读演示)</h3><button style={styles.closeButtonSimple} onClick={onClose}><FaTimes /></button></div>
                <div style={styles.recordContent}>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '25px', justifyContent: 'center'}}>
                        {word && word.split('').map((char, index) => {
                            const py = pinyinConverter(char, { toneType: 'symbol' });
                            const isActive = status === `${index}-full` || status === 'all-full';
                            return (
                                <div key={index} style={{textAlign: 'center', transition: 'all 0.3s'}}>
                                    <div style={{fontSize: '1.4rem', marginBottom: '8px', color: isActive ? '#ef4444' : '#9ca3af', fontWeight: isActive ? 'bold' : 'normal'}}>
                                        {py}
                                    </div>
                                    <div style={{fontSize: '3.8rem', fontWeight: 'bold', color: isActive ? '#2563eb' : '#1f2937'}}>
                                        {char}
                                    </div>
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
// --- 子组件：发音对比与录制 (PronunciationComparison) ---
// =================================================================================
const PronunciationComparison = ({ correctWord, settings, onClose }) => {
    const [status, setStatus] = useState('idle');
    const [userAudioUrl, setUserAudioUrl] = useState(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    const startRecording = async () => {
        stopAllAudio();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            chunksRef.current = [];
            recorder.ondataavailable = e => chunksRef.current.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                if (userAudioUrl) URL.revokeObjectURL(userAudioUrl);
                setUserAudioUrl(URL.createObjectURL(blob));
                setStatus('review');
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorderRef.current = recorder;
            recorder.start();
            setStatus('recording');
        } catch (err) { alert("麦克风启动失败，请检查权限"); }
    };

    const stopRecording = () => mediaRecorderRef.current?.stop();

    return (
        <div style={styles.comparisonOverlay} onClick={onClose}>
            <div style={styles.comparisonPanel} onClick={e => e.stopPropagation()}>
                <div style={styles.recordHeader}><h3>發音對比</h3><button style={styles.closeButtonSimple} onClick={onClose}><FaTimes /></button></div>
                <div style={styles.recordContent}>
                    <div style={styles.textWordChinese}>{correctWord}</div>
                    <div style={styles.actionArea}>
                        {status === 'idle' && <button style={styles.bigRecordBtn} onClick={startRecording}><FaMicrophone size={32}/></button>}
                        {status === 'recording' && <button style={{...styles.bigRecordBtn, background:'#ef4444'}} onClick={stopRecording}><FaStop size={32}/></button>}
                        {status === 'review' && (
                            <div style={styles.reviewContainer}>
                                <div style={{display:'flex', gap:'25px'}}>
                                    <button style={styles.circleBtnBlue} onClick={() => playTTS(correctWord, settings.voiceChinese, settings.speechRateChinese)}><FaVolumeUp size={24}/></button>
                                    <button style={styles.circleBtnGreen} onClick={() => new Audio(userAudioUrl).play()}><FaPlayCircle size={24}/></button>
                                    <button style={styles.circleBtnGray} onClick={() => setStatus('idle')}><FaRedo size={20}/></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// =================================================================================
// --- 子组件：设置面板 (SettingsPanel) ---
// =================================================================================
const SettingsPanel = React.memo(({ settings, setSettings, onClose }) => {
    const update = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));
    return (
        <div style={styles.settingsModal} onClick={onClose}>
            <div style={styles.settingsContent} onClick={e => e.stopPropagation()}>
                <button style={styles.closeButton} onClick={onClose}><FaTimes /></button>
                <h2 style={{marginTop: 0, marginBottom: '25px', color: '#1f2937'}}>Settings</h2>
                
                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>音频源选择 (Audio Source)</label>
                    <div style={styles.settingControl}>
                        <button onClick={() => update('useAudioFile', true)} style={{...styles.settingButton, background: settings.useAudioFile ? '#4299e1' : '#f3f4f6', color: settings.useAudioFile ? 'white' : '#4b5563'}}>R2 Original</button>
                        <button onClick={() => update('useAudioFile', false)} style={{...styles.settingButton, background: !settings.useAudioFile ? '#4299e1' : '#f3f4f6', color: !settings.useAudioFile ? 'white' : '#4b5563'}}>Force Cloud TTS</button>
                    </div>
                </div>

                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>缅语发音人 (Burmese Voice)</label>
                    <select style={styles.settingSelect} value={settings.voiceBurmese} onChange={e => update('voiceBurmese', e.target.value)}>
                        {TTS_VOICES.filter(v => v.value.startsWith('my')).map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                </div>

                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>中文语速 (Chinese Speed: {settings.speechRateChinese})</label>
                    <input type="range" min="-100" max="100" step="5" value={settings.speechRateChinese} onChange={e => update('speechRateChinese', parseInt(e.target.value))} style={{width:'100%'}} />
                </div>

                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>缅语语速 (Burmese Speed: {settings.speechRateBurmese})</label>
                    <input type="range" min="-100" max="100" step="5" value={settings.speechRateBurmese} onChange={e => update('speechRateBurmese', parseInt(e.target.value))} style={{width:'100%'}} />
                </div>

                <div style={styles.settingGroup}>
                    <label style={styles.settingLabel}>背景图 URL (Background Image)</label>
                    <input style={styles.settingSelect} type="text" value={settings.backgroundImage} onChange={e => update('backgroundImage', e.target.value)} placeholder="https://..." />
                </div>
            </div>
        </div>
    );
});

// =================================================================================
// --- 子组件：卡片跳转 (JumpModal) ---
// =================================================================================
const JumpModal = ({ max, current, onJump, onClose }) => {
    const [val, setVal] = useState(current + 1);
    const inputRef = useRef(null);
    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);
    return (
        <div style={styles.jumpModalOverlay} onClick={onClose}>
            <div style={styles.jumpModalContent} onClick={e => e.stopPropagation()}>
                <h3 style={{marginBottom:'20px'}}>Jump to Page</h3>
                <input ref={inputRef} type="number" style={styles.jumpModalInput} value={val} onChange={e => setVal(e.target.value)} />
                <button style={styles.jumpModalButton} onClick={() => onJump(parseInt(val)-1)}>Go</button>
            </div>
        </div>
    );
};

// =================================================================================
// ===== 主组件: WordCard ==========================================================
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

    const lastDirection = useRef(0);
    const currentCard = activeCards[currentIndex];

    // 初始化处理
    useEffect(() => {
        if (words.length > 0) {
            let mapped = words.map(w => ({
                id: w.id,
                hsk_level: w.hsk_level,
                chinese: w.chinese || w.word,
                burmese: w.burmese || w.meaning,
                pinyin: w.pinyin || pinyinConverter(w.chinese || w.word, { toneType: 'symbol' }),
                example: w.example,
                example2: w.example2,
                explanation: w.explanation
            }));
            
            if (settings.order === 'random') {
                for (let i = mapped.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [mapped[i], mapped[j]] = [mapped[j], mapped[i]];
                }
            }
            setActiveCards(mapped);
        }
    }, [words, settings.order]);

    useEffect(() => {
        if (currentCard) isFavorite(currentCard.id).then(setIsFavoriteCard);
        setIsRevealed(false);
    }, [currentIndex, currentCard]);

    // 🔥 播放序列逻辑：例句固定 -30 语速方便跟读
    useEffect(() => {
        if (!isOpen || !currentCard) return;
        stopAllAudio();
        
        const playSequence = async () => {
            // 1. 中文发音 (R2 或代理 TTS)
            if (settings.autoPlayChinese) {
                await new Promise(r => playR2Audio(currentCard, r, settings, level));
            }
            // 2. 缅语发音 (代理 TTS)
            if (isRevealed && settings.autoPlayBurmese && currentCard.burmese) {
                await new Promise(r => playTTS(currentCard.burmese, settings.voiceBurmese, settings.speechRateBurmese, r));
            }
            // 3. 例句发音 (代理 TTS - 强制 -30 慢速)
            if (isRevealed && settings.autoPlayExample && currentCard.example) {
                await new Promise(r => playTTS(currentCard.example, settings.voiceChinese, -30, r));
            }
        };

        const timer = setTimeout(playSequence, 600);
        return () => clearTimeout(timer);
    }, [currentIndex, isRevealed, isOpen, currentCard, settings, level]);

    // 🔥 核心复习算法 (遗忘曲线)
    const handleKnow = () => {
        stopAllAudio();
        const newCards = [...activeCards];
        newCards.splice(currentIndex, 1); // 认识：彻底剔除
        if (newCards.length === 0) {
            setActiveCards([]);
        } else {
            setActiveCards(newCards);
            setCurrentIndex(prev => prev % newCards.length);
        }
    };

    const handleDontKnow = () => {
        stopAllAudio();
        const card = activeCards[currentIndex];
        const newCards = [...activeCards];
        newCards.splice(currentIndex, 1);
        // 不认识：插入到 10 个词之后
        const targetPos = Math.min(currentIndex + 10, newCards.length);
        newCards.splice(targetPos, 0, card);
        setActiveCards(newCards);
        setIsRevealed(false);
    };

    const handleBlurry = () => {
        stopAllAudio();
        const card = activeCards[currentIndex];
        const newCards = [...activeCards];
        newCards.splice(currentIndex, 1);
        // 模糊：插入到 20 个词之后
        const targetPos = Math.min(currentIndex + 20, newCards.length);
        newCards.splice(targetPos, 0, card);
        setActiveCards(newCards);
        setIsRevealed(false);
    };

    const navigate = (dir) => {
        lastDirection.current = dir;
        setCurrentIndex(prev => (prev + dir + activeCards.length) % activeCards.length);
    };

    const bind = useDrag(({ last, movement: [mx, my], velocity: { magnitude: vel } }) => {
        if (last) {
            if (mx > 120) onClose();
            else if (my < -60 || (vel > 0.4 && my < 0)) navigate(1);
            else if (my > 60 || (vel > 0.4 && my > 0)) navigate(-1);
        }
    }, { filterTaps: true });

    const transitions = useTransition(currentIndex, {
        key: currentCard?.id || currentIndex,
        from: { opacity: 0, transform: `translateY(${lastDirection.current >= 0 ? 60 : -60}px)` },
        enter: { opacity: 1, transform: 'translateY(0px)' },
        leave: { opacity: 0, transform: `translateY(${lastDirection.current >= 0 ? -60 : 60}px)`, position: 'absolute' },
        config: { mass: 1, tension: 240, friction: 22 },
        onStart: () => playSoundEffect('switch')
    });

    if (!isMounted || !isOpen) return null;

    const bgImage = settings.backgroundImage ? { background: `url(${settings.backgroundImage}) center/cover no-repeat` } : {};

    return createPortal(
        <animated.div style={{ ...styles.fullScreen, ...bgImage }}>
            {/* 核心手势点击区 */}
            <div style={styles.gestureArea} {...bind()} onClick={() => setIsRevealed(!isRevealed)} />

            {/* 功能浮层组件 */}
            {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
            {isRecordingOpen && currentCard && <PronunciationComparison correctWord={currentCard.chinese} settings={settings} onClose={() => setIsRecordingOpen(false)} />}
            {isSpellingOpen && currentCard && <SpellingModal wordObj={currentCard} settings={settings} level={level} onClose={() => setIsSpellingOpen(false)} />}
            {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
            {isJumping && <JumpModal max={activeCards.length} current={currentIndex} onJump={(i) => { setCurrentIndex(i); setIsJumping(false); }} onClose={() => setIsJumping(false)} />}

            {/* 主卡片渲染 */}
            {activeCards.length > 0 && currentCard ? (
                transitions((style, i) => {
                    const card = activeCards[i];
                    return (
                        <animated.div style={{ ...styles.animatedCardShell, ...style }}>
                            <div style={styles.cardContainer}>
                                <div style={styles.pinyin}>{card.pinyin}</div>
                                <div style={styles.textWordChinese} onClick={() => playR2Audio(card, null, settings, level)}>
                                    {card.chinese}
                                </div>

                                {isRevealed && (
                                    <div style={styles.revealedContent}>
                                        <div style={styles.textWordBurmese} onClick={() => playTTS(card.burmese, settings.voiceBurmese, settings.speechRateBurmese)}>
                                            {card.burmese}
                                        </div>
                                        {card.explanation && <div style={styles.explanationText}>{card.explanation}</div>}
                                        {card.example && (
                                            <div style={styles.exampleBox} onClick={() => playTTS(card.example, settings.voiceChinese, -30)}>
                                                <div style={{color:'#d97706', fontSize:'0.9rem', marginBottom:'4px'}}>{pinyinConverter(card.example, {toneType:'symbol'})}</div>
                                                <div style={{fontSize:'1.3rem', color:'#334155'}}>{card.example}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </animated.div>
                    );
                })
            ) : (
                <div style={styles.completionContainer}>
                    <h2 style={{fontSize: '2.4rem', marginBottom: '20px'}}>🎉 ဂုဏ်ယူပါတယ်!</h2>
                    <p style={{color:'#64748b', marginBottom: '40px', fontSize: '1.2rem'}}>သင် ဒီသင်ခန်းစာကို လေ့လာပြီးသွားပါပြီ။</p>
                    <button style={{...styles.knowButtonBase, background:'#10b981', width:'240px'}} onClick={onClose}>ပိတ်မည် (Close)</button>
                </div>
            )}

            {/* 右侧悬浮功能组 */}
            <div style={styles.rightControls} data-no-gesture="true">
                <button style={styles.rightIconButton} onClick={() => window.location.href='https://886.best'}><FaHome /></button>
                <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)}><FaCog /></button>
                <button style={styles.rightIconButton} onClick={() => setIsSpellingOpen(true)}><span style={{fontWeight:'bold', color:'#d97706'}}>拼</span></button>
                <button style={styles.rightIconButton} onClick={() => setIsRecordingOpen(true)}><FaMicrophone /></button>
                <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard?.chinese)}><FaPenFancy /></button>
                <button style={styles.rightIconButton} onClick={async () => {
                    const res = await toggleFavorite(currentCard);
                    setIsFavoriteCard(res);
                }}>
                    {isFavoriteCard ? <FaHeart color="#ef4444" /> : <FaRegHeart />}
                </button>
            </div>

            {/* 🔥 底部实体控制栏 (SRS 算法操作) */}
            <div style={styles.bottomControlsContainer}>
                <div style={styles.bottomCenterCounter} onClick={() => setIsJumping(true)}>
                    {currentIndex + 1} / {activeCards.length}
                </div>
                <div style={styles.knowButtonsWrapper}>
                    {/* 不认识：10个单词后重现 */}
                    <button style={{...styles.knowButtonBase, background: '#f59e0b'}} onClick={handleDontKnow}>
                        မသိဘူး (不认识)
                    </button>
                    {/* 模糊：20个单词后重现 */}
                    <button style={{...styles.knowButtonBase, background: '#64748b', fontSize:'0.9rem'}} onClick={handleBlurry}>
                        <FaEyeSlash style={{marginRight:'10px'}}/> ဝေဝါး (模糊)
                    </button>
                    {/* 认识：踢出列表 */}
                    <button style={{...styles.knowButtonBase, background: '#10b981'}} onClick={handleKnow}>
                        သိတယ် (认识)
                    </button>
                </div>
            </div>
        </animated.div>,
        document.body
    );
};

// =================================================================================
// --- 样式定义 (CSS-in-JS 全量导出) ---
// =================================================================================
const styles = {
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f4f8', overflow: 'hidden', touchAction: 'none' },
    gestureArea: { position: 'absolute', inset: 0, zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
    cardContainer: { textAlign: 'center', width: '92%', maxWidth: '600px', zIndex: 2, pointerEvents: 'auto' },
    pinyin: { fontSize: '1.7rem', color: '#d97706', marginBottom: '15px', fontWeight: 'bold', fontFamily: 'monospace' },
    textWordChinese: { fontSize: '5.5rem', fontWeight: 'bold', color: '#1e293b', cursor: 'pointer', lineHeight: 1.1, textShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    revealedContent: { marginTop: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '25px', animation: 'fadeIn 0.5s ease' },
    textWordBurmese: { fontSize: '2.4rem', color: '#475569', fontFamily: 'Padauk', cursor: 'pointer', lineHeight: 1.4 },
    explanationText: { color: '#059669', fontSize: '1.3rem', fontWeight: '500', maxWidth: '90%' },
    exampleBox: { padding: '20px', borderBottom: '1px dashed #cbd5e1', cursor: 'pointer', width: '100%', textAlign: 'center' },
    rightControls: { position: 'fixed', right: '15px', top: '45%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: '15px', zIndex: 100 },
    rightIconButton: { width: '52px', height: '52px', borderRadius: '50%', background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', cursor: 'pointer', color: '#475569' },
    
    // 🔥 底部控制栏样式：去除毛玻璃，改为实体白色背景
    bottomControlsContainer: { 
        position: 'fixed', bottom: 0, left: 0, right: 0, 
        padding: '30px 25px 50px 25px', 
        zIndex: 10, 
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
        background: '#ffffff', // 实体背景
        borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -4px 30px rgba(0,0,0,0.05)'
    },
    bottomCenterCounter: { fontSize: '1rem', color: '#64748b', fontWeight: 'bold', background: '#f3f4f6', padding: '8px 22px', borderRadius: '25px', cursor: 'pointer', border: '1px solid #e5e7eb' },
    knowButtonsWrapper: { display: 'flex', width: '100%', maxWidth: '550px', gap: '15px' },
    knowButtonBase: { flex: 1, padding: '20px', borderRadius: '22px', border: 'none', color: 'white', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' },
    
    completionContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' },
    comparisonOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' },
    comparisonPanel: { background: 'white', width: '100%', maxWidth: '440px', borderRadius: '32px', padding: '35px', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.3)' },
    recordHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
    closeButtonSimple: { background: 'none', border: 'none', fontSize: '1.6rem', color: '#94a3b8', cursor: 'pointer' },
    recordContent: { textAlign: 'center' },
    bigRecordBtn: { width: '90px', height: '90px', borderRadius: '50%', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 25px rgba(59, 130, 246, 0.4)' },
    circleBtnBlue: { width: '60px', height: '60px', borderRadius: '50%', background: '#3b82f6', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    circleBtnGreen: { width: '60px', height: '60px', borderRadius: '50%', background: '#10b981', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    circleBtnGray: { width: '60px', height: '60px', borderRadius: '50%', background: '#94a3b8', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
    settingsContent: { background: 'white', width: '100%', maxWidth: '500px', borderRadius: '32px', padding: '40px', position: 'relative', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' },
    closeButton: { position: 'absolute', top: '25px', right: '25px', background: 'none', border: 'none', fontSize: '1.8rem', color: '#cbd5e1', cursor: 'pointer' },
    settingGroup: { marginBottom: '35px' },
    settingLabel: { display: 'block', fontWeight: '800', marginBottom: '15px', fontSize: '1.1rem', color: '#334155' },
    settingControl: { display: 'flex', gap: '15px' },
    settingButton: { flex: 1, padding: '16px', borderRadius: '18px', border: 'none', cursor: 'pointer', fontWeight: '800', transition: 'all 0.2s' },
    settingSelect: { width: '100%', padding: '16px', borderRadius: '18px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontWeight: '600' },
    jumpModalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    jumpModalContent: { background: 'white', padding: '45px', borderRadius: '35px', textAlign: 'center', boxShadow: '0 30px 60px rgba(0,0,0,0.4)' },
    jumpModalInput: { width: '120px', padding: '18px', fontSize: '2rem', textAlign: 'center', border: '3px solid #e2e8f0', borderRadius: '18px', marginBottom: '30px', fontWeight: 'bold' },
    jumpModalButton: { width: '100%', padding: '18px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '18px', fontWeight: 'bold', fontSize: '1.2rem' }
};

export default WordCard;
