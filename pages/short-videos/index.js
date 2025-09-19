// pages/short-videos/index.js (完整且已修复)

import VerticalShortVideoPlayer from '@/themes/heo/components/VerticalShortVideoPlayer'
// 【移除】不再需要 LayoutBase，因为这个页面是全屏独立的

export default function ShortVideosPage() {
  return (
    // 直接渲染播放器，让它完全占满屏幕，通常短视频页面不需要额外的布局
    <VerticalShortVideoPlayer useProxy={false} />
  )
}

// 【核心修复】定义一个自定义的 getLayout 函数
// 这个函数会告诉 Next.js，这个页面不需要任何额外的布局包裹
ShortVideosPage.getLayout = function getLayout(page) {
  return (
    <>
      {page}
      {/* 【关键】全局样式来强制全屏和禁用滚动 */}
      <style jsx global>{`
        html, body, #__next {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden; /* 【核心】禁用页面滚动 */
          overscroll-behavior-y: none; /* 【关键】禁用 iOS 弹性滚动 */
        }
        /* 【优化】在移动端浏览器上，防止地址栏出现/隐藏导致视口变化 */
        body {
          position: fixed; 
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
        }
      `}</style>
    </>
  )
}
