// pages/forum/post/[id].js (最终版 - 集成新TTS组件、设置菜单 & UI优化)

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  doc, collection, query, orderBy, onSnapshot,
  serverTimestamp, updateDoc, arrayUnion, arrayRemove, deleteDoc, writeBatch, increment
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../lib/AuthContext';
import { useRouter } from 'next/router';

import PostContent from '@/themes/heo/components/PostContent';
import { LayoutBase } from '@/themes/heo';
import AiTtsButton from '@/components/AiTtsButton';
import TtsSettingsModal from '@/components/TtsSettingsModal'; // 1. 导入设置弹窗组件

// =====================================
// 辅助组件
// =====================================

const ShareModal = ({ url, onClose }) => {
    // ... (代码保持不变)
    const shareOptions=[{name:'复制链接',iconClass:'fas fa-copy',action:()=>{navigator.clipboard.writeText(url);alert('链接已复制!');onClose();}},{name:'Facebook',iconClass:'fab fa-facebook',href:`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`},{name:'Messenger',iconClass:'fab fa-facebook-messenger',href:`fb-messenger://share?link=${encodeURIComponent(url)}`},{name:'Telegram',iconClass:'fab fa-telegram',href:`https://t.me/share/url?url=${encodeURIComponent(url)}`},{name:'WhatsApp',iconClass:'fab fa-whatsapp',href:`https://api.whatsapp.com/send?text=${encodeURIComponent(url)}`},{name:'QQ',iconClass:'fab fa-qq',href:`https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(url)}`},{name:'WeChat',iconClass:'fab fa-weixin',action:()=>alert('微信分享请使用浏览器自带分享功能或截图')}];return(<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}><div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl w-full max-w-sm" onClick={(e)=>e.stopPropagation()}><h3 className="text-xl font-bold mb-5 text-center text-gray-900 dark:text-white">分享到</h3><div className="grid grid-cols-2 gap-4 text-center">{shareOptions.map(opt=>(opt.action?<button key={opt.name} onClick={opt.action} className="flex items-center justify-center p-3 h-14 bg-gray-100 dark:bg-gray-700 rounded-lg text-base font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><i className={`${opt.iconClass} mr-2 w-5 text-lg`}></i>{opt.name}</button>:<a key={opt.name} href={opt.href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center p-3 h-14 bg-gray-100 dark:bg-gray-700 rounded-lg text-base font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><i className={`${opt.iconClass} mr-2 w-5 text-lg`}></i>{opt.name}</a>))}</div></div></div>);
};

const CompactReply = ({ reply }) => (
    <div className="text-base font-medium text-gray-700 dark:text-gray-300 truncate">
        <Link href={`/profile/${reply.authorId}`} passHref><a className="font-bold text-gray-800 dark:text-white hover:underline">{reply.authorName || '匿名用户'}</a></Link>
        <span className="ml-2">{reply.text}</span>
    </div>
);

// CommentItem 现在接收 ttsSettings 并向下传递
const CommentItem = ({ comment, allComments, user, postAuthorId, handleVote, handleDelete, handleReply, ttsSettings }) => {
  const [showFullReplies, setShowFullReplies] = useState(false); // [BUG修复] 修正 useState
  const isCommentLiked = user && Array.isArray(comment.likedBy) && comment.likedBy.includes(user.uid);
  const isCommentDisliked = user && Array.isArray(comment.dislikedBy) && comment.dislikedBy.includes(user.uid);
  const isAuthor = user && user.uid === comment.authorId;
  const isPostAuthor = user && user.uid === postAuthorId;
  const canDelete = isAuthor || isPostAuthor;
  const directReplies = allComments.filter(c => c.parentId === comment.id);
  const visibleReplies = directReplies.slice(0, 2);
  const hasMoreReplies = directReplies.length > 2;
  const isTopLevelComment = comment.parentId === null;

  return (
    <div className="flex items-start space-x-3 w-full">
      {isTopLevelComment && (<Link href={`/profile/${comment.authorId}`} passHref><a><img src={comment.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'} alt={comment.authorName || '匿名用户'} className="w-10 h-10 rounded-full object-cover cursor-pointer flex-shrink-0"/></a></Link>)}
      <div className={`flex-1 min-w-0 ${!isTopLevelComment ? 'ml-12' : ''}`}>
        <div className="flex items-center space-x-2 mb-1"><Link href={`/profile/${comment.authorId}`} passHref><a className="font-bold text-lg text-gray-800 dark:text-white cursor-pointer hover:underline">{comment.authorName || '匿名用户'}</a></Link>{comment.authorId === postAuthorId && <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded-full font-semibold">楼主</span>}</div>
        <p className="text-gray-800 dark:text-gray-200 text-base font-medium break-words">{comment.text}</p>
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mt-2">
          <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
          <div className="flex items-center space-x-4">
            <AiTtsButton text={comment.text} ttsSettings={ttsSettings} />
            <button onClick={() => handleVote(comment.id, 'like')} disabled={!user} className={`flex items-center space-x-1 text-base transition-colors ${isCommentLiked?'text-red-500':'text-gray-400 dark:text-gray-500 hover:text-red-400'} ${!user?'opacity-50':''}`}><i className={`${isCommentLiked?'fas':'far'} fa-heart text-xl`}></i><span className="font-semibold">{comment.likedBy?.length||0}</span></button>
            <button onClick={() => handleVote(comment.id, 'dislike')} disabled={!user} className={`flex items-center space-x-1 text-base transition-colors ${isCommentDisliked?'text-blue-500':'text-gray-400 dark:text-gray-500 hover:text-blue-400'} ${!user?'opacity-50':''}`}><i className={`${isCommentDisliked?'fas':'far'} fa-thumbs-down text-xl`}></i><span className="font-semibold">{comment.dislikedBy?.length||0}</span></button>
            <button onClick={() => handleReply(comment)} title="回复" className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"><i className="fas fa-comment-dots text-xl"></i></button>
            {canDelete && <button onClick={() => handleDelete(comment.id)} title="删除" className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"><i className="fas fa-trash text-lg"></i></button>}
          </div>
        </div>
        {directReplies.length > 0 && (
          <div className="mt-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg space-y-2">
            {showFullReplies ? (
                <div className="space-y-4">{directReplies.map(reply => (<CommentItem key={reply.id} comment={reply} allComments={allComments} user={user} postAuthorId={postAuthorId} handleVote={handleVote} handleDelete={handleDelete} handleReply={handleReply} ttsSettings={ttsSettings} />))}</div>
            ) : (<div className="space-y-1">{visibleReplies.map(reply => (<CompactReply key={reply.id} reply={reply} />))}</div>)}
            {hasMoreReplies && !showFullReplies && (<button onClick={() => setShowFullReplies(true)} className="text-blue-500 dark:text-blue-400 text-sm font-semibold hover:underline mt-2 inline-block">展开其余 {directReplies.length-visibleReplies.length} 条回复</button>)}
            {showFullReplies && (<button onClick={() => setShowFullReplies(false)} className="text-blue-500 dark:text-blue-400 text-sm font-semibold hover:underline mt-2 inline-block">收起</button>)}
          </div>
        )}
      </div>
    </div>
  );
};

const PostDetailPage = () => {
  const router = useRouter();
  const { id: postId } = router.query;
  const { user, userData, loading: authLoading } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('最新');
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const commentInputRef = useRef(null);

  // 2. 新增 TTS 设置状态
  const [showTtsModal, setShowTtsModal] = useState(false);
  const [ttsSettings, setTtsSettings] = useState({
    thirdPartyTtsVoice: 'zh-CN-XiaoxiaoMultilingualNeural',
    ttsRate: 0,
    ttsPitch: 0,
  });

  // 3. 从 localStorage 加载设置
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('ttsSettings');
      if (savedSettings) {
        setTtsSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error("加载 TTS 设置失败:", error);
    }
  }, []);
  
  // 4. 保存设置到 state 和 localStorage
  const handleSaveTtsSettings = (newSettings) => {
    setTtsSettings(newSettings);
    try {
      localStorage.setItem('ttsSettings', JSON.stringify(newSettings));
    } catch (error) {
      console.error("保存 TTS 设置失败:", error);
    }
  };

  useEffect(() => {
    if (authLoading || !postId) return;
    setDataLoading(true);
    const postRef = doc(db, 'posts', postId);
    const postUnsubscribe = onSnapshot(postRef, (docSnap) => { if (docSnap.exists()) { const postData = docSnap.data(); setPost({ id: docSnap.id, ...postData, likes: Array.isArray(postData.likes) ? postData.likes : [], dislikes: Array.isArray(postData.dislikes) ? postData.dislikes : [], likesCount: postData.likesCount || 0, commentsCount: postData.commentsCount || 0 }); } else { setPost(null); } }, (error) => { console.error("获取帖子失败:", error); setPost(null); });
    const commentsRef = collection(db, 'posts', postId, 'comments');
    let q;
    if (sortOrder === '最热') { q = query(commentsRef, orderBy('likedByCount', 'desc'), orderBy('createdAt', 'desc')); } else { q = query(commentsRef, orderBy('createdAt', 'asc')); }
    const commentsUnsubscribe = onSnapshot(q, (querySnapshot) => { const allCommentsData = querySnapshot.docs.map(doc => { const data = doc.data(); return { id: doc.id, ...data, createdAt: data.createdAt?.toDate() || new Date(), likedBy: Array.isArray(data.likedBy) ? data.likedBy : [], dislikedBy: Array.isArray(data.dislikedBy) ? data.dislikedBy : [], parentId: data.parentId || null, text: data.text || '' }; }); setComments(allCommentsData); setDataLoading(false); }, (error) => { console.error("获取评论失败:", error); setComments([]); setDataLoading(false); });
    return () => { postUnsubscribe(); commentsUnsubscribe(); };
  }, [postId, authLoading, sortOrder]);
  
  // ... (其他 handler 函数保持不变)
  const voteHandler = async(docRef, type, currentLikes, currentDislikes, isPost = false) => {/* ... */};const handlePostVote = (type) => {/* ... */};const handleCommentVote = (commentId, type) => {/* ... */};const handleDeleteComment = async(commentId) => {/* ... */};const handleAddComment = async(e) => {/* ... */};const handleReplyClick = (comment) => {/* ... */};const handleFollow = async() => {/* ... */};const handleBookmark = async() => {/* ... */};
  
  const handleMenuItemClick = async (action) => {
    setShowMenu(false);
    if (!user && ['delete', 'edit', 'bookmark'].includes(action)) return;
    if (!post) return;
    switch (action) {
      case 'tts-settings': // 5. 新增菜单项处理
        setShowTtsModal(true);
        break;
      case 'delete': if (user.uid !== post.authorId) return; if (confirm('确定要删除此帖子吗？')) { try { await deleteDoc(doc(db, 'posts', postId)); router.push('/forum'); } catch (error) {} } break;
      case 'edit': if (user.uid !== post.authorId) return; alert('修改功能待实现。'); break;
      case 'share': setShowShareModal(true); break;
      case 'bookmark': handleBookmark(); break;
      case 'report': alert('举报功能待实现。'); break;
    }
  };

  if (authLoading || dataLoading) { return <LayoutBase><p className="p-8 text-center text-xl">加载中...</p></LayoutBase>; }
  if (!post) { return <LayoutBase><p className="p-8 text-center text-xl text-red-500">帖子不存在或已被删除。</p></LayoutBase>; }

  const mainComments = comments.filter(comment => !comment.parentId);
  const postIsLiked = user && post.likes.includes(user.uid);
  const postIsDisliked = user && post.dislikes.includes(user.uid);
  const isFollowingPostAuthor = user && Array.isArray(userData?.following) && userData.following.includes(post.authorId);
  const isBookmarked = user && Array.isArray(userData?.bookmarks) && userData.bookmarks.includes(postId);

  return (
    <LayoutBase>
      {showShareModal && <ShareModal url={window.location.href} onClose={() => setShowShareModal(false)} />}
      {/* 6. 渲染 TTS 设置弹窗 */}
      {showTtsModal && <TtsSettingsModal currentSettings={ttsSettings} onSave={handleSaveTtsSettings} onClose={() => setShowTtsModal(false)} />}
      
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen py-8">
        <div className="container mx-auto p-4 max-w-4xl text-base sm:text-lg">
          <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg relative mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold mb-4 text-gray-900 dark:text-white leading-tight flex items-center">
              <span>{post.title}</span>
              <div className="ml-3"><AiTtsButton text={post.title} ttsSettings={ttsSettings} /></div>
            </h1>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-3"><Link href={`/profile/${post.authorId}`} passHref><a><img src={post.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'} alt={post.authorName || '匿名用户'} className="w-12 h-12 rounded-full object-cover"/><div><p className="font-bold text-lg text-gray-900 dark:text-white hover:underline">{post.authorName || '匿名用户'}</p><p className="text-xs text-gray-500 dark:text-gray-400">{new Date(post.createdAt?.toDate()).toLocaleDateString()}</p></div></a></Link></div>
              <div className="flex items-center space-x-2">{user && post.authorId !== user.uid && <button onClick={handleFollow} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${isFollowingPostAuthor ? 'bg-gray-200 text-gray-700' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>{isFollowingPostAuthor ? '已关注' : '关注'}</button>}
                <div className="relative"><button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><i className="fas fa-ellipsis text-xl text-gray-500 dark:text-gray-300"></i></button>
                  {showMenu && <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10 py-1 text-base">
                    {/* 7. 新增 TTS 设置菜单项 */}
                    <button onClick={() => handleMenuItemClick('tts-settings')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-sliders-h mr-2 text-lg"></i>TTS 设置</button>
                    <hr className="my-1 border-gray-200 dark:border-gray-600"/>
                    {user && user.uid === post.authorId && (<><button onClick={() => handleMenuItemClick('edit')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-pen-to-square mr-2 text-lg"></i>修改</button><button onClick={() => handleMenuItemClick('delete')} className="flex items-center w-full text-left px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-800 font-semibold"><i className="fas fa-trash mr-2 text-lg"></i>删除</button></>)}
                    <button onClick={() => handleMenuItemClick('share')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-share-nodes mr-2 text-lg"></i>分享</button>
                    <button onClick={() => handleMenuItemClick('bookmark')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className={`${isBookmarked?'fas':'far'} fa-bookmark mr-2 text-lg`}></i>收藏</button>
                    <button onClick={() => handleMenuItemClick('report')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-flag mr-2 text-lg"></i>举报</button>
                  </div>}
                </div>
              </div>
            </div>
            <div className="prose dark:prose-invert max-w-none text-xl font-semibold leading-relaxed mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">{post.content && <PostContent content={post.content} />}</div>
            <div className="flex items-center justify-end mt-4 pt-2 space-x-4">
                <AiTtsButton text={post.content} ttsSettings={ttsSettings} />
                <button onClick={() => handlePostVote('like')} disabled={!user} className={`flex items-center space-x-1 transition-colors ${postIsLiked?'text-red-500':'text-gray-400 dark:text-gray-500 hover:text-red-400'} ${!user?'opacity-50':''}`}><i className={`${postIsLiked?'fas':'far'} fa-heart text-xl`}></i><span className="font-semibold text-sm">{post.likesCount||0}</span></button>
                <button onClick={() => handlePostVote('dislike')} disabled={!user} className={`flex items-center space-x-1 transition-colors ${postIsDisliked?'text-blue-500':'text-gray-400 dark:text-gray-500 hover:text-blue-400'} ${!user?'opacity-50':''}`}><i className={`${postIsDisliked?'fas':'far'} fa-thumbs-down text-xl`}></i></button>
            </div>
          </div>
          <div className="mt-8">
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">评论 ({post.commentsCount || 0})</h2><div className="flex items-center space-x-4 text-sm font-semibold"><button onClick={() => setSortOrder('最新')} className={sortOrder === '最新' ? 'text-blue-500' : 'text-gray-500 hover:text-blue-500'}>最新</button><button onClick={() => setSortOrder('最热')} className={sortOrder === '最热' ? 'text-blue-500' : 'text-gray-500 hover:text-blue-500'}>最热</button></div></div>
            {user ? (<form onSubmit={handleAddComment} className="mb-8 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg"><div className="relative"><textarea ref={commentInputRef} value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={replyTo ? `回复 @${replyTo.authorName}...` : "发表你的看法..."} rows="4" className="w-full p-3 text-base border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 resize-y"/><div className="absolute bottom-3 right-3 flex items-center space-x-2">{replyTo && <button type="button" onClick={() => { setReplyTo(null); setNewComment(''); }} className="text-sm text-gray-500 hover:text-red-500 font-semibold">取消回复</button>}<button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-md font-semibold hover:bg-blue-700 transition-colors text-base">发表评论</button></div></div></form>) : (<p className="text-center text-lg text-gray-600 dark:text-gray-400 mb-8 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg">请<Link href="/signin"><a className="text-blue-500 hover:underline">登录</a></Link>后发表评论。</p>)}
            <div className="space-y-6">{mainComments.map(comment => (<CommentItem key={comment.id} comment={comment} allComments={comments} user={user} postAuthorId={post.authorId} handleVote={handleCommentVote} handleDelete={handleDeleteComment} handleReply={handleReplyClick} ttsSettings={ttsSettings} />))}</div>
          </div>
        </div>
      </div>
    </LayoutBase>
  );
};

export default PostDetailPage;
