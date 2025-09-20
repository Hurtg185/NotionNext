// themes/heo/components/PostContent.js (增强鲁棒性)

import dynamic from 'next/dynamic';
const ReactPlayer = dynamic(() => import('react-player'), {
  ssr: false
});

const PostContent = ({ content }) => {
  // 【核心修改】增加对 content 类型的检查，防止 undefined.match() 错误
  if (typeof content !== 'string' || !content) {
    // 如果 content 不是字符串或为空，直接返回原始内容或 null
    return <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{content}</p>;
  }

  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/;
  const facebookRegex = /(?:https?:\/\/)?(?:www\.)?facebook\.com\/(?:.+)\/videos\/(.+)\/?/;
  const isGenericVideo = content.match(/\.(mp4|webm|ogg)$/i);

  const youtubeMatch = content.match(youtubeRegex);
  const facebookMatch = content.match(facebookRegex);

  // --- 处理 YouTube 视频 ---
  if (youtubeMatch && youtubeMatch[1]) {
    const videoId = youtubeMatch[1].split('&')[0];
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
            light={customThumbnail}
            playing={false}
            config={{
              youtube: {
                playerVars: {
                  showinfo: 0,
                  modestbranding: 1,
                  rel: 0
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
        <div className="relative pt-[56.25%] bg-black rounded-lg overflow-hidden shadow-lg">
          <ReactPlayer
            className="absolute top-0 left-0"
            url={content}
            controls={true}
            width="100%"
            height="100%"
            light={true}
            config={{ file: { attributes: { style: { objectFit: 'contain' } } } }}
          />
        </div>
      </div>
    );
  }

  // --- 如果不是视频链接，则正常渲染文本内容 ---
  return <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{content}</p>;
};

export default PostContent;
