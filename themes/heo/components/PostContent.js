// themes/heo/components/PostContent.js (根据官方迁移指南，为 react-player v3+ 版本修正)

import React from 'react';
import dynamic from 'next/dynamic';

// 根据 react-player v3 官方迁移指南，'/lazy' 入口点已被移除。
// 在 Next.js 中实现懒加载的正确方法是，使用 next/dynamic 来导入 'react-player' 主模块。
// 这能实现完全相同的代码分割和懒加载效果，而且兼容性更好。
const ReactPlayer = dynamic(() => import('react-player'), { 
  ssr: false, // 播放器组件需要 'window' 对象，所以必须只在客户端渲染。
  // 可选：在播放器组件加载时显示一个占位符，提升用户体验。
  loading: () => (
    <div className="aspect-video w-full bg-gray-900 flex items-center justify-center text-gray-400">
      <i className="fas fa-spinner fa-spin mr-2"></i>
      正在加载播放器...
    </div>
  )
});

const PostContent = ({ content }) => {
  if (!content) {
    return null;
  }

  const lines = content.split('\n');

  return (
    <div className="post-content-container">
      {lines.map((line, index) => {
        const trimmedLine = line.trim();

        // 我们先简单判断这行是否以 'http' 开头，像一个链接。
        // 最终的确认 (ReactPlayer.canPlay) 会在 RenderPlayer 组件内部执行，
        // 以确保 ReactPlayer 库本身已经被加载完毕。
        if (trimmedLine.startsWith('http')) {
          return <RenderPlayer key={index} url={trimmedLine} />;
        }
        else if (trimmedLine === '') {
          return <br key={index} />;
        }
        else {
          return (
            <p key={index} className="my-2">
              {line}
            </p>
          );
        }
      })}
    </div>
  );
};

// 这个辅助组件确保我们只在动态导入成功加载了组件后，才调用 ReactPlayer.canPlay()。
// 这是最稳妥的做法。
const RenderPlayer = ({ url }) => {
  // 检查这个 URL 是否能被现在已经加载好的 ReactPlayer 库播放。
  if (ReactPlayer.canPlay(url)) {
    return (
      <div className="my-4 relative w-full max-w-3xl mx-auto aspect-video rounded-lg overflow-hidden shadow-lg bg-black">
        <ReactPlayer
          url={url}
          width="100%"
          height="100%"
          controls={true}
          className="absolute top-0 left-0"
        />
      </div>
    );
  }

  // 如果它是一个URL，但不是可播放的视频，就把它渲染成一个普通的文本链接。
  return (
    <p className="my-2">
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
        {url}
      </a>
    </p>
  );
};

export default PostContent;
