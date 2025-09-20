// themes/heo/components/PostContent.js (优化视频封面)

import ReactPlayer from 'react-player/lazy';

const PostContent = ({ content }) => {
  // 正则表达式，用来匹配 YouTube 和 Facebook 的视频链接
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/;
  const facebookRegex = /(?:https?:\/\/)?(?:www\.)?facebook\.com\/(?:.+)\/videos\/(.+)\/?/;

  const youtubeMatch = content.match(youtubeRegex);
  const facebookMatch = content.match(facebookRegex);

  // 【核心修改】如果内容是 YouTube 链接，就自定义封面图
  if (youtubeMatch && youtubeMatch[1]) {
    const videoId = youtubeMatch[1].split('&')[0]; // 获取纯净的 videoId
    // YouTube 提供了多种格式的缩略图
    // mqdefault.jpg (320x180), hqdefault.jpg (480x360), sddefault.jpg (640x480), maxresdefault.jpg (1920x1080)
    // 通常 hqdefault 或 sddefault 质量较好且不带标题
    const customThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return (
      <div className="my-4">
        <div className="relative pt-[56.25%] bg-black rounded-lg overflow-hidden shadow-lg">
          <ReactPlayer
            className="absolute top-0 left-0"
            url={content}
            controls={true}
            width="100%"
            height="100%"
            // 【修改】light 属性现在可以接受一个字符串作为自定义缩略图的 URL
            light={customThumbnail}
            playing={false} // 确保初始状态为不播放
            config={{
              youtube: {
                playerVars: {
                  showinfo: 0, // 隐藏视频标题等信息
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

  // Facebook 和其他视频链接保持原样
  if (facebookMatch) {
    return (
      <div className="my-4">
        <div className="relative pt-[56.25%] bg-black rounded-lg overflow-hidden shadow-lg">
          <ReactPlayer
            className="absolute top-0 left-0"
            url={content}
            controls={true}
            width="100%"
            height="100%"
            light={true}
          />
        </div>
      </div>
    );
  }

  // 正常渲染文本内容
  return <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{content}</p>;
};

export default PostContent;
