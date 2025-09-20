// themes/heo/components/PostContent.js

import ReactPlayer from 'react-player/lazy'; // 使用懒加载

const PostContent = ({ content }) => {
  // 正则表达式，用来匹配 YouTube 和 Facebook 的视频链接
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/;
  const facebookRegex = /(?:https?:\/\/)?(?:www\.)?facebook\.com\/(?:.+)\/videos\/(.+)\/?/;

  const isYoutubeUrl = content.match(youtubeRegex);
  const isFacebookUrl = content.match(facebookRegex);

  // 如果内容是视频链接，就渲染播放器
  if (isYoutubeUrl || isFacebookUrl) {
    return (
      <div className="my-4">
        <div className="relative pt-[56.25%] bg-black rounded-lg overflow-hidden shadow-lg"> {/* 16:9 比例容器 */}
          <ReactPlayer
            className="absolute top-0 left-0"
            url={content}
            controls={true}
            width="100%"
            height="100%"
            light={true} // 优化性能，点击前只显示缩略图
          />
        </div>
      </div>
    );
  }

  // 否则，就正常渲染文本内容
  return <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{content}</p>;
};

export default PostContent;

// --- 如何在你的帖子组件中使用 ---
/*
  // 假设在你的帖子详情页
  import PostContent from '@/themes/heo/components/PostContent';

  const PostDetail = ({ post }) => {
    return (
      <div>
        <h2>{post.title}</h2>
        <PostContent content={post.text} />
        // ... 其他内容，如评论区
      </div>
    );
  };
*/
