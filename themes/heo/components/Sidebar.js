// themes/heo/components/Sidebar.js (修复“我的消息”入口)

import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
// 1. 移除 useDrawer 的导入，因为 Sidebar 不直接管理抽屉
// import { useDrawer } from '@/lib/DrawerContext'; 
import { useRouter } from 'next/router'; // 2. 引入 useRouter

// 可复用的侧边栏菜单项
const MenuItem = ({ path, icon, label, onClick }) => (
  path ? (
    <Link href={path} passHref>
      <a onClick={onClick} className="flex items-center space-x-4 px-6 py-3 text-lg text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200">
        <i className={`${icon} w-6 text-center text-gray-500 dark:text-gray-400`}></i>
        <span>{label}</span>
      </a>
    </Link>
  ) : (
    // 如果没有 path，则是一个普通的按钮，执行 onClick
    <button onClick={onClick} className="w-full flex items-center space-x-4 px-6 py-3 text-lg text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200">
      <i className={`${icon} w-6 text-center text-gray-500 dark:text-gray-400`}></i>
      <span>{label}</span>
    </button>
  )
);

const Sidebar = () => {
  const { user } = useAuth();
  const { isOpen, closeSidebar } = useSidebar();
  const router = useRouter(); // 3. 获取 router 实例

  const handleOpenMessages = () => {
    closeSidebar(); // 先关闭侧边栏
    router.push('/forum/messages'); // 4. 【核心修复】: 直接跳转到消息列表页面
  };

  return (
    <>
      {/* 遮罩层，点击后关闭 */}
      <div
        onClick={closeSidebar}
        className={`fixed inset-0 bg-black z-30 transition-opacity duration-300
                    ${isOpen ? 'opacity-40' : 'opacity-0 pointer-events-none'}`}
      />
      
      {/* 侧边栏主体 */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-white dark:bg-gray-800 shadow-2xl z-40
                    transform transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          {/* 用户信息区 */}
          <div className="px-6 py-8 border-b border-gray-200 dark:border-gray-700">
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
            {/* 【核心修改】: “我的消息”现在是一个普通的按钮，点击执行 handleOpenMessages */}
            <MenuItem icon="fas fa-inbox" label="我的消息" onClick={handleOpenMessages} /> 
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
      </aside>
    </>
  );
};

export default Sidebar;
