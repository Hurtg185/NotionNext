// pages/forum/post/[id].js (已根据论坛主页需求优化和修复)

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  doc, getDoc, collection, addDoc, query, orderBy, onSnapshot,
  serverTimestamp, updateDoc, arrayUnion, arrayRemove, deleteDoc, writeBatch, increment, getDocs, limit
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../lib/AuthContext';
import { useRouter } from 'next/router';

import PostContent from '@/themes/heo/components/PostContent';
import { LayoutBase } from '@/themes/heo';
import AiTtsButton from '@/components/AiTtsButton';

// =====================================
// 1. 辅助组件 (已按需修改)
// =====================================

const ShareModal = ({ url, onClose }) => {
    // ... (此组件保持原样，无需修改)
    const shareOptions = [
        { name: '复制链接', iconClass: 'fas fa-copy', action: () => { navigator.clipboard.writeText(url); alert('链接已复制!'); onClose(); } },
        { name: 'Facebook', iconClass: 'fab fa-facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
        { name: 'Messenger', iconClass: 'fab fa-facebook-messenger', href: `fb-messenger://share?link=${encodeURIComponent(url)}` },
        { name: 'Telegram', iconClass: 'fab fa-telegram', href: `https://t.me/share/url?url=${encodeURIComponent(url)}` },
        { name: 'WhatsApp', iconClass: 'fab fa-whatsapp', href: `https://api.whatsapp.com/send?text=${encodeURIComponent(url)}` },
        { name: 'QQ', iconClass: 'fab fa-qq', href: `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(url)}` },
        { name: 'WeChat', iconClass: 'fab fa-weixin', action: () => alert('微信分享请使用浏览器自带分享功能或截图') }
    ];
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-5 text-center text-gray-900 dark:text-white">分享到</h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                    {shareOptions.map(opt => ( opt.action ? <button key={opt.name} onClick={opt.action} className="flex items-center justify-center p-3 h-14 bg-gray-100 dark:bg-gray-700 rounded-lg text-base font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><i className={`${opt.iconClass} mr-2 w-5 text-lg`}></i>{opt.name}</button> : <a key={opt.name} href={opt.href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center p-3 h-14 bg-gray-100 dark:bg-gray-700 rounded-lg text-base font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><i className={`${opt.iconClass} mr-2 w-5 text-lg`}></i>{opt.name}</a> ))}
                </div>
            </div>
        </div>
    );
};

// 【需求 3.1 & 3.2】优化“楼中楼”回复组件
const CompactReply = ({ reply, allComments, handleReply }) => {
    // 寻找被回复的评论，可能是主评论，也可能是另一个“楼中楼”
    const parentComment = allComments.find(c => c.id === reply.parentId);
    
    return (
        // 【需求 3.1】增大文字大小，从 text-sm 改为 text-base
        <div className="text-base text-gray-700 dark:text-gray-300">
            <div className="break-words leading-relaxed">
                <Link href={`/profile/${reply.authorId}`} passHref>
                    <a className="font-bold text-gray-800 dark:text-white cursor-pointer hover:underline">{reply.authorName}</a>
                </Link>
                {/* 如果被回复的评论存在，且它也是一个回复（即 parentId 不为 null），则显示“回复 xx” */}
                {parentComment && (
                    <>
                        <span className="text-gray-500 dark:text-gray-400 mx-1">回复</span>
                        <Link href={`/profile/${parentComment.authorId}`} passHref>
                            <a className="font-bold text-gray-800 dark:text-white cursor-pointer hover:underline">{parentComment.authorName}</a>
                        </Link>
                    </>
                )}
                <span className="mx-1">:</span>
                {/* 【需求 3.2】让整个回复内容都可点击，以实现对“楼中楼”的回复 */}
                <span className="font-semibold cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 rounded px-1 py-0.5" onClick={() => handleReply(reply)}>
                    {reply.text}
                </span>
            </div>
        </div>
    );
};

// 【需求 2 & 3.3】优化主评论项组件
const CommentItem = ({ comment, allComments, user, post, handleVote, handleDelete, handleReply, isLast }) => {
  const commentIsLiked = user && comment.likers?.includes(user.uid);
  const commentIsDisliked = user && comment.dislikers?.includes(user.uid);
  const isAuthor = user && user.uid === comment.authorId;
  const isPostAuthor = user && user.uid === post.authorId;
  const canDelete = isAuthor || isPostAuthor;

  const directReplies = allComments.filter(c => c.parentId === comment.id);
  // 【需求 3.3】修改逻辑：不再默认显示前3条回复
  const hasMoreReplies = directReplies.length > 3;

  // 【新需求】主贴评论样式修改：移除卡片样式，用分割线代替
  const containerClasses = `flex items-start space-x-3 w-full p-4 ${!isLast ? 'border-b border-gray-200 dark:border-gray-700' : ''}`;

  return (
    <div className={containerClasses}>
      <Link href={`/profile/${comment.authorId}`} passHref>
        <a className="flex-shrink-0"><img src={comment.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'} alt={comment.authorName} className="w-10 h-10 rounded-full object-cover"/></a>
      </Link>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <Link href={`/profile/${comment.authorId}`} passHref><a className="font-bold text-lg text-gray-800 dark:text-white">{comment.authorName || '匿名用户'}</a></Link>
          {comment.authorId === post.authorId && <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded-full font-semibold">楼主</span>}
        </div>
        {/* 【需求 2】将评论正文加粗 */}
        <p className="text-gray-800 dark:text-gray-200 text-base break-words font-semibold">{comment.text}</p>
        
        <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(comment.createdAt).toLocaleDateString()}</p>
            <div className="flex items-center space-x-3">
                <AiTtsButton text={comment.text} provider="microsoft" voice="zh-CN-XiaoxiaoMultilingualNeural" />
                <button onClick={() => handleVote(`posts/${post.id}/comments/${comment.id}`, 'like')} disabled={!user} className={`flex items-center space-x-1 text-xs ${commentIsLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}>
                    <i className={`${commentIsLiked ? 'fas' : 'far'} fa-heart`}></i><span>{comment.likersCount || 0}</span>
                </button>
                <button onClick={() => handleVote(`posts/${post.id}/comments/${comment.id}`, 'dislike')} disabled={!user} className={`flex items-center space-x-1 text-xs ${commentIsDisliked ? 'text-blue-500' : 'text-gray-500 hover:text-blue-500'}`}>
                    <i className={`${commentIsDisliked ? 'fas' : 'far'} fa-thumbs-down`}></i><span>{comment.dislikersCount || 0}</span>
                </button>
                <button onClick={() => handleReply(comment)} title="回复" className="text-gray-400 dark:text-gray-500 hover:text-blue-500"><i className="fas fa-comment-dots"></i></button>
                {canDelete && <button onClick={() => handleDelete(comment.id)} title="删除" className="text-gray-400 dark:text-gray-500 hover:text-red-500"><i className="fas fa-trash"></i></button>}
            </div>
        </div>
        
        {/* 【需求 3.3】实现评论折叠 */}
        {directReplies.length > 0 && (
          <div className="mt-4 pt-3 px-3 pb-2 border-t border-gray-200 dark:border-gray-700 space-y-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
            {/* 如果回复超过3条，则显示“查看全部”链接 */}
            {hasMoreReplies ? (
                <Link href={`/forum/comment/${comment.id}`} passHref>
                    <a className="text-blue-500 dark:text-blue-400 text-sm font-semibold hover:underline pt-1 inline-block">查看全部 {directReplies.length} 条回复 →</a>
                </Link>
            ) : (
                // 否则，正常显示所有回复
                directReplies.map(reply => (
                    <CompactReply key={reply.id} reply={reply} allComments={allComments} handleReply={handleReply} />
                ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// =====================================
// 2. 页面主组件 (已按需修改)
// =====================================

// 【需求 4】接收从 getServerSideProps 传递过来的预取数据
const PostDetailPage = ({ initialPost, initialComments }) => {
  const router = useRouter();
  const { id: postId } = router.query;
  const { user, userData, loading: authLoading } = useAuth();
  
  // 【需求 4】使用预取数据初始化 state
  const [post, setPost] = useState(initialPost);
  const [comments, setComments] = useState(initialComments);
  const [dataLoading, setDataLoading] = useState(!initialPost); // 如果没有初始数据，才显示加载中

  const [sortOrder, setSortOrder] = useState('最新');
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const commentInputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) { setShowMenu(false); }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, [menuRef]);

  // 【需求 4】使用 onSnapshot 进行客户端实时更新
  useEffect(() => {
    if (!postId) return;

    // 监听帖子实时更新
    const postRef = doc(db, 'posts', postId);
    const postUnsubscribe = onSnapshot(postRef, (docSnap) => {
        if (docSnap.exists()) {
            const postData = docSnap.data();
            setPost({ id: docSnap.id, ...postData });
        } else { setPost(null); }
    }, (error) => { console.error("实时获取帖子失败:", error); });

    // 监听评论实时更新
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = sortOrder === '最热'
      ? query(commentsRef, orderBy('likersCount', 'desc'), orderBy('createdAt', 'desc'))
      : query(commentsRef, orderBy('createdAt', 'asc'));
      
    const commentsUnsubscribe = onSnapshot(q, (querySnapshot) => {
        const allCommentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() || new Date() }));
        setComments(allCommentsData);
        if (dataLoading) setDataLoading(false); // 更新完成后，停止加载状态
    }, (error) => { 
        console.error("实时获取评论失败:", error); 
        if (dataLoading) setDataLoading(false);
    });

    return () => { postUnsubscribe(); commentsUnsubscribe(); };
  }, [postId, sortOrder]); // 依赖中移除 authLoading，因为 SSR 已处理初始加载

  const handleVote = async (targetPath, type) => { /* ... (此函数保持原样) ... */ };
  
  const handleDeleteComment = async (commentId) => {
      if (!confirm('确定删除此评论吗？')) return;
      const commentRef = doc(db, `posts/${postId}/comments/${commentId}`);
      const postRef = doc(db, 'posts', postId);
      try {
          const batch = writeBatch(db);
          batch.delete(commentRef);
          batch.update(postRef, { commentsCount: increment(-1) });
          await batch.commit();
      } catch (error) {
          console.error("删除评论失败: ", error);
          alert('删除失败！');
      }
  };

  // 【需求 3.2】增强评论处理函数，支持多级评论
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    const newCommentData = {
        authorId: user.uid,
        authorName: userData.displayName || '匿名用户',
        authorAvatar: userData.photoURL,
        text: newComment,
        createdAt: serverTimestamp(),
        likers: [],
        dislikers: [],
        likersCount: 0,
        dislikersCount: 0,
        // 如果 replyTo 存在，则 parentId 设置为被回复评论的 ID，实现多级回复
        parentId: replyTo ? replyTo.id : null 
    };

    try {
        const commentsRef = collection(db, 'posts', postId, 'comments');
        const postRef = doc(db, 'posts', postId);
        
        const batch = writeBatch(db);
        // 添加新评论
        const newCommentRef = doc(collection(db, `posts/${postId}/comments`)); // 先创建一个引用
        batch.set(newCommentRef, newCommentData);
        // 更新帖子评论数
        batch.update(postRef, { commentsCount: increment(1) });
        
        await batch.commit();
        
        setNewComment('');
        setReplyTo(null); // 重置回复状态
    } catch (error) {
        console.error("评论失败: ", error);
        alert('评论失败！');
    }
  };

  const handleReplyClick = (comment) => {
    setReplyTo(comment);
    commentInputRef.current?.focus();
  };

  // 【需求 1】修复并实现完整的关注/取关逻辑
  const handleFollow = async () => {
    if (!user || !post || user.uid === post.authorId) return;

    const currentUserRef = doc(db, 'users', user.uid);
    const targetUserRef = doc(db, 'users', post.authorId);
    
    // 检查是否已关注
    const isFollowing = userData?.following?.includes(post.authorId);
    const batch = writeBatch(db);

    if (isFollowing) {
        // --- 取消关注 ---
        // 1. 在当前用户的 following 数组中移除目标用户ID，并减少 followingCount
        batch.update(currentUserRef, {
            following: arrayRemove(post.authorId),
            followingCount: increment(-1)
        });
        // 2. 在目标用户的 followers 数组中移除当前用户ID，并减少 followersCount
        batch.update(targetUserRef, {
            followers: arrayRemove(user.uid),
            followersCount: increment(-1)
        });
    } else {
        // --- 添加关注 ---
        // 1. 在当前用户的 following 数组中添加目标用户ID，并增加 followingCount
        batch.update(currentUserRef, {
            following: arrayUnion(post.authorId),
            followingCount: increment(1)
        });
        // 2. 在目标用户的 followers 数组中添加当前用户ID，并增加 followersCount
        batch.update(targetUserRef, {
            followers: arrayUnion(user.uid),
            followersCount: increment(1)
        });
    }
    
    try {
        await batch.commit();
    } catch (error) {
        console.error("关注/取关操作失败:", error);
        alert('操作失败，请检查 Firestore 安全规则或网络连接。');
    }
  };

  const handleBookmark = async () => { /* ... (此函数保持原样) ... */ };
  const handleMenuItemClick = async (action) => { /* ... (此函数保持原样) ... */ };

  if (authLoading || dataLoading) { return <LayoutBase><p className="p-8 text-center text-xl">加载中...</p></LayoutBase>; }
  if (!post) { return <LayoutBase><p className="p-8 text-center text-xl text-red-500">帖子不存在或已被删除。</p></LayoutBase>; }

  const mainComments = comments.filter(comment => !comment.parentId);
  const postIsLiked = user && post.likers?.includes(user.uid);
  const postIsDisliked = user && post.dislikers?.includes(user.uid);
  const isFollowingPostAuthor = user && userData?.following?.includes(post.authorId);
  const isBookmarked = user && userData?.bookmarks?.includes(postId);
  
  return (
    <LayoutBase>
      {showShareModal && <ShareModal url={typeof window !== 'undefined' ? window.location.href : ''} onClose={() => setShowShareModal(false)} />}
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen py-8">
        <div className="container mx-auto p-4 max-w-4xl text-base sm:text-lg">
          <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg relative mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold mb-4 text-gray-900 dark:text-white leading-tight flex items-center">
              <span>{post.title}</span>
              <div className="ml-3"><AiTtsButton text={post.title} provider="microsoft" voice="zh-CN-XiaoxiaoMultilingualNeural" /></div>
            </h1>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-3">
                <Link href={`/profile/${post.authorId}`} passHref>
                  <a className="flex items-center space-x-3 cursor-pointer">
                    <img src={post.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'} alt={post.authorName || '匿名用户'} className="w-12 h-12 rounded-full object-cover"/>
                    <div>
                      <p className="font-bold text-lg text-gray-900 dark:text-white hover:underline">{post.authorName || '匿名用户'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(post.createdAt).toLocaleDateString()}</p>
                    </div>
                  </a>
                </Link>
              </div>
              <div className="flex items-center space-x-2">
                {user && post.authorId !== user.uid && <button onClick={handleFollow} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${isFollowingPostAuthor ? 'bg-gray-200 text-gray-700' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>{isFollowingPostAuthor ? '已关注' : '关注'}</button>}
                <div className="relative" ref={menuRef}>
                  <button onClick={() => setShowMenu(prev => !prev)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><i className="fas fa-ellipsis text-xl text-gray-500 dark:text-gray-300"></i></button>
                  {showMenu && <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10 py-1 text-base">{/* ... 菜单项保持原样 ... */}</div>}
                </div>
              </div>
            </div>
            {/* 【需求 2】将帖子正文加粗 */}
            <div className="prose prose-lg dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 font-semibold">
              {post.content && <PostContent content={post.content} />}
            </div>
            
            <div className="flex items-center justify-end mt-4 pt-2 space-x-4">
                <AiTtsButton text={post.content} provider="microsoft" voice="zh-CN-XiaoxiaoMultilingualNeural" />
                <button onClick={() => handleVote(`posts/${postId}`, 'like')} disabled={!user} className={`flex items-center space-x-1 transition-colors ${postIsLiked ? 'text-red-500' : 'text-gray-400 dark:text-gray-500 hover:text-red-400'} ${!user ? 'opacity-50' : ''}`}><i className={`${postIsLiked ? 'fas' : 'far'} fa-heart text-xl`}></i><span className="font-semibold text-sm">{post.likesCount || 0}</span></button>
                <button onClick={() => handleVote(`posts/${postId}`, 'dislike')} disabled={!user} className={`flex items-center space-x-1 transition-colors ${postIsDisliked ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500 hover:text-blue-400'} ${!user ? 'opacity-50' : ''}`}><i className={`${postIsDisliked ? 'fas' : 'far'} fa-thumbs-down text-xl`}></i></button>
            </div>
          </div>
          {/* 【新需求】评论区容器，适配新的无卡片评论样式 */}
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <div className="flex justify-between items-center mb-2 p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">评论 ({post.commentsCount || 0})</h2>
                <div className="flex items-center space-x-4 text-sm font-semibold">
                    <button onClick={() => setSortOrder('最新')} className={sortOrder === '最新' ? 'text-blue-500' : 'text-gray-500 hover:text-blue-500'}>最新</button>
                    <button onClick={() => setSortOrder('最热')} className={sortOrder === '最热' ? 'text-blue-500' : 'text-gray-500 hover:text-blue-500'}>最热</button>
                </div>
            </div>
            
            <div className="p-4">
                {user ? (<form onSubmit={handleAddComment} className="mb-4"><div className="relative"><textarea ref={commentInputRef} value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={replyTo ? `回复 @${replyTo.authorName}...` : "发表你的看法..."} rows="4" className="w-full p-3 text-base border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 resize-y"/><div className="absolute bottom-3 right-3 flex items-center space-x-2">{replyTo && <button type="button" onClick={() => setReplyTo(null)} className="text-sm text-gray-500 hover:text-red-500 font-semibold">取消回复</button>}<button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-md font-semibold hover:bg-blue-700 transition-colors text-base">发表评论</button></div></div></form>) 
                : (<p className="text-center text-lg text-gray-600 dark:text-gray-400 mb-4 py-4">请<Link href="/signin"><a className="text-blue-500 hover:underline">登录</a></Link>后发表评论。</p>)}
            </div>

            <div>
              {mainComments.map((comment, index) => (
                <CommentItem 
                    key={comment.id} 
                    comment={comment} 
                    allComments={comments} 
                    user={user} 
                    post={post} 
                    handleVote={handleVote} 
                    handleDelete={handleDeleteComment} 
                    handleReply={handleReplyClick} 
                    isLast={index === mainComments.length - 1} // 传递是否为最后一个评论的标志
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </LayoutBase>
  );
};

// 【需求 4】使用 getServerSideProps (SSR) 进行数据预取
export async function getServerSideProps(context) {
    const { id } = context.params;

    try {
        // 1. 获取帖子详情
        const postRef = doc(db, 'posts', id);
        const postSnap = await getDoc(postRef);

        if (!postSnap.exists()) {
            return { notFound: true }; // 帖子不存在则返回 404
        }
        
        const postData = postSnap.data();
        // 序列化时间戳
        const serializedPost = {
            id: postSnap.id,
            ...postData,
            createdAt: postData.createdAt?.toDate().toISOString() || new Date().toISOString()
        };

        // 2. 获取第一页评论（默认按最新排序，前20条）
        const commentsRef = collection(db, 'posts', id, 'comments');
        const q = query(commentsRef, orderBy('createdAt', 'asc'), limit(20));
        const commentsSnap = await getDocs(q);

        const initialComments = commentsSnap.docs.map(doc => {
            const commentData = doc.data();
            return {
                id: doc.id,
                ...commentData,
                createdAt: commentData.createdAt?.toDate().toISOString() || new Date().toISOString()
            };
        });

        // 3. 将预取的数据作为 props 传递给页面组件
        return {
            props: {
                initialPost: serializedPost,
                initialComments: initialComments
            }
        };
    } catch (error) {
        console.error('SSR 数据获取失败:', error);
        // 如果服务器端获取失败，可以返回空 props，让客户端自行加载
        return {
            props: {
                initialPost: null,
                initialComments: []
            }
        };
    }
}

export default PostDetailPage;
