// /components/JumpToCardModal.js - 新增的页码跳转组件
import React from 'react';

const JumpToCardModal = ({ total, current, onJump, onClose }) => {
  if (total <= 1) return null;

  return (
    <div 
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-11/12 max-w-md h-auto max-h-[70vh] p-4 bg-gray-800/80 border border-white/20 rounded-2xl shadow-lg overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h4 className="text-lg font-bold text-white text-center mb-4">跳转到卡片</h4>
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 gap-2">
          {Array.from({ length: total }, (_, i) => i + 1).map(pageNumber => (
            <button
              key={pageNumber}
              onClick={() => onJump(pageNumber - 1)}
              className={`flex items-center justify-center aspect-square rounded-lg transition-all duration-200 text-white font-semibold
                ${pageNumber - 1 === current 
                  ? 'bg-blue-600 ring-2 ring-white cursor-default' 
                  : 'bg-white/10 hover:bg-white/20'
                }`
              }
            >
              {pageNumber}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default JumpToCardModal;
