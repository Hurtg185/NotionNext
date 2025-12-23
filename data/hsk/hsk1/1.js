import React, { useState, useEffect, useRef } from 'react';
import { 
  FaVolumeUp, FaChevronRight, FaTimes, 
  FaMagic, FaMicrophone, FaStop, FaPlay, FaRedo, FaBookOpen 
} from "react-icons/fa";
import { pinyin } from 'pinyin-pro';
import { Howl, Howler } from 'howler';

// ==========================================
// 1. 工具函数与音频控制
// ==========================================

const stopAllAudio = () => {
  try { Howler.unload(); } catch (e) {}
  const audioElements = document.getElementsByTagName('audio');
  for (let i = 0; i < audioElements.length; i++) {
    try {
      audioElements[i].pause();
      audioElements[i].currentTime = 0;
    } catch (e) {}
  }
};

const playR2Audio = (wordObj) => {
  stopAllAudio();
  
  // 核心逻辑：如果有 ID 和等级，尝试播放真实音频
  if (wordObj && wordObj.id && wordObj.hsk_level) {
    const formattedId = String(wordObj.id).padStart(4, '0'); // 例如 1 -> 0001
    const level = wordObj.hsk_level;
    const audioUrl = `https://audio.886.best/chinese-vocab-audio/hsk${level}/${formattedId}.mp3`;

    const sound = new Howl({
      src: [audioUrl],
      html5: true, 
      volume: 1.0,
      onloaderror: () => {
        console.warn("R2 Audio missing, fallback to TTS");
        playTTS(wordObj.word);
      },
      onplayerror: () => {
        playTTS(wordObj.word);
      }
    });
    sound.play();
  } else {
    // 数据不完整时，直接 TTS
    playTTS(wordObj?.word || "Error");
  }
};

const playSpellingAudio = (pyWithTone) => {
  return new Promise((resolve) => {
    const filename = encodeURIComponent(pyWithTone); 
    const url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${filename}.mp3`;
    
    const sound = new Howl({
      src: [url],
      html5: true,
      onend: resolve,
      onloaderror: resolve,
      onplayerror: resolve
    });
    sound.play();
  });
};

const playTTS = (text) => {
  if (!text) return;
  try { Howler.unload(); } catch(e){}
  // 使用微软中文语音
  const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural`;
  const audio = new Audio(url);
  audio.play().catch(e => console.error("TTS error", e));
};

// ==========================================
// 2. 拼读弹窗组件 (带录音)
// ==========================================

const SpellingModal = ({ wordObj, onClose }) => {
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const rawText = wordObj.word || "";
  
  // 录音状态
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    let isCancelled = false;
    const runSequence = async () => {
      const chars = rawText.split('');
      for (let i = 0; i < chars.length; i++) {
        if (isCancelled) return;
        setActiveCharIndex(i);
        const charPinyin = pinyin(chars[i], { toneType: 'symbol' });
        await playSpellingAudio(charPinyin);
        await new Promise(r => setTimeout(r, 150));
      }
      if (isCancelled) return;
      setActiveCharIndex('all');
      playR2Audio(wordObj);
    };
    runSequence();
    return () => {
      isCancelled = true;
      stopAllAudio();
    };
  }, [rawText, wordObj]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => { setAudioBlob(new Blob(audioChunksRef.current, { type: 'audio/webm' })); };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { alert("麦克风访问失败"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const playUserAudio = () => {
    if (audioBlob) {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audio.play();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-6" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 p-2"><FaTimes size={20}/></button>
        
        <div className="pt-10 pb-8 px-6 flex flex-col items-center">
          <h3 className="text-xs font-bold text-slate-400 mb-6 tracking-widest uppercase">SPELLING PRACTICE</h3>
          
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {rawText.split('').map((char, idx) => {
               const py = pinyin(char, { toneType: 'symbol' });
               const isActive = idx === activeCharIndex || activeCharIndex === 'all';
               return (
                 <div key={idx} className="flex flex-col items-center">
                   <span className={`text-lg font-mono mb-1 ${isActive ? 'text-orange-500 font-bold' : 'text-slate-300'}`}>{py}</span>
                   <span className={`text-5xl font-black transition-transform duration-300 ${isActive ? 'text-blue-600 scale-110' : 'text-slate-700 scale-100'}`}>{char}</span>
                 </div>
               )
            })}
          </div>

          <div className="w-full bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col items-center gap-4">
             <div className="flex items-center gap-6">
                {!isRecording ? (
                  <button onClick={startRecording} className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all">
                    <FaMicrophone size={20} />
                  </button>
                ) : (
                  <button onClick={stopRecording} className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center animate-pulse">
                    <FaStop size={20} />
                  </button>
                )}
                {audioBlob && !isRecording && (
                  <>
                    <button onClick={playUserAudio} className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all">
                      <FaPlay size={18} className="ml-1" />
                    </button>
                    <button onClick={() => setAudioBlob(null)} className="flex flex-col items-center text-slate-400 text-xs">
                       <FaRedo size={14} className="mb-1"/> 重录
                    </button>
                  </>
                )}
             </div>
             <div className="text-xs text-slate-400 font-medium">
                {isRecording ? "正在录音..." : (audioBlob ? "点击播放对比" : "点击麦克风跟读")}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. 简单的例句组件
// ==========================================

const SimpleExampleRow = ({ text, translation }) => {
  const py = pinyin(text, { toneType: 'symbol' });
  return (
    <div 
      className="flex flex-col items-start p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer group active:scale-[0.99]"
      onClick={() => playTTS(text)}
    >
      <div className="flex items-start gap-3 w-full">
        <div className="mt-1 w-1 h-8 bg-orange-200 rounded-full flex-none group-hover:bg-orange-400 transition-colors"></div>
        <div className="flex-1">
            <div className="text-xs text-slate-400 mb-1 font-mono">{py}</div>
            <div className="text-lg text-slate-800 font-medium leading-relaxed mb-1">{text}</div>
            {translation && (
              <div className="text-sm text-slate-500 font-['Padauk'] leading-relaxed opacity-90">
                {translation}
              </div>
            )}
        </div>
        <div className="opacity-0 group-hover:opacity-100 text-blue-400 self-center transition-opacity">
           <FaVolumeUp />
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 4. 数据 (HSK1 生词表)
// ==========================================

const HSK1_VOCAB_DATA = [
  { id: 1, hsk_level: 1, word: "你", pinyin: "nǐ", pos: "代 (Pron.)", definition: "သင် / မင်း", sound_burmese: "နီ", example: "你好。", example_burmese: "မင်္ဂလာပါ။", example2: "你是学生吗？", example2_burmese: "မင်းက ကျောင်းသားလား။" },
  { id: 2, hsk_level: 1, word: "好", pinyin: "hǎo", pos: "形 (Adj.)", definition: "ကောင်းသော", sound_burmese: "ဟောင်", example: "很好。", example_burmese: "သိပ်ကောင်းတယ်။", example2: "你好吗？", example2_burmese: "နေကောင်းလား။" },
  { id: 6, hsk_level: 1, word: "您", pinyin: "nín", pos: "代 (Pron.)", definition: "ခင်ဗျား / ရှင် (ယဉ်ကျေးသော)", sound_burmese: "နင်", example: "您好。", example_burmese: "မင်္ဂလာပါ (ယဉ်ကျေးသော)။", example2: "谢谢您。", example2_burmese: "ကျေးဇူးတင်ပါတယ်။" },
  { id: 4, hsk_level: 1, word: "你们", pinyin: "nǐ men", pos: "代 (Pron.)", definition: "သင်တို့ / မင်းတို့", sound_burmese: "နီမန်", example: "你们好。", example_burmese: "မင်းတို့အားလုံး မင်္ဂလာပါ။", example2: "你们是老师吗？", example2_burmese: "မင်းတို့က ဆရာတွေလား။" },
  { id: 5, hsk_level: 1, word: "对不起", pinyin: "duì bu qǐ", pos: "动 (Verb)", definition: "တောင်းပန်ပါတယ်", sound_burmese: "တွေ့ဘုချီ", example: "对不起，我来晚了。", example_burmese: "တောင်းပန်ပါတယ်၊ ကျွန်တော် နောက်ကျသွားတယ်။", example2: "对不起。", example2_burmese: "ဆောရီးပါ။" },
  { id: 6, hsk_level: 1, word: "没关系", pinyin: "méi guān xi", pos: "短语 (Phrase)", definition: "ကိစ္စမရှိပါဘူး / ရပါတယ်", sound_burmese: "မေကွမ်းရှီ", example: "A: 对不起。 B: 没关系。", example_burmese: "A: တောင်းပန်ပါတယ်။ B: ရပါတယ်။", example2: "真的没关系。", example2_burmese: "တကယ် ကိစ္စမရှိပါဘူး။" },
  { id: 7, hsk_level: 1, word: "谢谢", pinyin: "xiè xie", pos: "动 (Verb)", definition: "ကျေးဇူးတင်ပါတယ်", sound_burmese: "ရှဲ့ရှဲ့", example: "谢谢你。", example_burmese: "မင်းကို ကျေးဇူးတင်ပါတယ်။", example2: "不，谢谢。", example2_burmese: "ဟင့်အင်း၊ ကျေးဇူးပါ။" },
  { id: 8, hsk_level: 1, word: "不", pinyin: "bù", pos: "副 (Adv.)", definition: "မ (ငြင်းပယ်ခြင်း)", sound_burmese: "ပု", example: "不是。", example_burmese: "မဟုတ်ဘူး။", example2: "不好。", example2_burmese: "မကောင်းဘူး။" },
  { id: 9, hsk_level: 1, word: "不客气", pinyin: "bú kè qi", pos: "短语 (Phrase)", definition: "အားမနာပါနဲ့ / ရပါတယ်", sound_burmese: "ပုခေါ်ချိ", example: "A: 谢谢。 B: 不客气。", example_burmese: "A: ကျေးဇူးပါ။ B: ရပါတယ်။", example2: "您太客气了。", example2_burmese: "ခင်ဗျားက အရမ်း အားနာတတ်တာပဲ။" },
  { id: 10, hsk_level: 1, word: "再见", pinyin: "zài jiàn", pos: "动 (Verb)", definition: "နှုတ်ဆက်ပါတယ် / နောက်မှတွေ့မယ်", sound_burmese: "စိုက်ကျန်", example: "再见，明天见。", example_burmese: "တာတာ၊ မနက်ဖြန်မှ တွေ့မယ်။", example2: "老师再见。", example2_burmese: "ဆရာ တာတာ။" },
  { id: 24, hsk_level: 1, word: "叫", pinyin: "jiào", pos: "动 (Verb)", definition: "ခေါ်သည် / အမည်တွင်သည်", sound_burmese: "ကျောက်", example: "你叫什么名字？", example_burmese: "မင်းနာမည် ဘယ်လိုခေါ်လဲ။", example2: "我叫大卫。", example2_burmese: "ကျွန်တော့်နာမည် ဒေးဗစ်ပါ။" },
  { id: 25, hsk_level: 1, word: "什么", pinyin: "shén me", pos: "代 (Pron.)", definition: "ဘာလဲ", sound_burmese: "ရှင်မ", example: "这是什么？", example_burmese: "ဒါဘာလဲ။", example2: "你说什么？", example2_burmese: "မင်းဘာပြောလိုက်တာလဲ။" },
  { id: 26, hsk_level: 1, word: "名字", pinyin: "míng zi", pos: "名 (Noun)", definition: "နာမည်", sound_burmese: "မင်းဇ", example: "你的名字很好听。", example_burmese: "မင်းနာမည်က သိပ်ကောင်းတာပဲ။", example2: "写下你的名字。", example2_burmese: "မင်းနာမည်ကို ရေးပါ။" },
  { id: 14, hsk_level: 1, word: "我", pinyin: "wǒ", pos: "代 (Pron.)", definition: "ကျွန်တော် / ကျွန်မ", sound_burmese: "ဝေါ", example: "我是学生。", example_burmese: "ကျွန်တော်က ကျောင်းသားပါ။", example2: "我不去。", example2_burmese: "ကျွန်တော် မသွားဘူး။" },
  { id: 15, hsk_level: 1, word: "是", pinyin: "shì", pos: "动 (Verb)", definition: "ဖြစ်သည် / ဟုတ်သည်", sound_burmese: "ရှီ", example: "他是老师。", example_burmese: "သူက ဆရာတစ်ယောက် ဖြစ်တယ်။", example2: "是吗？", example2_burmese: "ဟုတ်လား။" },
  { id: 16, hsk_level: 1, word: "老师", pinyin: "lǎo shī", pos: "名 (Noun)", definition: "ဆရာ / ဆရာမ", sound_burmese: "လောင်ရှီ", example: "王老师。", example_burmese: "ဆရာဝမ်။", example2: "老师好。", example_burmese: "မင်္ဂလာပါ ဆရာ။" },
  { id: 17, hsk_level: 1, word: "吗", pinyin: "ma", pos: "助 (Part.)", definition: "လား (မေးခွန်း)", sound_burmese: "မာ", example: "你好吗？", example_burmese: "နေကောင်းလား။", example2: "是中国人吗？", example2_burmese: "တရုတ်လူမျိုးလား။" },
  { id: 18, hsk_level: 1, word: "学生", pinyin: "xué sheng", pos: "名 (Noun)", definition: "ကျောင်းသား", sound_burmese: "ရွှယ်ရှန်", example: "我们是学生。", example_burmese: "ကျွန်တော်တို့က ကျောင်းသားတွေပါ။", example2: "小学生。", example2_burmese: "မူလတန်းကျောင်းသား။" },
  { id: 19, hsk_level: 1, word: "人", pinyin: "rén", pos: "名 (Noun)", definition: "လူ", sound_burmese: "ရန်", example: "中国人。", example_burmese: "တရုတ်လူမျိုး။", example2: "好人。", example2_burmese: "လူကောင်း။" },
  { id: 20, hsk_level: 1, word: "中国", pinyin: "zhōng guó", pos: "名 (Noun)", definition: "တရုတ်ပြည်", sound_burmese: "ကျုံးကွော်", example: "我在中国。", example_burmese: "ကျွန်တော် တရုတ်ပြည်မှာ ရှိတယ်။", example2: "中国菜。", example2_burmese: "တရုတ်ဟင်း။" },
  { id: 21, hsk_level: 1, word: "美国", pinyin: "měi guó", pos: "名 (Noun)", definition: "အမေရိကန်", sound_burmese: "မေကွော်", example: "他是美国人。", example_burmese: "သူက အမေရိကန်လူမျိုး။", example2: "去美国。", example2_burmese: "အမေရိကန်ကို သွားမယ်။" },
  { id: 36, hsk_level: 1, word: "她", pinyin: "tā", pos: "代 (Pron.)", definition: "သူမ", sound_burmese: "ထာ", example: "她是我的朋友。", example_burmese: "သူမက ကျွန်တော့် သူငယ်ချင်းပါ။", example2: "她来了。", example2_burmese: "သူမ လာပြီ။" },
  { id: 28, hsk_level: 1, word: "谁", pinyin: "shéi", pos: "代 (Pron.)", definition: "ဘယ်သူလဲ", sound_burmese: "ရှေ", example: "他是谁？", example_burmese: "သူဘယ်သူလဲ။", example2: "谁的书？", example2_burmese: "ဘယ်သူ့စာအုပ်လဲ။" },
  { id: 29, hsk_level: 1, word: "的", pinyin: "de", pos: "助 (Part.)", definition: "၏ / သော", sound_burmese: "တ", example: "我的书。", example_burmese: "ကျွန်တော့်ရဲ့ စာအုပ်။", example2: "红色的。", example2_burmese: "အနီရောင်။" },
  { id: 30, hsk_level: 1, word: "汉语", pinyin: "hàn yǔ", pos: "名 (Noun)", definition: "တရုတ်စာ / တရုတ်စကား", sound_burmese: "ဟန်ယွီ", example: "说汉语。", example_burmese: "တရုတ်စကား ပြောတယ်။", example2: "汉语很难。", example_burmese: "တရုတ်စာ ခက်တယ်။" },
  { id: 32, hsk_level: 1, word: "哪", pinyin: "nǎ", pos: "代 (Pron.)", definition: "ဘယ်", sound_burmese: "နာ", example: "哪个人？", example_burmese: "ဘယ်လူလဲ။", example2: "哪怕。", example2_burmese: "ဘယ်လိုပဲဖြစ်ဖြစ်။" },
  { id: 33, hsk_level: 1, word: "国", pinyin: "guó", pos: "名 (Noun)", definition: "နိုင်ငံ", sound_burmese: "ကွော်", example: "哪国人？", example_burmese: "ဘယ်နိုင်ငံသားလဲ။", example2: "国家。", example2_burmese: "နိုင်ငံ။" },
  { id: 34, hsk_level: 1, word: "呢", pinyin: "ne", pos: "助 (Part.)", definition: "ရော / လဲ", sound_burmese: "န", example: "你呢？", example_burmese: "မင်းရော။", example2: "他在哪儿呢？", example2_burmese: "သူဘယ်မှာလဲ။" },
  { id: 35, hsk_level: 1, word: "他", pinyin: "tā", pos: "代 (Pron.)", definition: "သူ (ယောက်ျား)", sound_burmese: "ထာ", example: "他是谁？", example_burmese: "သူဘယ်သူလဲ။", example2: "问他。", example2_burmese: "သူ့ကို မေးလိုက်။" },
  { id: 37, hsk_level: 1, word: "同学", pinyin: "tóng xué", pos: "名 (Noun)", definition: "အတန်းဖော်", sound_burmese: "ထုံးရွှယ်", example: "老同学。", example_burmese: "အတန်းဖော်ဟောင်း။", example2: "同学们好。", example_burmese: "အတန်းဖော်တို့ မင်္ဂလာပါ။" },
  { id: 38, hsk_level: 1, word: "朋友", pinyin: "péng you", pos: "名 (Noun)", definition: "သူငယ်ချင်း", sound_burmese: "ဖုန်ယို", example: "好朋友。", example_burmese: "သူငယ်ချင်းကောင်း။", example2: "朋友们。", example2_burmese: "သူငယ်ချင်းများ။" }
];

// ==========================================
// 5. 主组件
// ==========================================

export default function WordStudyPlayer({ data = { words: HSK1_VOCAB_DATA }, onNext, onPrev }) {
  const words = data.words;
  const [index, setIndex] = useState(0);
  const [showSpelling, setShowSpelling] = useState(false);
  const currentWord = words[index];
  const total = words.length;

  useEffect(() => {
    // 切换单词时自动播放
    if (currentWord) {
      const timer = setTimeout(() => {
        playR2Audio(currentWord);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [index, currentWord]);

  const handleNext = () => {
    if (index < total - 1) setIndex(index + 1);
    else if (onNext) onNext();
  };

  if (!currentWord) return <div>Loading...</div>;

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-slate-50 text-slate-800 relative overflow-hidden font-sans">
      
      {/* 顶部进度条 */}
      <div className="flex-none h-16 px-6 flex items-center justify-between z-10 bg-white shadow-sm">
        <div className="flex items-center gap-2 text-slate-500 font-bold">
           <FaBookOpen className="text-blue-500"/>
           <span>HSK 1</span>
        </div>
        <div className="text-slate-400 text-sm font-mono bg-slate-100 px-3 py-1 rounded-full">
          {index + 1} <span className="text-slate-300">/</span> {total}
        </div>
      </div>

      {/* 主滚动区域 */}
      <div className="flex-1 overflow-y-auto pb-40 px-6 no-scrollbar">
        <div className="max-w-md mx-auto w-full pt-8 flex flex-col items-center">
          
          {/* 单词卡片 */}
          <div className="w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 mb-8 flex flex-col items-center relative overflow-hidden border border-white">
            {/* 背景装饰 */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-indigo-500"></div>

            {/* 拼音 */}
            <div className="text-xl text-slate-400 font-mono font-medium mb-1 mt-4">{currentWord.pinyin}</div>
            
            {/* 汉字 */}
            <h1 
              className="text-5xl font-black text-slate-800 mb-3 cursor-pointer active:scale-95 transition-transform"
              onClick={() => playR2Audio(currentWord)}
            >
              {currentWord.word}
            </h1>

            {/* 词性标记 */}
            <div className="mb-4 px-3 py-0.5 bg-slate-100 text-slate-400 text-xs rounded-md font-bold tracking-wide">
              {currentWord.pos}
            </div>

            {/* 缅文释义 */}
            <div className="text-center w-full mb-4">
               <div className="text-2xl font-bold text-blue-900 mb-1 font-['Padauk'] leading-normal">
                 {currentWord.definition}
               </div>
            </div>

            {/* 缅文谐音 (模拟发音) */}
            <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-full border border-yellow-100 mb-6">
               <span className="text-xs font-bold text-yellow-600 uppercase">Sound</span>
               <span className="text-lg font-bold text-slate-700 font-['Padauk']">{currentWord.sound_burmese}</span>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-4 w-full justify-center">
               <button 
                  onClick={() => setShowSpelling(true)}
                  className="flex-1 bg-blue-50 text-blue-600 py-3 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
               >
                 <FaMagic /> 拼读
               </button>
               <button 
                  onClick={() => playR2Audio(currentWord)}
                  className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
               >
                 <FaVolumeUp size={20}/>
               </button>
            </div>
          </div>

          {/* 例句区域 */}
          <div className="w-full space-y-4 mb-8">
             <div className="text-xs font-bold text-slate-400 ml-2 uppercase tracking-wider">Examples</div>
             {currentWord.example && (
                <SimpleExampleRow text={currentWord.example} translation={currentWord.example_burmese} />
             )}
             {currentWord.example2 && (
                <SimpleExampleRow text={currentWord.example2} translation={currentWord.example2_burmese} />
             )}
          </div>

        </div>
      </div>

      {/* 底部按钮区域 - 稍微上移 */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-md border-t border-slate-100 px-6 pt-4 pb-10" // pb-10 增加底部留白
      >
        <div className="max-w-md mx-auto">
          <button 
            onClick={handleNext}
            className="w-full h-14 bg-slate-900 text-white rounded-2xl font-bold text-lg shadow-xl shadow-slate-300 hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            {index === total - 1 ? "完成学习" : "继续"} <FaChevronRight size={14} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* 弹窗 */}
      {showSpelling && <SpellingModal wordObj={currentWord} onClose={() => setShowSpelling(false)} />}
    </div>
  );
}
