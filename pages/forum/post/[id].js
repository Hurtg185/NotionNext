// pages/forum/post/[id].js (最终修复版 - 逐行解析内容)
import { useState, useEffect } from 'react';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc, // 【新增】导入 updateDoc
  arrayUnion, // 【新增】导入 arrayUnion
  arrayRemove // 【新增】导入 arrayRemove
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../lib/AuthContext';
import { useRouter } from 'next/router';

// 【新增】导入 PostContent 组件
import PostContent from '@/themes/heo/components/PostContent';
import { LayoutBase } from '@/themes/heo';

const PostDetailPage = () => {
  const router = useRouter();
  const { id: postId } = router.query;
  const { user } = useAuth(); // 获取当前登录用户

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  // 获取帖子详情
  useEffect(() => {
    if (!postId) return;
    const postRef = doc(db, 'posts', postId);
    getDoc(postRef).then((docSnap) => {
      if (docSnap.exists()) {
        const postData = docSnap.data();
        setPost({ id: docSnap.id, ...postData });
      } else {
        console.log("找不到该帖子!");
      }
      setLoading(false);
    });
  }, [postId]);

  // 实时获取评论
  useEffect(() => {
    if (!postId) return;
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const commentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toLocaleString() || '刚刚',
        // 确保 likedBy 字段存在，如果不存在则默认为空数组
        likedBy: doc.data().likedBy || []
      }));
      setComments(commentsData);
    });
    return () => unsubscribe();
  }, [postId]);

  // 提交新评论
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    try {
      const commentsRef = collection(db, 'posts', postId, 'comments');
      await addDoc(commentsRef, {
        text: newComment,
        authorId: user.uid,
        authorName: user.displayName || '匿名用户',
        authorAvatar: user.photoURL || 'https://www.gravatar.com/avatar?d=mp',
        createdAt: serverTimestamp(),
        likedBy: [], // 【新增】初始化点赞列表为空
      });
      setNewComment('');
    } catch (error) {
      console.error("添加评论失败: ", error);
    }
  };

  // 【新增】点赞评论的函数
  const handleLikeComment = async (commentId) => {
    if (!user) {
      alert('请登录后点赞！');
      return;
    }

    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    try {
      const commentSnap = await getDoc(commentRef);
      if (commentSnap.exists()) {
        const commentData = commentSnap.data();
        const likedBy = commentData.likedBy || [];
        const isLiked = likedBy.includes(user.uid);

        if (isLiked) {
          // 如果已点赞，则取消点赞
          await updateDoc(commentRef, {
            likedBy: arrayRemove(user.uid)
          });
        } else {
          // 如果未点赞，则点赞
          await updateDoc(commentRef, {
            likedBy: arrayUnion(user.uid)
          });
        }
      }
    } catch (error) {
      console.error("点赞操作失败: ", error);
    }
  };


  if (loading) return <LayoutBase><p className="p-4 text-center">加载中...</p></LayoutBase>;
  if (!post) return <LayoutBase><p className="p-4 text-center text-red-500">帖子不存在。</p></LayoutBase>;

  return (
    <LayoutBase>
      <div className="container mx-auto p-4 max-w-3xl">
        {/* 帖子内容 */}
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h1 className="text-3xl font-bold mb-4">{post.title}</h1>
          <div className="flex items-center text-gray-600 dark:text-gray-400 mb-6">
            <img
              src={post.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'}
              alt={post.authorName || '匿名用户'}
              className="w-8 h-8 rounded-full mr-2 object-cover"
            />
            <span>由 {post.authorName || '匿名用户'} 发布于 {post.createdAt?.toDate().toLocaleString() || '未知时间'}</span>
          </div>
          <div className="prose dark:prose-invert max-w-none">
            {/* 【核心修复】逐行解析 post.content，并对每一行都应用 PostContent 组件 */}
            {post.content && typeof post.content === 'string' && post.content.split('\n').map((paragraph, index) => (
              <PostContent key={index} content={paragraph} />
            ))}
          </div>
        </div>

        {/* 评论区 */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">评论 ({comments.length})</h2>

          {/* 评论列表 */}
          <div className="space-y-4 mb-6">
            {comments.map(comment => (
              <div key={comment.id} className="flex items-start space-x-3">
                <img
                  src={comment.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'}
                  alt={comment.authorName || '匿名用户'}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="flex-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <p className="font-semibold">{comment.authorName || '匿名用户'}</p>
                  <p>{comment.text}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{comment.createdAt}</p>

                  {/* 【新增】点赞按钮和点赞数 */}
                  <div className="flex items-center mt-2">
                    <button
                      onClick={() => handleLikeComment(comment.id)}
                      disabled={!user} // 未登录用户禁用按钮
                      className={`flex items-center text-sm px-2 py-1 rounded-full
                        ${user && comment.likedBy.includes(user.uid)
                          ? 'bg-red-500 text-white' // 已点赞样式
                          : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500' // 未点赞样式
                        }
                        ${!user ? 'opacity-50 cursor-not-allowed' : ''} // 未登录禁用样式
                      `}
                    >
                      {/* 根据是否点赞显示不同的图标 */}
                      {user && comment.likedBy.includes(user.uid) ? (
                        // 已点赞图标 (实心心形)
                        <svg className="w-4 h-4 mr-1 fill-current" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                      ) : (
                        // 未点赞图标 (空心心形)
                        <svg className="w-4 h-4 mr-1 stroke-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      )}
                      {user && comment.likedBy.includes(user.uid) ? '已赞' : '点赞'}
                    </button>
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                      {comment.likedBy.length}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 发表评论表单 */}
          {user ? (
            <form onSubmit={handleAddComment}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="发表你的看法..."
                rows="3"
                className="w-full p-2 border rounded-md dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button type="submit" className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                发表评论
              </button>
            </form>
          ) : (
            <p className="text-center text-gray-600 dark:text-gray-400">请登录后发表评论。</p>
          )}
        </div>
      </div>
    </LayoutBase>
  );
};

export default PostDetailPage;
