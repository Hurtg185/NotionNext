import dynamic from 'next/dynamic';

// 使用 Next.js 动态导入功能，禁用 SSR，确保代码只在浏览器执行
const SpokenModule = dynamic(() => import('@/components/Spoken/SpokenModule'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-white max-w-md mx-auto">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400 font-bold">正在加载书籍...</p>
      </div>
    </div>
  ),
});

export default function SpokenPage() {
  return <SpokenModule />;
}
