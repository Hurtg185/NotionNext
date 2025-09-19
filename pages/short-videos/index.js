// pages/short-videos/index.js (最关键的修复：彻底脱离布局)

import VerticalShortVideoPlayer from '@/themes/heo/components/VerticalShortVideoPlayer'
// 【核心修改】移除对 LayoutBase 的引入，这个页面不应该被任何布局组件包裹

export default function ShortVideosPage() { // 将 VideosPage 改回 ShortVideosPage
  return (
    // 【核心修改】直接渲染播放器，不包裹任何布局组件
    <VerticalShortVideoPlayer useProxy={false} />
  )
}

// 【关键】定义一个自定义的 getLayout 函数，确保页面不使用默认布局
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
          overflow: hidden; /* 禁用页面滚动 */
          overscroll-behavior-y: none; /* 禁用 iOS 弹性滚动 */
        }
        body {
          position: fixed; /* 在移动端帮助维持 100vh 的稳定 */
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
        }
      `}</style>
    </>
  )
}
