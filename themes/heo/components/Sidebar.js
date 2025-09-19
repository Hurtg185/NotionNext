// themes/heo/components/Sidebar.js (最终修复版，只添加跳转)

import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/router';
// 【核心修改】: 彻底移除 useSidebar 的导入，因为它会导致循环依赖或冲突
// import { useSidebar } from '@/lib/SidebarContext'; 

const MenuItem = ({ path, icon, label, onClick }) => (
  <Link href={path} passHref>
    <a onClick={onClick} className="flex items-center space-x-4 px-6 py-3 text-lg text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200">
      <i className={`${icon} w-6 text-center text-gray-500 dark:text-gray-400`}></i>
      <span>{label}</span>
    </a>
  </Link>
);

// 【核心修改】: Sidebar 不再管理自己的状态，它由 LayoutBase 控制
const Sidebar = ({ closeSidebar }) => { 
  const { user } = useAuth();
  const router = useRouter();

  const handleGoToProfile = () => {
    if (user) {
      closeSidebar(); // 调用从 props 传入的关闭函数
      router.push(`/profile/${user.uid}`);
    }
  };

  return (
    // 注意: 这个组件不再包含遮罩层和aside的动画逻辑，这些都由 LayoutBase 控制
    <div className="flex flex-col h-full">
      {/* 用户信息区 */}
      <div 
        className="px-6 py-8 border-b border-gray-200 dark:border-gray-700 cursor-pointer" 
        onClick={handleGoToProfile}
      >
        {user ? (
          <div className="flex items-center space-x-4">
            <img src={user.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={user.displayName} className="w-16 h-16 rounded-full border-2 border-blue-500" />
            <div>
              <p className="font-bold text-xl text-gray-800 dark:text-white">{user.displayName}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">查看个人主页</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="font-bold text-xl">欢迎</p>
            <p className="text-sm text-gray-500">登录以体验全部功能</p>
          </div>
        )}
      </div>

      {/* 菜单列表 */}
      <nav className="flex-grow p-4 space-y-2">
        {/* 这里的 onClick={closeSidebar} 依赖从 props 传入 */}
        <MenuItem path="/forum/messages" icon="fas fa-inbox" label="我的消息" onClick={closeSidebar} />
        <MenuItem path="/#my-dynamics" icon="fas fa-bolt" label="我的动态" onClick={closeSidebar} />
        <MenuItem path="/bookshelf" icon="fas fa-book-open" label="我的书柜" onClick={closeSidebar} />
        <MenuItem path="/favorites" icon="fas fa-star" label="我的收藏" onClick={closeSidebar} />
        <hr className="my-4 border-gray-200 dark:border-gray-700" />
        <MenuItem path="/settings" icon="fas fa-cog" label="设置" onClick={closeSidebar} />
      </nav>

      {/* 底部 Logo 或其他信息 (可选) */}
      <div className="p-6 text-center text-xs text-gray-400">
        Powered by NotionNext
      </div>
    </div>
  );
};

export default Sidebar;
