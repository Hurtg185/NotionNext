// pages/forum/comment/[id].js (新的楼中楼页面)
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../lib/AuthContext';
import { LayoutBase } from '@/themes/heo';
import Link from 'next/link';

// 复用帖子详情页的 CommentItem 组件 (你需要将它提取到一个公共文件中)
// 为了简单起见，我暂时在这里重新定义它
// 【注意】理想情况下，CommentItem 应该在 @/components/Forum/CommentItem.js
const CommentItem = ({ comment, allComments, user, postAuthorId, handleVote, handleDelete, handleReply }) => {
    // ... (这里粘贴你帖子详情页的完整 CommentItem 组件代码)
    // 【重要修改】在回复中也显示头像
    return (
        <div className="flex items-start space-x-3 w-full">
            <Link href={`/profile/${comment.authorId}`} passHref>
                <a><img src={comment.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'} alt={comment.authorName || '匿名用户'} className="w-10 h-10 rounded-full object-cover cursor-pointer flex-shrink-0"/></a>
            </Link>
            <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                    <Link href={`/profile/${comment.authorId}`} passHref><a className="font-bold text-lg text-gray-800 dark:text-white cursor-pointer hover:underline">{comment.authorName || '匿名用户'}</a></Link>
                    {comment.authorId === postAuthorId && <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full font-medium">楼主</span>}
                </div>
                <p className="text-gray-800 dark:text-gray-200 text-base break-words">{comment.text}</p>
                {/* ... (完整的互动按钮JSX) ... */}
            </div>
        </div>
    )
};


const CommentDetailPage = () => {
  const router = useRouter();
  const { id: commentId } = router.query;
  const { user, loading: authLoading } = useAuth();
  
  const [mainComment, setMainComment] = useState(null);
  const [replies, setReplies] = useState([]);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !commentId) return;

    // 获取主评论的信息
    const getCommentAndPost = async () => {
        // Firebase 的路径是 collection/document/collection/document...
        // 我们不知道 postId，所以不能直接定位。这是一个 Firestore 的设计局限。
        // 【解决方案】在创建评论时，需要将 postId 存储在评论文档中。
        // 假设你的评论文档现在有 postId 字段。
        const commentRef = doc(db, 'comments', commentId); // 假设你有一个顶级的 'comments' 集合
        const commentSnap = await getDoc(commentRef);

        if (commentSnap.exists()) {
            const commentData = commentSnap.data();
            setMainComment({ id: commentSnap.id, ...commentData });

            // 获取相关的帖子信息
            const postRef = doc(db, 'posts', commentData.postId);
            const postSnap = await getDoc(postRef);
            if (postSnap.exists()) {
                setPost({ id: postSnap.id, ...postSnap.data() });
            }

            // 获取所有回复
            const repliesRef = collection(db, 'posts', commentData.postId, 'comments');
            const q = query(repliesRef, where('parentId', '==', commentId), orderBy('createdAt', 'asc'));
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const repliesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setReplies(repliesData);
                setLoading(false);
            });
            return unsubscribe;

        } else {
            setLoading(false);
        }
    };
    
    const unsubscribePromise = getCommentAndPost();
    
    return () => {
        unsubscribePromise.then(unsubscribe => unsubscribe && unsubscribe());
    };

  }, [commentId, authLoading]);

  if (loading || authLoading) {
    return <LayoutBase><p className="p-8 text-center">加载评论中...</p></LayoutBase>;
  }

  if (!mainComment) {
    return <LayoutBase><p className="p-8 text-center text-red-500">评论不存在或已被删除。</p></LayoutBase>;
  }

  return (
    <LayoutBase>
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen py-8">
        <div className="container mx-auto p-4 max-w-3xl">
          <div className="mb-4">
            <Link href={`/forum/post/${mainComment.postId}`}>
              <a className="text-blue-500 hover:underline">← 返回原帖</a>
            </Link>
          </div>
          
          {/* 主评论 */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
            <CommentItem 
              comment={mainComment}
              allComments={[mainComment, ...replies]} // 传递所有相关评论
              user={user}
              postAuthorId={post?.authorId}
              // handle* 函数需要在这里重新定义或从 context 导入
            />
          </div>

          {/* 回复列表 */}
          <div className="mt-6 pl-4 border-l-2 border-gray-200 dark:border-gray-700 space-y-4">
            {replies.map(reply => (
                <div key={reply.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
                    <CommentItem 
                        comment={reply}
                        allComments={[mainComment, ...replies]}
                        user={user}
                        postAuthorId={post?.authorId}
                        // handle* 函数...
                    />
                </div>
            ))}
          </div>
        </div>
      </div>
    </LayoutBase>
  );
};

export default CommentDetailPage;
