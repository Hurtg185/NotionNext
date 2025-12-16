// components/HskEntryCard.js
import React from 'react';
import { ChevronRight } from 'lucide-react';

const HskEntryCard = ({ icon: Icon, title, subtitle, color, onClick }) => {
  
  // 震动辅助函数
  const triggerHaptic = () => {
    // 只有在浏览器环境且支持 vibrate 时才调用
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15); 
    }
    onClick && onClick();
  };

  // 颜色配置表
  const styles = {
    blue: { 
      bg: 'bg-white dark:bg-gray-900', 
      iconBg: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' 
    },
    emerald: { 
      bg: 'bg-white dark:bg-gray-900', 
      iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' 
    },
    orange: { 
      bg: 'bg-white dark:bg-gray-900', 
      iconBg: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' 
    }
  };

  const theme = styles[color] || styles.blue;

  return (
    <button
      onClick={triggerHaptic}
      className={`group relative w-full p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4 sm:gap-5 
                 transition-all duration-200 active:scale-95 active:bg-gray-50 dark:active:bg-gray-800 ${theme.bg}`}
    >
      {/* 图标区域 */}
      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${theme.iconBg}`}>
        <Icon size={24} strokeWidth={2.5} className="sm:w-[28px] sm:h-[28px]" />
      </div>

      {/* 文字区域 */}
      <div className="flex flex-col items-start text-left">
        <span className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 leading-tight">
          {title}
        </span>
        <span className="text-xs font-medium text-gray-400 mt-1 uppercase tracking-wider">
          {subtitle}
        </span>
      </div>

      {/* 右侧箭头 */}
      <div className="ml-auto text-gray-300 group-hover:text-gray-400 transition-colors">
        <ChevronRight size={20} />
      </div>
    </button>
  );
};

export default HskEntryCard;
