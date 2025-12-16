import React from 'react';
import { ChevronRight } from 'lucide-react';

const HskEntryCard = ({ icon: Icon, title, subtitle, color, onClick }) => {
  
  // 震动辅助函数
  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15); // 轻触震动
    }
    onClick && onClick();
  };

  // 颜色配置
  const styles = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', iconBg: 'bg-blue-100 dark:bg-blue-800', text: 'text-blue-600 dark:text-blue-400' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', iconBg: 'bg-emerald-100 dark:bg-emerald-800', text: 'text-emerald-600 dark:text-emerald-400' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', iconBg: 'bg-orange-100 dark:bg-orange-800', text: 'text-orange-600 dark:text-orange-400' }
  };

  const theme = styles[color] || styles.blue;

  return (
    <button
      onClick={triggerHaptic}
      className={`group relative w-full p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-5 transition-all duration-200 active:scale-95 active:bg-gray-50 dark:active:bg-gray-900 bg-white dark:bg-gray-900`}
    >
      {/* 图标 */}
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${theme.iconBg} ${theme.text}`}>
        <Icon size={28} strokeWidth={2.5} />
      </div>

      {/* 文字 */}
      <div className="flex flex-col items-start text-left">
        <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
          {title}
        </span>
        <span className="text-xs font-medium text-gray-400 mt-1 uppercase tracking-wider">
          {subtitle}
        </span>
      </div>

      {/* 箭头 (右侧自动对齐) */}
      <div className="ml-auto text-gray-300 group-hover:text-gray-400 transition-colors">
        <ChevronRight size={20} />
      </div>
    </button>
  );
};

export default HskEntryCard;
