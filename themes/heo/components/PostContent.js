// themes/heo/components/PostItem.js (终极安全版)

import { useState, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/AuthContext';
// ... 其他 import 保持不变

// 【核心修改 ①】：只进行一次动态导入，这是最安全的方式
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });

const PostItem = ({ post }) => {
  const { user } = useAuth();
  const [hasChecked, setHasChecked] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);

  // 【核心修改 ②】：使用 useEffect 在组件挂载到浏览器后，再安全地进行 canPlay 检测
  useEffect(() => {
    if (post.content && !hasChecked) {
      const lines = post.content.split('\n');
      // 这里的 ReactPlayer.canPlay 是在客户端调用的，此时库已加载，不会报错
      const url = lines.find(line => line.trim() && ReactPlayer.canPlay(line.trim()));
      if (url) {
        setVideoUrl(url.trim());
      }
      setHasChecked(true); // 标记为已检查，避免重复运行
    }
  }, [post.content, hasChecked]);

  // ... handleLike, handleBookmark 等函数保持不变

  return (
    <>
      <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 shadow-md hover:shadow-xl transition-shadow duration-300">
        {/* ... 作者信息和标题部分保持不变 ... */}
        <Link href={`/forum/post/${post.id}`} passHref>
          <a className="space-y-2 block my-3">
            <h2 className="text-lg font-bold hover:text-blue-500 dark:text-gray-100">{post.title}</h2>
          </a>
        </Link>
        
        {/* 【核心修改 ③】：渲染逻辑保持不变，但现在 videoUrl 是通过安全的 useEffect 设置的 */}
        {videoUrl ? (
          <div 
             className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group mt-2"
             onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          >
            <ReactPlayer
              url={videoUrl}
              light={true}
              playing={true}
              controls={true}
              width="100%"
              height="100%"
              className="absolute top-0 left-0"
            />
          </div>
        ) : (
          // 如果内容已检查且没有视频，或者内容本身就为空，则显示文字
          hasChecked && post.content && <p className="text-gray-800 dark:text-gray-200 text-base line-clamp-2">{post.content}</p>
        )}
        
        {/* ... 底部操作栏和分享模态框保持不变 ... */}
      </div>
    </>
  );
};

export default PostItem;```
**`PostItem.js` 修改总结**:
我们不再尝试在组件渲染前就用 `useMemo` 判断视频链接。而是等到组件在浏览器中渲染完成后，再通过 `useEffect` 调用 `ReactPlayer.canPlay()`。这确保了该函数被调用时，`ReactPlayer` 库已经完整加载，从而彻底杜绝了 `is not a function` 的错误。

---

### 问题二：帖子详细页报错

您的第一、二张截图显示，**帖子详细页面**也出现了 `canPlay is not a function` 的报错。

**根本原因**：
和 `PostItem.js` **完全一样**！我们在 `PostContent.js` 组件中也犯了同样的错误，在组件渲染完成前就尝试调用 `canPlay`。

**解决方案**：
同样，我们需要修改 `themes/heo/components/PostContent.js`，采用和上面 `PostItem.js` 一样的安全模式：**使用 `useEffect` 在客户端进行检测**。

#### 请用下面这份代码，完全替换 `themes/heo/components/PostContent.js`

```javascript
// themes/heo/components/PostContent.js (终极安全版)

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });

const PostContent = ({ content }) => {
  const [lines, setLines] = useState([]);

  // 在组件挂载到客户端后，再处理内容
  useEffect(() => {
    if (content) {
      const processedLines = content.split('\n').map((line, index) => {
        const trimmedLine = line.trim();
        // 在这里进行安全的 canPlay 检测
        if (trimmedLine && ReactPlayer.canPlay(trimmedLine)) {
          return { type: 'video', url: trimmedLine, key: index };
        } else {
          return { type: 'text', text: line, key: index };
        }
      });
      setLines(processedLines);
    }
  }, [content]);

  // 如果内容还未处理，显示加载中或什么都不显示
  if (lines.length === 0) {
    return (
        <div className="p-4 text-center text-gray-500">
            <i className="fas fa-spinner fa-spin mr-2"></i>
            正在加载内容...
        </div>
    );
  }

  return (
    <div className="post-content-container">
      {lines.map(item => {
        if (item.type === 'video') {
          return (
            <div key={item.key} className="my-4 relative w-full max-w-3xl mx-auto aspect-video rounded-lg overflow-hidden shadow-lg bg-black">
              <ReactPlayer
                url={item.url}
                width="100%"
                height="100%"
                controls={true}
                className="absolute top-0 left-0"
              />
            </div>
          );
        }
        else if (item.text.trim() === '') {
          return <br key={item.key} />;
        }
        else {
          return (
            <p key={item.key} className="my-2">
              {item.text}
            </p>
          );
        }
      })}
    </div>
  );
};

export default PostContent;
