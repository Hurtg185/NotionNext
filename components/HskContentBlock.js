'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Mic2,
  Music4,
  Layers,
  BookText,
  Lightbulb,
  PlayCircle,
  Gem,
  MessageCircle,
  Crown,
  Star,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Volume2,
  Globe,
  X,
  Library,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useSwipeable } from 'react-swipeable';

import AIChatDrawer from './AiChatAssistant';
import BookLibrary from '@/components/BookLibrary';

const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false });

import hsk1Words from '@/data/hsk/hsk1.json';
import hsk2Words from '@/data/hsk/hsk2.json';

const canUseDOM = () => typeof window !== 'undefined';

const FB_CHAT_LINK = 'https://m.me/61575187883357';
const FAVORITES_STORAGE_KEY = 'framer-pinyin-favorites';

const getLevelPrice = (level) => {
  const prices = {
    1: '10,000 Ks',
    2: '15,000 Ks',
    3: '20,000 Ks',
    SP: '30,000 Ks'
  };
  return prices[level] || 'Contact Us';
};

const getSingleQuery = (value) => (Array.isArray(value) ? value[0] : value);

const pinyinMain = [
  { id: 'initials', title: '声母', sub: 'ဗျည်း', href: '/pinyin/initials', icon: Mic2, color: 'text-blue-600', bg: 'from-blue-50 to-cyan-50' },
  { id: 'finals', title: '韵母', sub: 'သရ', href: '/pinyin/finals', icon: Music4, color: 'text-emerald-600', bg: 'from-emerald-50 to-teal-50' },
  { id: 'whole', title: '整体', sub: 'အသံတွဲ', href: '/pinyin/whole', icon: Layers, color: 'text-violet-600', bg: 'from-violet-50 to-fuchsia-50' },
  { id: 'tones', title: '声调', sub: 'အသံ', href: '/pinyin/tones', icon: BookText, color: 'text-amber-600', bg: 'from-amber-50 to-orange-50' }
];

const hskData = [
  {
    level: 1,
    title: '入门 (Intro)',
    description: '掌握最常用词语和基本语法',
    descBurmese: 'အသုံးအများဆုံး စကားလုံးများနှင့် သဒ္ဒါ',
    imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&q=80',
    lessons: [
      { id: 1, title: '第 1 课 你好' },
      { id: 2, title: '第 2 课 谢谢你' },
      { id: 3, title: '第 3 课 你叫什么名字？' },
      { id: 4, title: '第 4 课 她是我的汉语老师' },
      { id: 5, title: '第 5 课 她女儿今年二十岁' },
      { id: 6, title: '第 6 课 我会说汉语' },
      { id: 7, title: '第 7 课 今天几号？' },
      { id: 8, title: '第 8 课 我想喝茶' }
    ]
  },
  {
    level: 2,
    title: '基础 (Basic)',
    description: '就熟悉的日常话题进行交流',
    descBurmese: 'နေ့စဉ်သုံး စကားပြောများ',
    imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80',
    lessons: [
      { id: 1, title: '第 1 课 九月去北京旅游最好' },
      { id: 2, title: '第 2 课 我每天六点起床' },
      { id: 3, title: '第 3 课 左边那个红色的是我的' }
    ]
  }
];

const hskWordsData = {
  1: hsk1Words || [],
  2: hsk2Words || []
};

const checkIsFree = (level, lessonId) => {
  if (level === 1) return lessonId <= 2;
  return lessonId === 1;
};

const panelClass =
  'rounded-[1.6rem] border border-slate-200/70 bg-white/90 backdrop-blur shadow-[0_10px_30px_rgba(15,23,42,0.08)]';

const MembershipModal = ({ isOpen, onClose, targetLevel }) => {
  if (!isOpen) return null;
  const price = getLevelPrice(targetLevel);
  const isSpoken = targetLevel === 'SP';

  return (
    <div className='fixed inset-0 z-[160] flex items-center justify-center p-4'>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className='absolute inset-0 bg-slate-900/60 backdrop-blur-sm'
      />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        className='relative w-full max-w-sm rounded-[1.8rem] bg-white p-6 shadow-2xl'
      >
        <button
          onClick={onClose}
          className='absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500'
          aria-label='关闭'
        >
          <X size={18} />
        </button>

        <div className='mt-2 text-center'>
          <div className='mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100'>
            <Crown className='text-amber-600' size={28} />
          </div>
          <h2 className='text-xl font-black text-slate-800'>{isSpoken ? '口语特训课程' : `HSK ${targetLevel}`}</h2>
          <p className='mb-5 mt-1 text-sm font-medium text-slate-500'>
            {isSpoken ? '地道场景、谐音助记与 AI 评测' : '完整视频讲解与练习题'}
            <br />
            <span className='text-xs text-slate-400'>(အတန်းစုံလင်စွာ သင်ယူနိုင်ပါသည်)</span>
          </p>

          <div className='mb-5 rounded-2xl border border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50 p-4'>
            <p className='text-3xl font-black text-amber-500'>{price}</p>
          </div>

          <a
            href={FB_CHAT_LINK}
            target='_blank'
            rel='noopener noreferrer'
            className='flex w-full items-center justify-center gap-2 rounded-xl bg-[#0084FF] py-3.5 font-bold text-white shadow-lg active:scale-95'
          >
            <MessageCircle size={20} fill='currentColor' />
            ဆက်သွယ်ရန် (Contact)
          </a>
        </div>
      </motion.div>
    </div>
  );
};

const HskCard = ({ level, onVocabularyClick, onShowMembership, index }) => {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  const freeCount = level.lessons.filter((l) => checkIsFree(level.level, l.id)).length;

  const handleLessonClick = (lesson) => {
    const isFree = checkIsFree(level.level, lesson.id);
    if (!isFree) {
      onShowMembership(level.level);
      return;
    }
    router.push(`/hsk/${level.level}/lessons/${lesson.id}`);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className='overflow-hidden rounded-[1.6rem] border border-slate-100 bg-white shadow-sm'
    >
      <div className='relative h-44'>
        <img src={level.imageUrl} className='h-full w-full object-cover' alt={`HSK ${level.level}`} />
        <div className='absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent' />

        <div className='absolute left-4 top-4 flex items-center gap-2'>
          <span className='rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-slate-700'>
            HSK {level.level}
          </span>
          <span className='rounded-full bg-cyan-400/90 px-2.5 py-1 text-[10px] font-black text-white'>
            {freeCount} Free
          </span>
        </div>

        <div className='absolute bottom-4 left-5 right-5 text-white'>
          <p className='mb-0.5 text-[10px] font-bold uppercase tracking-widest text-cyan-300'>{level.title}</p>
          <h2 className='text-2xl font-black'>HSK {level.level}</h2>
          <p className='mt-1 text-[11px] text-slate-200'>{level.descBurmese}</p>
          <p className='mt-0.5 text-[10px] text-slate-300'>{level.description}</p>
        </div>
      </div>

      <div className='space-y-2 p-4'>
        {(isExpanded ? level.lessons : level.lessons.slice(0, 3)).map((lesson) => {
          const free = checkIsFree(level.level, lesson.id);
          return (
            <button
              key={lesson.id}
              type='button'
              onClick={() => handleLessonClick(lesson)}
              className='flex min-h-[50px] w-full items-center rounded-xl border border-slate-100 bg-slate-50 p-3 text-left active:bg-slate-100'
            >
              <div className={`mr-3 rounded-full p-1.5 ${free ? 'bg-cyan-100 text-cyan-600' : 'bg-amber-100 text-amber-600'}`}>
                {free ? <PlayCircle size={14} fill='currentColor' /> : <Gem size={14} />}
              </div>
              <span className='flex-grow truncate text-sm font-bold text-slate-700'>{lesson.title}</span>
              <span className={`ml-2 rounded-full px-2 py-0.5 text-[9px] font-black ${free ? 'bg-cyan-50 text-cyan-600' : 'bg-amber-50 text-amber-600'}`}>
                {free ? 'FREE' : 'PRO'}
              </span>
            </button>
          );
        })}
      </div>

      <div className='flex flex-col gap-3 px-4 pb-5 pt-1'>
        {level.lessons.length > 3 && (
          <button
            type='button'
            onClick={() => setIsExpanded((prev) => !prev)}
            className='flex min-h-[42px] w-full items-center justify-center gap-1 rounded-xl border border-slate-100 bg-slate-50 py-2.5 text-xs font-bold text-slate-500 active:scale-[0.99]'
          >
            {isExpanded ? 'See Less' : `View All ${level.lessons.length} Lessons`}
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}

        <button
          type='button'
          onClick={() => onVocabularyClick(level)}
          className='min-h-[44px] w-full rounded-xl border border-pink-100 bg-gradient-to-r from-pink-50 to-rose-50 py-3 text-xs font-black text-rose-500 active:scale-[0.99]'
        >
          <span className='inline-flex items-center gap-2'>
            <BookOpen size={14} />
            核心生词
            <span className='ml-1 text-[10px] font-normal opacity-70'>(ဝေါဟာရများ)</span>
          </span>
        </button>
      </div>
    </motion.section>
  );
};

const PinyinSection = ({ onOpenCollection, onOpenSpokenCollection, onOpenTranslator, onOpenBooks }) => {
  const router = useRouter();

  return (
    <div className='space-y-3'>
      <div className='rounded-2xl border border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white'>
        <div className='flex items-start justify-between'>
          <div>
            <p className='text-[11px] font-bold uppercase tracking-widest text-cyan-300'>Learning Center</p>
            <h1 className='mt-1 text-lg font-black'>HSK Mobile Hub</h1>
            <p className='mt-1 text-[11px] text-slate-300'>အသံထွက်၊ စာလုံး၊ ဘာသာပြန်နှင့် စာကြည့်တိုက်</p>
          </div>
          <div className='rounded-xl bg-white/10 p-2 text-cyan-300'>
            <Sparkles size={18} />
          </div>
        </div>
      </div>

      <div className='grid grid-cols-4 gap-2.5'>
        {pinyinMain.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`flex min-h-[86px] flex-col items-center justify-center rounded-2xl border border-slate-100 bg-gradient-to-br ${item.bg} px-1.5 active:scale-[0.98]`}
          >
            <div className='mb-1.5 rounded-full bg-white p-1.5 shadow-sm'>
              <item.icon size={16} className={item.color} />
            </div>
            <span className='text-center text-[10px] font-black leading-tight text-slate-700'>
              {item.title}
              <br />
              <span className='text-[8px] font-semibold text-slate-500'>{item.sub}</span>
            </span>
          </Link>
        ))}
      </div>

      <button
        type='button'
        onClick={() => router.push('/pinyin/tips')}
        className='flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-orange-100/50 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 active:scale-[0.99]'
      >
        <div className='flex items-center gap-3'>
          <div className='shrink-0 rounded-full bg-white p-1.5 text-orange-500 shadow-sm'>
            <Lightbulb size={16} fill='currentColor' />
          </div>
          <div className='text-left'>
            <span className='block text-xs font-black text-slate-700'>发音技巧 (Tips)</span>
            <span className='block text-[10px] font-medium text-slate-500'>အသံထွက်နည်းလမ်းများ</span>
          </div>
        </div>
        <ChevronRight size={16} className='text-orange-300' />
      </button>

      <div className='grid grid-cols-2 gap-3'>
        <button
          type='button'
          onClick={onOpenTranslator}
          className='flex min-h-[76px] flex-col items-center justify-center rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 py-3 active:scale-[0.99]'
        >
          <div className='mb-1 flex items-center gap-1.5 text-blue-700'>
            <Globe size={16} />
            <span className='text-xs font-black'>AI 翻译</span>
          </div>
          <span className='text-[9px] text-slate-500'>AI ဘာသာပြန်</span>
        </button>

        <button
          type='button'
          onClick={onOpenBooks}
          className='flex min-h-[76px] flex-col items-center justify-center rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-teal-50 py-3 active:scale-[0.99]'
        >
          <div className='mb-1 flex items-center gap-1.5 text-cyan-700'>
            <Library size={16} />
            <span className='text-xs font-black'>免费书籍</span>
          </div>
          <span className='text-[9px] text-slate-500'>စာကြည့်တိုက်</span>
        </button>
      </div>

      <div className='grid grid-cols-2 gap-3'>
        <button
          type='button'
          onClick={onOpenCollection}
          className='flex min-h-[72px] flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white py-3 shadow-sm active:scale-[0.99]'
        >
          <div className='mb-1 flex items-center gap-1.5 text-slate-700'>
            <Star size={14} fill='currentColor' />
            <span className='text-xs font-black'>单词收藏</span>
          </div>
          <span className='text-[9px] text-slate-400'>မှတ်ထားသော စာလုံး</span>
        </button>

        <button
          type='button'
          onClick={onOpenSpokenCollection}
          className='flex min-h-[72px] flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white py-3 shadow-sm active:scale-[0.99]'
        >
          <div className='mb-1 flex items-center gap-1.5 text-slate-700'>
            <Volume2 size={14} fill='currentColor' />
            <span className='text-xs font-black'>口语收藏</span>
          </div>
          <span className='text-[9px] text-slate-400'>မှတ်ထားသော စကားပြော</span>
        </button>
      </div>
    </div>
  );
};

export default function HskPageClient() {
  const router = useRouter();

  const [activeHskWords, setActiveHskWords] = useState([]);
  const [activeLevelTag, setActiveLevelTag] = useState('hsk-vocab');

  const [activeOverlay, setActiveOverlay] = useState(null);
  const [membershipLevel, setMembershipLevel] = useState(null);

  const isCardViewOpen = router.asPath.includes('#hsk-vocabulary');
  const isTranslatorOpen = activeOverlay === 'translator';
  const isBookLibraryOpen = activeOverlay === 'books';
  const isMembershipOpen = activeOverlay === 'membership';

  const openOverlay = useCallback((overlayType, payload = null) => {
    setActiveOverlay((prev) => {
      if (prev === overlayType) return prev;
      if (canUseDOM()) {
        window.history.pushState({ overlay: overlayType }, '', window.location.href);
      }
      return overlayType;
    });
    setMembershipLevel(overlayType === 'membership' ? payload : null);
  }, []);

  const closeOverlay = useCallback(() => {
    if (activeOverlay && canUseDOM()) {
      window.history.back();
      return;
    }
    setActiveOverlay(null);
    setMembershipLevel(null);
  }, [activeOverlay]);

  useEffect(() => {
    if (!canUseDOM()) return;

    const onPopState = () => {
      setActiveOverlay(null);
      setMembershipLevel(null);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const overlaySwipeHandlers = useSwipeable({
    onSwipedRight: () => closeOverlay(),
    trackMouse: false,
    delta: 45,
    preventScrollOnSwipe: false
  });

  const handleSpokenCollectionClick = useCallback(() => {
    router.push({
      pathname: '/spoken',
      query: { filter: 'favorites' }
    });
  }, [router]);

  const closeWordCard = useCallback(() => {
    const base = router.asPath.split('#')[0];
    router.replace(base, undefined, { shallow: true, scroll: false });
  }, [router]);

  const getFavoriteWords = useCallback(() => {
    if (!canUseDOM()) return [];
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      const savedIds = raw ? JSON.parse(raw) : [];
      const allWords = [...(hskWordsData[1] || []), ...(hskWordsData[2] || [])];
      return allWords.filter(
        (word) => Array.isArray(savedIds) && savedIds.some((savedId) => String(savedId) === String(word.id))
      );
    } catch (_) {
      return [];
    }
  }, []);

  const handleVocabularyClick = useCallback(
    (level) => {
      const levelNum = Number(level?.level || 1);
      const words = hskWordsData[levelNum] || [];

      setActiveHskWords(words);
      setActiveLevelTag(`hsk${levelNum}`);

      const nextQuery = { ...router.query, level: String(levelNum) };
      delete nextQuery.view;

      router.push({ pathname: router.pathname, query: nextQuery, hash: 'hsk-vocabulary' }, undefined, {
        shallow: true,
        scroll: false
      });
    },
    [router]
  );

  const handleCollectionClick = useCallback(() => {
    const favoriteWords = getFavoriteWords();

    if (!favoriteWords.length) {
      alert('No saved words yet!\nမှတ်ထားသော စာလုံး မရှိသေးပါ');
      return;
    }

    setActiveHskWords(favoriteWords);
    setActiveLevelTag('my-favorites-collection');

    const nextQuery = { ...router.query, view: 'favorites' };
    delete nextQuery.level;

    router.push({ pathname: router.pathname, query: nextQuery, hash: 'hsk-vocabulary' }, undefined, {
      shallow: true,
      scroll: false
    });
  }, [getFavoriteWords, router]);

  useEffect(() => {
    if (!router.isReady || !isCardViewOpen) return;

    const levelParam = Number(getSingleQuery(router.query.level));
    const viewParam = getSingleQuery(router.query.view);

    if (Number.isFinite(levelParam) && hskWordsData[levelParam]) {
      setActiveHskWords(hskWordsData[levelParam]);
      setActiveLevelTag(`hsk${levelParam}`);
      return;
    }

    if (viewParam === 'favorites') {
      const favoriteWords = getFavoriteWords();
      setActiveHskWords(favoriteWords);
      setActiveLevelTag('my-favorites-collection');
    }
  }, [router.isReady, router.query.level, router.query.view, isCardViewOpen, getFavoriteWords]);

  return (
    <div className='relative min-h-[100dvh] w-full overflow-x-hidden bg-[#f4f7fb] pb-16 font-sans text-slate-900'>
      <div className='pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-cyan-200/35 blur-3xl' />
      <div className='pointer-events-none absolute right-[-80px] top-[180px] h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl' />
      <div className='pointer-events-none absolute bottom-0 left-0 right-0 h-52 bg-gradient-to-t from-slate-100/80 to-transparent' />

      <header className='relative z-10 px-4 pb-1 pt-4'>
        <div className={`${panelClass} p-4`}>
          <PinyinSection
            onOpenCollection={handleCollectionClick}
            onOpenSpokenCollection={handleSpokenCollectionClick}
            onOpenTranslator={() => openOverlay('translator')}
            onOpenBooks={() => openOverlay('books')}
          />
        </div>
      </header>

      <main className='relative z-10 mt-6 space-y-4 px-4 pb-10'>
        <div className='flex items-center gap-2 px-1 opacity-75'>
          <BookText size={14} className='text-slate-500' />
          <h2 className='text-xs font-black uppercase tracking-wider text-slate-600'>System Courses (သင်ရိုး)</h2>
        </div>

        <div className='grid grid-cols-1 gap-5'>
          {hskData.map((level, index) => (
            <HskCard
              key={level.level}
              level={level}
              index={index}
              onVocabularyClick={handleVocabularyClick}
              onShowMembership={(l) => openOverlay('membership', l)}
            />
          ))}
        </div>
      </main>

      <AnimatePresence>
        {isMembershipOpen && (
          <MembershipModal isOpen={isMembershipOpen} onClose={closeOverlay} targetLevel={membershipLevel} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTranslatorOpen && (
          <motion.div
            {...overlaySwipeHandlers}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 z-[140] bg-white'
          >
            <AIChatDrawer isOpen={isTranslatorOpen} onClose={closeOverlay} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBookLibraryOpen && (
          <motion.div
            {...overlaySwipeHandlers}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 z-[140] bg-white'
          >
            <BookLibrary isOpen={isBookLibraryOpen} onClose={closeOverlay} />
          </motion.div>
        )}
      </AnimatePresence>

      <WordCard
        isOpen={isCardViewOpen}
        words={activeHskWords || []}
        onClose={closeWordCard}
        progressKey={activeLevelTag || 'hsk-vocab'}
      />
    </div>
  );
}
