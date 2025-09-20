// themes/heo/components/PostContent.js (最终修复版)

import dynamic from 'next/dynamic'; // 1. 导入 Next.js 的 dynamic 函数

// 2. 使用 dynamic 导入 react-player，并禁用服务器端渲染 (SSR)
// 这是修复 "Can't resolve 'react-player/lazy'" 和 SSR 兼容性问题的关键
const ReactPlayer = dynamic(() => import('react-player'), {
  ssr: false
});

const PostContent = ({ content }) => {
  // 正则表达式，用来匹配 YouTube 和 Facebook 的视频链接
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/;
  const facebookRegex = /(?:https?:\/\/)?(?:www\.)?facebook\.com\/(?:.+)\/videos\/(.+)\/?/;

  const youtubeMatch = content.match(youtubeRegex);
  const facebookMatch = content.match(facebookRegex);

  // 判断是否为本地或通用MP4等URL
  const isGenericVideo = content.match(/\.(mp4|webm|ogg)$/i);

  // --- 处理 YouTube 视频 ---
  if (youtubeMatch && youtubeMatch[1]) {
    const videoId = youtubeMatch[1].split('&')[0]; // 获取纯净的 videoId
    // 构建一个高质量、通常不带标题的视频封面图 URL
    const customThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return (
      <div className="my-4">
        <div className="relative pt-[56.25%] bg-black rounded-lg overflow-hidden shadow-lg"> {/* 16:9 容器 */}
          <ReactPlayer
            className="absolute top-0 left-0"
            url={content}
            controls={true}
            width="100%"
            height="100%"
            // 使用自定义缩略图，并开启懒加载
            light={customThumbnail}
            playing={false}
            config={{
              youtube: {
                playerVars: {
                  showinfo: 0, // 隐藏视频标题
                  modestbranding: 1, // 隐藏 YouTube logo
                  rel: 0 // 播放结束后不显示相关视频
                }
              }
            }}
          />
        </div>
      </div>
    );
  }

  // --- 处理 Facebook 和其他通用视频链接 ---
  if (facebookMatch || isGenericVideo) {
    return (
      <div className="my-4">
        {/* 为了更好地适应竖屏视频，容器不再固定比例，而是自适应，并限制最大高度 */}
        <div className="relative w-full max-w-full mx-auto" style={{ maxHeight: '75vh' }}>
          <ReactPlayer
            url={content}
            controls={true}
            width="100%"
            height="auto" // 高度自适应
            light={true} // 使用默认缩略图
            style={{ aspectRatio: '16/9', maxWidth: '100%' }} // 默认16:9比例，但会被视频实际比例覆盖
          />
        </div>
      </div>
    );
  }

  // --- 如果不是视频链接，则正常渲染文本内容 ---
  return <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{content}</p>;
};

export default PostContent;
