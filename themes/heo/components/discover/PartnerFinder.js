// themes/heo/components/discover/PartnerFinder.js (智能排序版)

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/Auth--';
import { getLanguagePartners } from '@/lib/user';
import { useRouter } from 'next/router';
import { HiOutlineChatBubbleLeftEllipsis } from 'react-icons/hi2';
import { startChat } from '@/lib/chat';
import { useDrawer } from '@/lib/DrawerContext';

// 单个语伴卡片 (保持不变)
const PartnerCard = ({ partner, onGreet }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transform hover:-translate-y-1 transition-transform duration-200">
    {/* ... (卡片 UI 保持不变) ... */}
  </div>
);

const PartnerFinder = () => {
  const { user: currentUser } = useAuth();
  const { openDrawer } = useDrawer();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      setPartners([]);
      return;
    }
    setLoading(true);
    const unsubscribe = getLanguagePartners((data) => {
      // 过滤掉自己
      const filteredData = data.filter(p => p.id !== currentUser.uid);
      setPartners(filteredData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // 【核心】智能排序算法
  const sortedPartners = useMemo(() => {
    if (!currentUser || partners.length === 0) return [];

    return [...partners].sort((a, b) => {
      // 计算 a 和 b 的匹配分数
      const scoreA = calculateMatchScore(currentUser, a);
      const scoreB = calculateMatchScore(currentUser, b);
      
      // 分数高的排在前面
      return scoreB - scoreA;
    });
  }, [partners, currentUser]);

  // 计算匹配分数的函数
  const calculateMatchScore = (me, other) => {
    let score = 0;

    // 1. 在线状态 (最高权重)
    if (other.isOnline) {
      score += 1000;
    }

    // 2. 语言互补性 (高权重)
    const isLanguageComplementary = 
      me.targetLanguage?.includes(other.nativeLanguage) &&
      other.targetLanguage?.includes(me.nativeLanguage);
    if (isLanguageComplementary) {
      score += 500;
    }

    // 3. 共同兴趣 (中权重)
    if (me.interests && other.interests) {
      const commonInterests = me.interests.filter(interest => other.interests.includes(interest));
      score += commonInterests.length * 50; // 每个共同兴趣加50分
    }

    // 4. 国家不同 (加分项，促进跨文化交流)
    if (me.country && other.country && me.country !== other.country) {
      score += 100;
    }

    // 5. 随机性 (低权重，确保每次刷新顺序略有不同)
    score += Math.random() * 20; // 增加少量随机性

    return score;
  };

  const handleGreet = async (partner) => {
    // ... (打招呼逻辑保持不变) ...
  };

  return (
    <div>
      {/* 可以放一个刷新按钮 */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6 sticky top-0 text-center">
        <button onClick={() => { /* 可以在这里重新获取数据 */ }} className="font-semibold text-blue-500">
          换一批
        </button>
      </div>

      {loading ? (
        <p className="p-4 text-center text-gray-500">正在寻找语伴...</p>
      ) : sortedPartners.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sortedPartners.map(partner => (
            <PartnerCard key={partner.id} partner={partner} onGreet={handleGreet} />
          ))}
        </div>
      ) : (
        <p className="p-6 text-center text-gray-500 dark:text-gray-400 mt-10">
          暂时没有找到合适的语伴，可以稍后再来看看。
        </p>
      )}
    </div>
  );
};

export default PartnerFinder;
