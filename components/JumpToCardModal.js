// /components/JumpToCardModal.js - 升级版：支持数字输入
import React, { useState } from 'react';

const JumpToCardModal = ({ total, current, onJump, onClose }) => {
  const [inputValue, setInputValue] = useState('');

  const handleJumpWithInput = () => {
    const page = parseInt(inputValue, 10);
    if (page >= 1 && page <= total) {
      onJump(page - 1);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleJumpWithInput();
    }
  };

  if (total <= 1) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-11/12 max-w-md h-auto max-h-[80vh] p-4 bg-gray-800/80 border border-white/20 rounded-2xl shadow-lg flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <h4 className="text-lg font-bold text-white text-center mb-4 flex-shrink-0">跳转到卡片</h4>
        {/* 新增：输入框和跳转按钮 */}
        <div className="flex gap-2 mb-4 flex-shrink-0">
          <input 
            type="number"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`输入 1-${total} 的数字`}
            className="flex-grow bg-white/10 text-white placeholder-white/40 rounded-lg px-3 py-2 border-0 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button onClick={handleJumpWithInput} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">跳转</button>
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 gap-2 overflow-y-auto">
          {Array.from({ length: total }, (_, i) => i + 1).map(pageNumber => (
            <button key={pageNumber} onClick={() => onJump(pageNumber - 1)} className={`...`}>
              {pageNumber}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default JumpToCardModal;
