// pages/forum/post/[id].js (完整版，已修复表情、朗读、排序问题)
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  doc, collection, query, orderBy, onSnapshot,
  serverTimestamp, updateDoc, arrayUnion, arrayRemove, deleteDoc, writeBatch, increment
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../lib/AuthContext';
import { useRouter } from 'next/router';
import EmojiPicker from 'emoji-picker-react'; // 【修复】重新引入表情库

import PostContent from '@/themes/heo/components/PostContent';
import { LayoutBase } from '@/themes/heo';

// =====================================
// 1. 辅助组件
// =====================================

const ShareModal = ({ url, onClose }) => {
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

const CommentItem = ({ comment, allComments, user, post, handleVote, handleDelete, handleReply, handleTTS }) => {
  const [showFullReplies, setShowFullReplies] = useState(false);
  const commentIsLiked = user && comment.likers?.includes(user.uid);
  const commentIsDisliked = user && comment.dislikers?.includes(user.uid);
  const isAuthor = user && user.uid === comment.authorId;
  const isPostAuthor = user && user.uid === post.authorId;
  const canDelete = isAuthor || isPostAuthor;
  const directReplies = allComments.filter(c => c.parentId === comment.id);
  const visibleReplies = directReplies.slice(0, 2);
  const hasMoreReplies = directReplies.length > 2;
  const repliesToRender = showFullReplies ? directReplies : visibleReplies;

  return (
    <div className="flex items-start space-x-3 w-full">
      {comment.parentId === null && (
        <Link href={`/profile/${comment.authorId}`} passHref>
          <a className="flex-shrink-0">
            <img src={comment.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'} alt={comment.authorName || '匿名用户'} className="w-10 h-10 rounded-full object-cover cursor-pointer"/>
          </a>
        </Link>
      )}
      {comment.parentId !== null && <div className="w-10 flex-shrink-0"></div>}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <Link href={`/profile/${comment.authorId}`} passHref><a className="font-bold text-lg text-gray-800 dark:text-white cursor-pointer hover:underline">{comment.authorName || '匿名用户'}</a></Link>
          {comment.authorId === post.authorId && <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded-full font-semibold">楼主</span>}
        </div>
        
        <p className="text-gray-800 dark:text-gray-200 text-base font-normal break-words">{comment.text}</p>
        
        <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(comment.createdAt).toLocaleDateString()}</p>
            <div className="flex items-center space-x-3">
                <button onClick={() => handleTTS(comment.text)} title="朗读" className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"><i className="fas fa-volume-high"></i></button>
                <button onClick={() => handleVote({ path: `posts/${post.id}/comments/${comment.id}`, likers: comment.likers, dislikers: comment.dislikers }, 'like')} disabled={!user} className={`flex items-center space-x-1 text-xs ${commentIsLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}>
                    <i className={`${commentIsLiked ? 'fas' : 'far'} fa-heart`}></i>
                    <span>{comment.likersCount || 0}</span>
                </button>
                <button onClick={() => handleVote({ path: `posts/${post.id}/comments/${comment.id}`, likers: comment.likers, dislikers: comment.dislikers }, 'dislike')} disabled={!user} className={`flex items-center space-x-1 text-xs ${commentIsDisliked ? 'text-blue-500' : 'text-gray-500 hover:text-blue-500'}`}>
                    <i className={`${commentIsDisliked ? 'fas' : 'far'} fa-thumbs-down`}></i>
                    <span>{comment.dislikersCount || 0}</span>
                </button>
                <button onClick={() => handleReply(comment)} title="回复" className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"><i className="fas fa-comment-dots"></i></button>
                {canDelete && <button onClick={() => handleDelete(comment.id)} title="删除" className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"><i className="fas fa-trash"></i></button>}
            </div>
        </div>

        {directReplies.length > 0 && (
          <div className="mt-3 space-y-4">
            {repliesToRender.map(reply => (
              <CommentItem key={reply.id} comment={reply} allComments={allComments} user={user} post={post} handleVote={handleVote} handleDelete={handleDelete} handleReply={handleReply} handleTTS={handleTTS} />
            ))}
            {hasMoreReplies && !showFullReplies && (<button onClick={() => setShowFullReplies(true)} className="text-blue-500 dark:text-blue-400 text-sm font-semibold hover:underline mt-2 inline-block">展开其余 {directReplies.length - visibleReplies.length} 条回复</button>)}
            {showFullReplies && (<button onClick={() => setShowFullReplies(false)} className="text-blue-500 dark:text-blue-400 text-sm font-semibold hover:underline mt-2 inline-block">收起回复</button>)}
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
  const [currentAudio, setCurrentAudio] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false); // 【修复】添加表情选择器状态

  useEffect(() => {
    if (authLoading || !postId) return;
    setDataLoading(true);

    const postRef = doc(db, 'posts', postId);
    const postUnsubscribe = onSnapshot(postRef, (docSnap) => {
        if (docSnap.exists()) {
            const postData = docSnap.data();
            setPost({
                id: docSnap.id,
                ...postData,
                likers: Array.isArray(postData.likers) ? postData.likers : [],
                dislikers: Array.isArray(postData.dislikers) ? postData.dislikers : [],
                likesCount: postData.likesCount || 0,
                dislikesCount: postData.dislikesCount || 0,
                commentsCount: postData.commentsCount || 0
            });
        } else { setPost(null); }
    }, (error) => { console.error("获取帖子失败:", error); setPost(null); });

    const commentsRef = collection(db, 'posts', postId, 'comments');
    // 【修复】修正排序逻辑
    const q = sortOrder === '最热'
      ? query(commentsRef, orderBy('likersCount', 'desc'), orderBy('createdAt', 'desc'))
      : query(commentsRef, orderBy('createdAt', 'desc')); // 'asc' 改为 'desc'，实现“最新”
      
    const commentsUnsubscribe = onSnapshot(q, (querySnapshot) => {
        const allCommentsData = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id, ...data,
                createdAt: data.createdAt?.toDate() || new Date(), 
                likers: data.likers || [], dislikers: data.dislikers || [],
                likersCount: data.likersCount || 0, dislikersCount: data.dislikersCount || 0,
                parentId: data.parentId || null, text: data.text || ''
            };
        });
        setComments(allCommentsData);
        setDataLoading(false);
    }, (error) => {
        console.error("【Firestore错误】获取评论失败，请检查数据库索引:", error);
        alert("评论加载失败，可能是“最热”排序缺少数据库索引，请按F12在控制台查看详情。");
        setComments([]);
        setDataLoading(false);
    });

    // 【修复】组件卸载时停止音频
    return () => {
      postUnsubscribe();
      commentsUnsubscribe();
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
      }
    };
  }, [postId, authLoading, sortOrder]);

  // 【修复】朗读功能
  const handleTTS = (text) => {
    if (!text || typeof text !== 'string') {
        console.error("朗读失败：文本无效。");
        return;
    }
    if (currentAudio) {
        currentAudio.pause();
    }
    const encodedText = encodeURIComponent(text.substring(0, 200)); // 限制长度防止URL过长
    const ttsUrl = `https://t.leftsite.cn/tts?t=${encodedText}&v=zh-CN-XiaoxiaoMultilingualNeural&r=0&p=0&o=audio-24khz-48kbitrate-mono-mp3`;
    const audio = new Audio(ttsUrl);
    audio.play().catch(e => console.error("音频播放错误:", e));
    setCurrentAudio(audio);
  };
  
  const handleVote = async (target, type) => {
    if (!user) { alert('请登录后操作！'); return; }
    const { path, likers, dislikers } = target;
    const docRef = doc(db, path);
    const userId = user.uid;
    const batch = writeBatch(db);
    const isLiked = likers.includes(userId);
    const isDisliked = dislikers.includes(userId);
    if (type === 'like') {
        if (isLiked) {
            batch.update(docRef, { likers: arrayRemove(userId), likesCount: increment(-1) });
        } else {
            batch.update(docRef, { likers: arrayUnion(userId), likesCount: increment(1) });
            if (isDisliked) { batch.update(docRef, { dislikers: arrayRemove(userId), dislikersCount: increment(-1) }); }
        }
    } else if (type === 'dislike') {
        if (isDisliked) {
            batch.update(docRef, { dislikers: arrayRemove(userId), dislikersCount: increment(-1) });
        } else {
            batch.update(docRef, { dislikers: arrayUnion(userId), dislikersCount: increment(1) });
            if (isLiked) { batch.update(docRef, { likers: arrayRemove(userId), likesCount: increment(-1) }); }
        }
    }
    try { await batch.commit(); } catch (error) { console.error("投票操作失败:", error); }
  };
  
  const handleDeleteComment = async (commentId) => { if (!post) return; const commentToDelete = comments.find(c => c.id === commentId); if (!commentToDelete) return; const isAuthor = user && user.uid === commentToDelete.authorId; const isPostAuthor = user && user.uid === post.authorId; if (!isAuthor && !isPostAuthor) return; if (confirm('确定要删除这条评论及其所有回复吗？')) { let count = 0; const countReplies = (cId) => { count++; comments.filter(c => c.parentId === cId).forEach(r => countReplies(r.id)); }; countReplies(commentId); const deleteRecursive = async (cId) => { const replies = comments.filter(c => c.parentId === cId); for (const r of replies) { await deleteRecursive(r.id); } await deleteDoc(doc(db, 'posts', postId, 'comments', cId)); }; try { await deleteRecursive(commentId); await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(-count) }); } catch (error) { console.error("删除评论失败: ", error); } } };
  
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !user || !post) { if(!user) alert('请先登录再发表评论。'); return; }
    const postRef = doc(db, 'posts', postId);
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const newCommentRef = doc(commentsRef);
    const batch = writeBatch(db);
    batch.set(newCommentRef, {
        postId: postId, text: newComment, authorId: user.uid,
        authorName: user.displayName || '匿名用户', authorAvatar: user.photoURL || 'https://www.gravatar.com/avatar?d=mp',
        createdAt: serverTimestamp(), likers: [], dislikers: [], likersCount: 0, dislikersCount: 0,
        parentId: replyTo ? replyTo.id : null
    });
    batch.update(postRef, { commentsCount: increment(1) });
    try { await batch.commit(); setNewComment(''); setReplyTo(null); } catch (error) { console.error("发表评论失败:", error); }
  };

  // 【修复】添加表情处理函数
  const onEmojiClick = (emojiObject) => {
    setNewComment(prevInput => prevInput + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const handleReplyClick = (comment) => { setReplyTo({ id: comment.id, authorName: comment.authorName }); setNewComment(`@${comment.authorName} `); if (commentInputRef.current) { commentInputRef.current.focus(); } };
  const handleFollow = async () => { if (!user || !post || user.uid === post.authorId) return; const userRef = doc(db, 'users', user.uid); try { await updateDoc(userRef, { following: userData?.following?.includes(post.authorId) ? arrayRemove(post.authorId) : arrayUnion(post.authorId) }); } catch (error) {} };
  const handleBookmark = async () => { if (!user || !post) return; const userRef = doc(db, 'users', user.uid); try { await updateDoc(userRef, { bookmarks: userData?.bookmarks?.includes(postId) ? arrayRemove(postId) : arrayUnion(postId) }); } catch (error) {} };
  const handleMenuItemClick = async (action) => { setShowMenu(false); if (!user || !post) return; switch (action) { case 'delete': if (user.uid !== post.authorId) return; if (confirm('确定要删除此帖子吗？')) { try { await deleteDoc(doc(db, 'posts', postId)); router.push('/forum'); } catch (error) {} } break; case 'edit': if (user.uid !== post.authorId) return; alert('修改功能待实现。'); break; case 'share': setShowShareModal(true); break; case 'bookmark': handleBookmark(); break; case 'report': alert('举报功能待实现。'); break; } };

  if (authLoading || dataLoading) { return <LayoutBase><p className="p-8 text-center text-xl">加载中...</p></LayoutBase>; }
  if (!post) { return <LayoutBase><p className="p-8 text-center text-xl text-red-500">帖子不存在或已被删除。</p></LayoutBase>; }

  const mainComments = comments.filter(comment => !comment.parentId);
  const postIsLiked = user && post.likers?.includes(user.uid);
  const postIsDisliked = user && post.dislikers?.includes(user.uid);
  const isFollowingPostAuthor = user && Array.isArray(userData?.following) && userData.following.includes(post.authorId);
  const isBookmarked = user && Array.isArray(userData?.bookmarks) && userData.bookmarks.includes(postId);

  return (
    <LayoutBase>
      {showShareModal && <ShareModal url={window.location.href} onClose={() => setShowShareModal(false)} />}
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen py-8">
        <div className="container mx-auto p-4 max-w-4xl text-base sm:text-lg">
          <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg relative mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold mb-4 text-gray-900 dark:text-white leading-tight flex items-center">
              <span>{post.title}</span>
              <button onClick={() => handleTTS(post.title)} title="朗读标题" className="ml-3 text-gray-400 hover:text-blue-500 transition-colors"><i className="fas fa-volume-high text-xl"></i></button>
            </h1>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-3"><Link href={`/profile/${post.authorId}`} passHref><a className="flex items-center space-x-3 cursor-pointer"><img src={post.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'} alt={post.authorName || '匿名用户'} className="w-12 h-12 rounded-full object-cover"/><div><p className="font-bold text-lg text-gray-900 dark:text-white hover:underline">{post.authorName || '匿名用户'}</p><p className="text-xs text-gray-500 dark:text-gray-400">{new Date(post.createdAt?.toDate()).toLocaleDateString()}</p></div></a></Link></div>
              <div className="flex items-center space-x-2">{user && post.authorId !== user.uid && <button onClick={handleFollow} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${isFollowingPostAuthor ? 'bg-gray-200 text-gray-700' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>{isFollowingPostAuthor ? '已关注' : '关注'}</button>}
                <div className="relative"><button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><i className="fas fa-ellipsis text-xl text-gray-500 dark:text-gray-300"></i></button>{showMenu && <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10 py-1 text-base">{user && user.uid === post.authorId && (<><button onClick={() => handleMenuItemClick('edit')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-pen-to-square mr-2 text-lg"></i>修改</button><button onClick={() => handleMenuItemClick('delete')} className="flex items-center w-full text-left px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-800 font-semibold"><i className="fas fa-trash mr-2 text-lg"></i>删除</button></>)}<button onClick={() => handleMenuItemClick('share')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-share-nodes mr-2 text-lg"></i>分享</button><button onClick={() => handleMenuItemClick('bookmark')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className={`${isBookmarked ? 'fas' : 'far'} fa-bookmark mr-2 text-lg`}></i>收藏</button><button onClick={() => handleMenuItemClick('report')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-flag mr-2 text-lg"></i>举报</button></div>}</div>
              </div>
            </div>
            <div className="prose prose-lg dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">{post.content && <PostContent content={post.content} />}</div>
            
            <div className="flex items-center justify-end mt-4 pt-2 space-x-4">
                <button onClick={() => handleTTS(post.content?.body)} title="朗读" className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"><i className="fas fa-volume-high text-xl"></i></button>
                <button onClick={() => handleVote({ path: `posts/${postId}`, likers: post.likers, dislikers: post.dislikers }, 'like')} disabled={!user} className={`flex items-center space-x-1 transition-colors ${postIsLiked ? 'text-red-500' : 'text-gray-400 dark:text-gray-500 hover:text-red-400'} ${!user ? 'opacity-50' : ''}`}><i className={`${postIsLiked ? 'fas' : 'far'} fa-heart text-xl`}></i><span className="font-semibold text-sm">{post.likesCount || 0}</span></button>
                <button onClick={() => handleVote({ path: `posts/${postId}`, likers: post.likers, dislikers: post.dislikers }, 'dislike')} disabled={!user} className={`flex items-center space-x-1 transition-colors ${postIsDisliked ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500 hover:text-blue-400'} ${!user ? 'opacity-50' : ''}`}><i className={`${postIsDisliked ? 'fas' : 'far'} fa-thumbs-down text-xl`}></i><span className="font-semibold text-sm">{post.dislikesCount || 0}</span></button>
            </div>
          </div>
          <div className="mt-8">
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">评论 ({post.commentsCount || 0})</h2><div className="flex items-center space-x-4 text-sm font-semibold"><button onClick={() => setSortOrder('最新')} className={sortOrder === '最新' ? 'text-blue-500' : 'text-gray-500 hover:text-blue-500'}>最新</button><button onClick={() => setSortOrder('最热')} className={sortOrder === '最热' ? 'text-blue-500' : 'text-gray-500 hover:text-blue-500'}>最热</button></div></div>
            
            {/* 【修复】评论输入框，增加表情功能 */}
            {user ? (
              <form onSubmit={handleAddComment} className="mb-8 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <div className="relative">
                  <textarea ref={commentInputRef} value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={replyTo ? `回复 @${replyTo.authorName}...` : "发表你的看法..."} rows="4" className="w-full p-3 pr-28 text-base border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 resize-y"/>
                  <div className="absolute bottom-3 right-3 flex items-center space-x-2">
                    {replyTo && <button type="button" onClick={() => { setReplyTo(null); setNewComment(''); }} className="text-sm text-gray-500 hover:text-red-500 font-semibold">取消回复</button>}
                    {/* 表情按钮 */}
                    <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-gray-500 hover:text-blue-500 text-xl"><i className="far fa-smile"></i></button>
                    <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-md font-semibold hover:bg-blue-700 transition-colors text-base">发表</button>
                  </div>
                  {/* 表情选择器 */}
                  {showEmojiPicker && (
                    <div className="absolute right-0 bottom-full mb-2 z-20">
                       <EmojiPicker onEmojiClick={onEmojiClick} />
                    </div>
                  )}
                </div>
              </form>
            ) : (
              <p className="text-center text-lg text-gray-600 dark:text-gray-400 mb-8 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg">请<Link href="/signin"><a className="text-blue-500 hover:underline">登录</a></Link>后发表评论。</p>
            )}

            <div className="space-y-6">
              {mainComments.map(comment => (
                <CommentItem key={comment.id} comment={comment} allComments={comments} user={user} post={post} handleVote={handleVote} handleDelete={handleDeleteComment} handleReply={handleReplyClick} handleTTS={handleTTS} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </LayoutBase>
  );
};

export default PostDetailPage;
