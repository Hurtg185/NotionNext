// pages/forum/post/[id].js (修复视频播放器集成)
import { useState, useEffect } from 'react';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../lib/AuthContext';
import { useRouter } from 'next/router';

// 【新增】导入 PostContent 组件
import PostContent from '@/themes/heo/components/PostContent'; 
import { LayoutBase } from '@/themes/heo'; // 假设你的页面需要一个 LayoutBase

const PostDetailPage = () => {
  const router = useRouter();
  const { id: postId } = router.query;
  const { user } = useAuth();

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
        // 假设 post.createdAt 是 Firebase Timestamp 对象
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
        // 假设 createdAt 是 Firebase Timestamp
        createdAt: doc.data().createdAt?.toDate().toLocaleString() || '刚刚' // 格式化时间
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
        authorName: user.displayName || '匿名用户', // 提供一个默认名
        authorAvatar: user.photoURL || 'https://www.gravatar.com/avatar?d=mp', // 提供一个默认头像
        createdAt: serverTimestamp(),
      });
      setNewComment('');
    } catch (error) {
      console.error("添加评论失败: ", error);
    }
  };

  if (loading) return <LayoutBase><p className="p-4 text-center">加载中...</p></LayoutBase>;
  if (!post) return <LayoutBase><p className="p-4 text-center text-red-500">帖子不存在。</p></LayoutBase>;

  return (
    <LayoutBase> {/* 假设你的页面需要一个基础布局 */}
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
            {/* 【核心修改】将 post.content 传递给 PostContent 组件 */}
            {/* 假设 post.content 是纯文本，其中可能包含链接 */}
            <PostContent content={post.content} />
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
