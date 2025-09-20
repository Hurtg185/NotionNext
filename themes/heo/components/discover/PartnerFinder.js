// themes/heo/components/discover/PartnerFinder.js (修复 AuthContext 导入路径)

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext'; // 【核心修复】移除多余的 '--'
import { getLanguagePartners } from '@/lib/user';
import { useRouter } from 'next/router';
import { HiOutlineChatBubbleLeftEllipsis } from 'react-icons/hi2';
import { startChat } from '@/lib/chat';
import { useDrawer } from '@/lib/DrawerContext';

// 单个语伴卡片
const PartnerCard = ({ partner, onGreet }) => {
  const router = useRouter();
  
  const handleCardClick = () => {
    router.push(`/profile/${partner.id}`);
  };

  const handleGreetClick = (e) => {
    e.stopPropagation(); // 防止点击打招呼时触发卡片点击
    onGreet(partner);
  };
  
  return (
    <div 
      onClick={handleCardClick}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transform hover:-translate-y-1 transition-transform duration-200 cursor-pointer"
    >
      <div className="p-4 flex items-center space-x-4">
        <img 
          src={partner.photoURL || 'https://www.gravatar.com/avatar?d=mp'} 
          alt={partner.displayName} 
          className="w-16 h-16 rounded-full object-cover" 
        />
        <div className="flex-grow">
          <p className="font-bold text-lg text-gray-900 dark:text-white">{partner.displayName}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {partner.nativeLanguage} {'->'} {partner.targetLanguage?.join(', ')}
          </p>
        </div>
        <button 
          onClick={handleGreetClick}
          className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
          aria-label="打招呼"
        >
          <HiOutlineChatBubbleLeftEllipsis className="w-6 h-6" />
        </button>
      </div>
      <div className="px-4 pb-4">
        <p className="text-gray-700 dark:text-gray-300 h-12 overflow-hidden">{partner.bio || '这位语伴很神秘，什么都没留下...'}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {partner.interests?.slice(0, 3).map(interest => (
            <span key={interest} className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-xs rounded-full text-gray-600 dark:text-gray-300">
              {interest}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

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
      const filteredData = data.filter(p => p.id !== currentUser.uid);
      setPartners(filteredData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const sortedPartners = useMemo(() => {
    if (!currentUser || partners.length === 0) return [];

    return [...partners].sort((a, b) => {
      const scoreA = calculateMatchScore(currentUser, a);
      const scoreB = calculateMatchScore(currentUser, b);
      return scoreB - scoreA;
    });
  }, [partners, currentUser]);

  const calculateMatchScore = (me, other) => {
    let score = 0;
    if (other.isOnline) score += 1000;
    const isLanguageComplementary = 
      me.targetLanguage?.includes(other.nativeLanguage) &&
      other.targetLanguage?.includes(me.nativeLanguage);
    if (isLanguageComplementary) score += 500;
    if (me.interests && other.interests) {
      const commonInterests = me.interests.filter(interest => other.interests.includes(interest));
      score += commonInterests.length * 50;
    }
    if (me.country && other.country && me.country !== other.country) score += 100;
    score += Math.random() * 20;
    return score;
  };

  const handleGreet = async (partner) => {
    if (!currentUser) {
      alert('请先登录再打招呼！');
      return;
    }
    const conversation = await startChat(currentUser.uid, partner.id);
    if (conversation) {
      openDrawer('chat', { conversation, chatId: conversation.id });
    } else {
      alert('开启对话失败，请稍后再试。');
    }
  };

  return (
    <div>
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6 sticky top-0 text-center">
        <button onClick={() => window.location.reload()} className="font-semibold text-blue-500">
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
