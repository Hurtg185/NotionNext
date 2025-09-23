// pages/profile/[userId].js (完整且已修复)

import dynamic from 'next/dynamic';
import { LayoutBase } from '@/themes/heo';

// 【核心修复】使用 dynamic import 动态导入 ProfilePageContent 组件
// ssr: false 告诉 Next.js 不要在服务器端渲染这个组件
const ProfilePageContentWithNoSSR = dynamic(
  () => import('@/components/Profile/ProfilePageContent').then(mod => mod.ProfilePageContent),
  { ssr: false, loading: () => <div className="p-10 text-center">正在加载页面...</div> }
);

const ProfilePage = () => {
  return (
    <LayoutBase>
      <ProfilePageContentWithNoSSR />
    </LayoutBase>
  );
};

export default ProfilePage;
