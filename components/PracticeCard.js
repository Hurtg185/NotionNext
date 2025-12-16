import React from 'react';
import { X } from 'lucide-react';

const PracticeCard = ({ level, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col animate-in slide-in-from-bottom-10 duration-300">
      <div className="p-4 flex items-center justify-between border-b dark:border-gray-800">
        <h2 className="text-lg font-bold">HSK {level} 练习</h2>
        <button onClick={onClose} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
      </div>
      <div className="flex-1 flex items-center justify-center text-gray-500">
        练习模块开发中...
      </div>
    </div>
  );
};
export default PracticeCard;
