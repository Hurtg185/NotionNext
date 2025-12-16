import React, { useState } from 'react';
import { 
    BookOpen, 
    GraduationCap, 
    Dumbbell, 
    ChevronLeft, 
    PlayCircle, 
    CheckCircle2, 
    XCircle,
    ChevronRight,
    Search
} from 'lucide-react';

// ================= 模拟数据 (您可以稍后替换为数据库/Notion数据) =================

const HSK_LEVELS = [
    { level: 1, title: 'HSK 1级', desc: '基础入门 (150词)', color: 'from-blue-400 to-blue-600', shadow: 'shadow-blue-200' },
    { level: 2, title: 'HSK 2级', desc: '初级阶段 (300词)', color: 'from-cyan-400 to-cyan-600', shadow: 'shadow-cyan-200' },
    { level: 3, title: 'HSK 3级', desc: '进阶提升 (600词)', color: 'from-emerald-400 to-emerald-600', shadow: 'shadow-emerald-200' },
    { level: 4, title: 'HSK 4级', desc: '中级流利 (1200词)', color: 'from-orange-400 to-orange-600', shadow: 'shadow-orange-200' },
    { level: 5, title: 'HSK 5级', desc: '高级运用 (2500词)', color: 'from-red-400 to-red-600', shadow: 'shadow-red-200' },
    { level: 6, title: 'HSK 6级', desc: '精通掌握 (5000+词)', color: 'from-purple-400 to-purple-600', shadow: 'shadow-purple-200' },
];

const MOCK_WORDS = [
    { id: 1, hanzi: '爱', pinyin: 'ài', mean: 'love; to like', example: '我爱你。' },
    { id: 2, hanzi: '八', pinyin: 'bā', mean: 'eight', example: '我有八本书。' },
    { id: 3, hanzi: '爸爸', pinyin: 'bàba', mean: 'dad, father', example: '我爸爸是医生。' },
    { id: 4, hanzi: '杯子', pinyin: 'bēizi', mean: 'cup, glass', example: '这是一个杯子。' },
];

const MOCK_GRAMMAR = [
    { id: 1, title: '是 (shì) 字句', desc: '用来连接主语和名词，表示“是什么”。', structure: 'A + 是 + B', example: '我是学生。' },
    { id: 2, title: '吗 (ma) 疑问句', desc: '用在句尾表示疑问。', structure: '陈述句 + 吗？', example: '你是中国人吗？' },
];

const MOCK_PRACTICE = [
    { 
        id: 1, 
        question: 'Which matches "Apple"?', 
        options: ['苹果 (píngguǒ)', '香蕉 (xiāngjiāo)', '西瓜 (xīguā)'], 
        correct: 0 
    },
    { 
        id: 2, 
        question: 'Fill in: 你好__？', 
        options: ['呢', '吗', '吧'], 
        correct: 1 
    }
];

// ================= 子组件部分 =================

// 1. 单词列表组件
const WordList = () => (
    <div className="space-y-3 pb-20">
        <div className="relative mb-4">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input 
                type="text" 
                placeholder="搜索单词..." 
                className="w-full bg-gray-100 dark:bg-gray-700/50 py-2.5 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
        </div>
        {MOCK_WORDS.map((item) => (
            <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <div>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">{item.hanzi}</h3>
                        <span className="text-sm text-gray-500 font-medium">{item.pinyin}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{item.mean}</p>
                </div>
                <button className="p-2 bg-blue-50 text-blue-500 rounded-full hover:bg-blue-100 dark:bg-gray-700 dark:text-blue-400">
                    <PlayCircle size={20} />
                </button>
            </div>
        ))}
    </div>
);

// 2. 语法列表组件
const GrammarList = () => (
    <div className="space-y-4 pb-20">
        {MOCK_GRAMMAR.map((item) => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm group">
                <div className="p-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700 dark:to-gray-800 border-b dark:border-gray-700">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                        <span className="w-1.5 h-5 bg-green-500 rounded-full"></span>
                        {item.title}
                    </h3>
                </div>
                <div className="p-4 space-y-3">
                    <p className="text-gray-600 dark:text-gray-300 text-sm">{item.desc}</p>
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                        <span className="text-xs font-bold text-orange-500 uppercase">Structure</span>
                        <p className="text-orange-700 dark:text-orange-300 font-mono text-sm mt-1">{item.structure}</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                        <span className="text-xs font-bold text-blue-500 uppercase">Example</span>
                        <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">{item.example}</p>
                    </div>
                </div>
            </div>
        ))}
    </div>
);

// 3. 练习组件
const PracticeMode = () => {
    const [selectedOptions, setSelectedOptions] = useState({});

    const handleSelect = (qId, optionIndex, correctIndex) => {
        setSelectedOptions(prev => ({
            ...prev,
            [qId]: { selected: optionIndex, isCorrect: optionIndex === correctIndex }
        }));
    };

    return (
        <div className="space-y-6 pb-20">
            {MOCK_PRACTICE.map((q, index) => {
                const status = selectedOptions[q.id];
                return (
                    <div key={q.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between mb-4">
                            <span className="text-xs font-bold text-gray-400">Question {index + 1}</span>
                        </div>
                        <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{q.question}</h4>
                        <div className="space-y-2">
                            {q.options.map((opt, idx) => {
                                let btnClass = "w-full text-left p-3 rounded-xl border transition-all text-sm font-medium ";
                                if (status) {
                                    if (idx === q.correct) btnClass += "bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-300";
                                    else if (status.selected === idx && !status.isCorrect) btnClass += "bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-300";
                                    else btnClass += "bg-gray-50 border-transparent opacity-50";
                                } else {
                                    btnClass += "bg-gray-50 dark:bg-gray-700/50 border-transparent hover:bg-blue-50 hover:border-blue-200 dark:text-gray-200";
                                }

                                return (
                                    <button 
                                        key={idx} 
                                        disabled={!!status}
                                        onClick={() => handleSelect(q.id, idx, q.correct)}
                                        className={btnClass}
                                    >
                                        <div className="flex justify-between items-center">
                                            {opt}
                                            {status && idx === q.correct && <CheckCircle2 size={16} className="text-green-600"/>}
                                            {status && status.selected === idx && !status.isCorrect && <XCircle size={16} className="text-red-600"/>}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};


// ================= 主组件 =================

const HskContentBlock = () => {
    const [currentLevel, setCurrentLevel] = useState(null); // null 显示列表, 1-6 显示详情
    const [activeTab, setActiveTab] = useState('words'); // words, grammar, practice

    // 返回列表视图
    if (!currentLevel) {
        return (
            <div className="animate-fade-in-up">
                <div className="mb-6">
                    <h2 className="text-2xl font-extrabold text-gray-800 dark:text-white">HSK 等级选择</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">请选择您当前的学习阶段</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pb-20">
                    {HSK_LEVELS.map((item) => (
                        <button 
                            key={item.level}
                            onClick={() => setCurrentLevel(item)}
                            className={`relative overflow-hidden rounded-2xl p-4 h-32 text-left flex flex-col justify-between shadow-lg hover:scale-[1.02] transition-transform duration-300 bg-gradient-to-br ${item.color}`}
                        >
                            <div className="absolute right-[-10px] bottom-[-10px] opacity-20 text-white">
                                <GraduationCap size={80} />
                            </div>
                            <div>
                                <h3 className="text-white text-xl font-black italic">HSK {item.level}</h3>
                                <div className="w-8 h-1 bg-white/40 rounded-full mt-2"></div>
                            </div>
                            <p className="text-white/90 text-xs font-medium z-10">{item.desc}</p>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // 详情视图
    return (
        <div className="flex flex-col h-full animate-fade-in-right">
            {/* 顶部导航 */}
            <div className="flex items-center gap-3 mb-6">
                <button 
                    onClick={() => { setCurrentLevel(null); setActiveTab('words'); }}
                    className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                >
                    <ChevronLeft size={24} />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">{currentLevel.title}</h2>
                    <p className="text-xs text-gray-500">正在学习</p>
                </div>
            </div>

            {/* Tab 切换 */}
            <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex mb-6">
                {[
                    { id: 'words', label: '单词', icon: BookOpen },
                    { id: 'grammar', label: '语法', icon: GraduationCap },
                    { id: 'practice', label: '练习', icon: Dumbbell }
                ].map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                                isActive 
                                ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* 内容区域 */}
            <div className="flex-grow">
                {activeTab === 'words' && <WordList />}
                {activeTab === 'grammar' && <GrammarList />}
                {activeTab === 'practice' && <PracticeMode />}
            </div>
        </div>
    );
};

export default HskContentBlock;
