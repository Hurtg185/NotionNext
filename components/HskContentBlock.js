// components/HskContentBlock.js
import React from 'react';
import { ChevronLeft } from 'lucide-react';

const HskContentBlock = ({ 
  icon: Icon,      // 传入的图标组件，比如 BookOpen
  title,           // 标题，比如 "生词学习"
  subtitle,        // 副标题，比如 "Words • 150 词"
  onClick,         // 点击事件
  color = "blue"   // 颜色主题：blue, emerald, orange
}) => {
  
  // 定义不同颜色的样式映射
  const colorStyles = {
    blue: {
      bg: "bg-blue-50 dark:bg-blue-900/30",
      text: "text-blue-600 dark:text-blue-400"
    },
    emerald: { // 对应原来的 green
      bg: "bg-emerald-50 dark:bg-emerald-900/30",
      text: "text-emerald-600 dark:text-emerald-400"
    },
    orange: {
      bg: "bg-orange-50 dark:bg-orange-900/30",
      text: "text-orange-600 dark:text-orange-400"
    }
  };

  const currentStyle = colorStyles[color] || colorStyles.blue;

  return (
    <button
      onClick={onClick}
      className="group relative w-full bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-5
                 transition-transform duration-200 active:scale-95 active:bg-gray-50"
    >
      {/* 图标区域 */}
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${currentStyle.bg} ${currentStyle.text}`}>
        <Icon size={26} />
      </div>

      {/* 文字区域 */}
      <div className="flex flex-col items-start">
        <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
          {title}
        </span>
        <span className="text-xs text-gray-400 mt-0.5">
          {subtitle}
        </span>
      </div>

      {/* 右侧箭头 */}
      <div className="ml-auto text-gray-300">
        <ChevronLeft size={20} className="rotate-180" />
      </div>
    </button>
  );
};

export default HskContentBlock;
