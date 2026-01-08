'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Loader2, Maximize2, Info } from 'lucide-react';

export default function PremiumReader({ url, title, onClose }) {
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsClient(true);
    // 给引擎 3 秒的预载动画时间
    const timer = setTimeout(() => setIsLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!isClient) return null;

  // --- 核心逻辑：利用微软 Office Viewer ---
  // 微软引擎对移动端极其友好，能完美绕过“强制下载”
  // 注意：url 必须是你的 Worker 地址（确保公网可访问）
  const microsoftViewer = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[200] bg-[#f8fafc] flex flex-col font-sans"
    >
      {/* 顶部工具栏 - 仿 Notion 风格 */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="max-w-[180px]">
            <h1 className="text-sm font-bold text-slate-800 truncate">{title}</h1>
            <p className="text-[10px] text-slate-400 font-medium">HSK Digital Library</p>
          </div>
        </div>
        <button 
          onClick={() => window.open(url, '_blank')}
          className="p-2 bg-indigo-50 text-indigo-600 rounded-lg active:scale-95 transition-all"
        >
          <Maximize2 size={18} />
        </button>
      </header>

      {/* 阅读器主体 */}
      <div className="flex-1 relative bg-[#edf0f2] overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-[#f8fafc] flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <div className="text-center">
                <p className="text-[11px] font-black text-slate-800 tracking-widest uppercase">Securely Rendering</p>
                <p className="text-[10px] text-slate-400 mt-1">စာအုပ်ကို စနစ်တကျ ပြင်ဆင်နေပါသည်</p>
            </div>
          </div>
        )}
        
        {/* 
           模仿 Notion 的嵌入方式：
           通过微软引擎，手机端会看到一个带翻页器、可缩放的网页版 PDF
        */}
        <iframe
          src={microsoftViewer}
          className="w-full h-full border-none shadow-inner"
          onLoad={() => setIsLoading(false)}
        />
      </div>

      {/* 底部功能栏 */}
      <footer className="p-3 bg-white border-t border-slate-200 flex items-center justify-center gap-2 shrink-0">
          <Info size={12} className="text-slate-300" />
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
             Notion Style Embed • Powered by Microsoft
          </p>
      </footer>
    </motion.div>
  );
}
