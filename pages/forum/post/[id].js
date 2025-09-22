// pages/forum/post/[id].js (最终版 - 优化UI和翻译)
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  doc, getDoc, collection, addDoc, query, orderBy, onSnapshot,
  serverTimestamp, updateDoc, arrayUnion, arrayRemove, deleteDoc, writeBatch, increment
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../lib/AuthContext';
import { useRouter } from 'next/router';

import PostContent from '@/themes/heo/components/PostContent';
import { LayoutBase } from '@/themes/heo';

// ... (ShareModal, GeminiSettingsModal 组件保持不变) ...

// 【修改】CompactReply，使其更紧凑
const CompactReply = ({ reply, allComments }) => (
    <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
        <Link href={`/profile/${reply.authorId}`} passHref>
            <a className="font-semibold text-gray-800 dark:text-white hover:underline">{reply.authorName || '匿名用户'}</a>
        </Link>
        <span className="ml-2">{reply.text}</span>
    </div>
);

// 【修改】CommentItem，回复展开后显示完整样式
const CommentItem = ({ comment, allComments, user, postAuthorId, handleVote, handleDelete, handleReply, handleTTS, handleTranslate, translatedText, isTranslating }) => {
  const [showFullReplies, setShowFullReplies] = useState(false);
  const isCommentLiked = user && Array.isArray(comment.likedBy) && comment.likedBy.includes(user.uid);
  const isCommentDisliked = user && Array.isArray(comment.dislikedBy) && comment.dislikedBy.includes(user.uid);
  const isAuthor = user && user.uid === comment.authorId;
  const isPostAuthor = user && user.uid === postAuthorId;
  const canDelete = isAuthor || isPostAuthor;
  const directReplies = allComments.filter(c => c.parentId === comment.id);
  const visibleReplies = directReplies.slice(0, 2);
  const hasMoreReplies = directReplies.length > 2;
  const contentToShow = translatedText || comment.text;

  return (
    <div className="flex items-start space-x-3 w-full">
      <Link href={`/profile/${comment.authorId}`} passHref><a><img src={comment.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'} alt={comment.authorName || '匿名用户'} className="w-10 h-10 rounded-full object-cover cursor-pointer flex-shrink-0"/></a></Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <Link href={`/profile/${comment.authorId}`} passHref><a className="font-bold text-lg text-gray-800 dark:text-white cursor-pointer hover:underline">{comment.authorName || '匿名用户'}</a></Link>
          {comment.authorId === postAuthorId && <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded-full font-semibold">楼主</span>}
        </div>
        <p className="text-gray-800 dark:text-gray-200 text-base font-normal break-words">{contentToShow}</p>
        {translatedText && (<button onClick={() => handleTranslate(comment.text, 'comment', comment.id, true)} className="text-gray-500 text-sm mt-1 ml-2">查看原文</button>)}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mt-2">
          <span>{new Date(comment.createdAt?.toDate()).toLocaleDateString()}</span>
          <div className="flex items-center space-x-4">
            <button onClick={() => handleTTS(contentToShow)} title="朗读" className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"><i className="fas fa-volume-high text-lg"></i></button>
            <button onClick={() => handleTranslate(comment.text, 'comment', comment.id)} disabled={isTranslating} title="翻译" className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors disabled:opacity-50"><i className="fas fa-language text-lg"></i></button>
            <button onClick={() => handleVote(comment.id, 'like')} disabled={!user} className={`flex items-center space-x-1 text-base transition-colors ${isCommentLiked ? 'text-red-500' : 'text-gray-400 dark:text-gray-500 hover:text-red-400'} ${!user ? 'opacity-50' : ''}`}><i className={`${isCommentLiked ? 'fas' : 'far'} fa-heart text-lg`}></i><span className="font-semibold text-xs">{comment.likedBy?.length || 0}</span></button>
            <button onClick={() => handleReply(comment)} title="回复" className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"><i className="fas fa-comment-dots text-lg"></i></button>
            {canDelete && <button onClick={() => handleDelete(comment.id)} title="删除" className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"><i className="fas fa-trash text-lg"></i></button>}
          </div>
        </div>
        {directReplies.length > 0 && (
          <div className="mt-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg space-y-2">
            {showFullReplies ? (
                <div className="space-y-4">{directReplies.map(reply => (<CommentItem key={reply.id} comment={reply} allComments={allComments} user={user} postAuthorId={postAuthorId} handleVote={handleVote} handleDelete={handleDelete} handleReply={handleReply} handleTTS={handleTTS} handleTranslate={handleTranslate} translatedText={translatedComments[reply.id]} isTranslating={isTranslating} />))}</div>
            ) : (
                <div className="space-y-1">{visibleReplies.map(reply => (<CompactReply key={reply.id} reply={reply} allComments={allComments} /> ))}</div>
            )}
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
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedPostContent, setTranslatedPostContent] = useState(null);
  const [translatedComments, setTranslatedComments] = useState({});
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-pro');

  useEffect(() => {
    const savedKey = typeof window !== 'undefined' ? localStorage.getItem('geminiApiKey') : null;
    const savedModel = typeof window !== 'undefined' ? localStorage.getItem('geminiModel') : null;
    if (savedKey) setGeminiApiKey(savedKey);
    if (savedModel) setGeminiModel(savedModel);
  }, []);

  useEffect(() => {
    if (authLoading || !postId) return;
    setDataLoading(true);
    const postRef = doc(db, 'posts', postId);
    const postUnsubscribe = onSnapshot(postRef, (docSnap) => { if (docSnap.exists()) { const postData = docSnap.data(); setPost({ id: docSnap.id, ...postData, likes: Array.isArray(postData.likes) ? postData.likes : [], dislikes: Array.isArray(postData.dislikes) ? postData.dislikes : [], likesCount: postData.likesCount || 0, commentsCount: postData.commentsCount || 0 }); } else { setPost(null); } }, (error) => { setPost(null); });
    const commentsRef = collection(db, 'posts', postId, 'comments');
    let q;
    if (sortOrder === '最热') { q = query(commentsRef, orderBy('likedByCount', 'desc'), orderBy('createdAt', 'desc')); } else { q = query(commentsRef, orderBy('createdAt', 'asc')); }
    const commentsUnsubscribe = onSnapshot(q, (querySnapshot) => { const allCommentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() || new Date(), likedBy: Array.isArray(doc.data().likedBy) ? doc.data().likedBy : [], dislikedBy: Array.isArray(doc.data().dislikedBy) ? doc.data().dislikedBy : [], parentId: doc.data().parentId || null })); setComments(allCommentsData); setDataLoading(false); }, (error) => { setComments([]); setDataLoading(false); });
    return () => { postUnsubscribe(); commentsUnsubscribe(); };
  }, [postId, authLoading, sortOrder]);

  const handleTTS = (text) => { if (currentAudio) { currentAudio.pause(); } const encodedText = encodeURIComponent(text); const ttsUrl = `https://t.leftsite.cn/tts?t=${encodedText}&v=zh-CN-XiaoxiaoMultilingualNeural&r=0&p=0&o=audio-24khz-48kbitrate-mono-mp3`; const audio = new Audio(ttsUrl); audio.play(); setCurrentAudio(audio); };
  
  // 【修改】升级版翻译函数
  const callGeminiApi = async (text, apiKey, model) => {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const prompt = `You are a professional translator. Your task is to translate the given text. First, identify if the text is primarily in Chinese or Burmese. If it is in Chinese, translate it into natural, idiomatic Burmese. If it is in Burmese, translate it into natural, idiomatic Chinese. Do not add any extra explanations, introductory phrases, or quotation marks. Return only the translated text directly.\n\nText to translate: "${text}"`;
    const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }), });
    if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error.message || 'Gemini API request failed'); }
    const data = await response.json(); return data.candidates[0].content.parts[0].text;
  };

  const handleTranslate = async (text, type, id, forceOriginal = false) => {
    if (forceOriginal) { if (type === 'post') setTranslatedPostContent(null); if (type === 'comment') setTranslatedComments(prev => ({ ...prev, [id]: null })); return; }
    if (!geminiApiKey) { setIsGeminiModalOpen(true); return; }
    setIsTranslating(true);
    try { const translatedText = await callGeminiApi(text, geminiApiKey, geminiModel); if (type === 'post') setTranslatedPostContent(translatedText); if (type === 'comment') setTranslatedComments(prev => ({ ...prev, [id]: translatedText })); } catch (error) { alert(`翻译失败: ${error.message}`); } finally { setIsTranslating(false); }
  };
  
  const handleSaveGeminiSettings = (key, model) => { localStorage.setItem('geminiApiKey', key); localStorage.setItem('geminiModel', model); setGeminiApiKey(key); setGeminiModel(model); alert('设置已保存！'); };
  const voteHandler = async (docRef, type, currentLikes, currentDislikes, isPost = false) => { /* ... (保持不变) ... */ };
  const handlePostVote = (type) => { /* ... (保持不变) ... */ };
  const handleCommentVote = (commentId, type) => { /* ... (保持不变) ... */ };
  const handleDeleteComment = async (commentId) => { /* ... (保持不变) ... */ };
  const handleAddComment = async (e) => { /* ... (保持不变) ... */ };
  const handleReplyClick = (comment) => { /* ... (保持不变) ... */ };
  const handleFollow = async () => { /* ... (保持不变) ... */ };
  const handleBookmark = async () => { /* ... (保持不变) ... */ };
  const handleMenuItemClick = async (action) => { /* ... (保持不变) ... */ };

  if (authLoading || dataLoading) { return <LayoutBase><p className="p-8 text-center text-xl">加载中...</p></LayoutBase>; }
  if (!post) { return <LayoutBase><p className="p-8 text-center text-xl text-red-500">帖子不存在或已被删除。</p></LayoutBase>; }

  const mainComments = comments.filter(comment => !comment.parentId);
  const postIsLiked = user && post.likes.includes(user.uid);
  const isFollowingPostAuthor = user && userData?.following?.includes(post.authorId);
  const isBookmarked = user && userData?.bookmarks?.includes(postId);
  const postContentToShow = translatedPostContent || post.content;

  return (
    <LayoutBase>
      <GeminiSettingsModal isOpen={isGeminiModalOpen} onClose={() => setIsGeminiModalOpen(false)} onSave={handleSaveGeminiSettings} currentKey={geminiApiKey} currentModel={geminiModel} />
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
                <div className="relative"><button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><i className="fas fa-ellipsis text-xl text-gray-500 dark:text-gray-300"></i></button>{showMenu && <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10 py-1 text-base"><button onClick={() => handleMenuItemClick('gemini')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-brain mr-2 text-lg"></i>Gemini 设置</button>{user && user.uid === post.authorId && (<><button onClick={() => handleMenuItemClick('edit')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-pen-to-square mr-2 text-lg"></i>修改</button><button onClick={() => handleMenuItemClick('delete')} className="flex items-center w-full text-left px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-800 font-semibold"><i className="fas fa-trash mr-2 text-lg"></i>删除</button></>)}<button onClick={() => handleMenuItemClick('share')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-share-nodes mr-2 text-lg"></i>分享</button><button onClick={() => handleMenuItemClick('bookmark')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className={`${isBookmarked ? 'fas' : 'far'} fa-bookmark mr-2 text-lg`}></i>收藏</button><button onClick={() => handleMenuItemClick('report')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-flag mr-2 text-lg"></i>举报</button></div>}</div>
              </div>
            </div>
            <div className="prose dark:prose-invert max-w-none text-lg leading-relaxed mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                {post.content && <PostContent content={postContentToShow} />}
                {translatedPostContent && (<button onClick={() => handleTranslate(post.content, 'post', post.id, true)} className="text-gray-500 text-sm mt-2 hover:underline">查看原文</button>)}
            </div>
            <div className="flex items-center justify-end mt-4 pt-2 space-x-4">
                <button onClick={() => handleTTS(postContentToShow)} title="朗读" className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"><i className="fas fa-volume-high text-xl"></i></button>
                <button onClick={() => handleTranslate(post.content, 'post', post.id)} disabled={isTranslating} title="翻译" className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors disabled:opacity-50"><i className="fas fa-language text-xl"></i></button>
                <button onClick={() => handlePostVote('like')} disabled={!user} className={`flex items-center space-x-1 transition-colors ${postIsLiked ? 'text-red-500' : 'text-gray-400 dark:text-gray-500 hover:text-red-400'} ${!user ? 'opacity-50' : ''}`}><i className={`${postIsLiked ? 'fas' : 'far'} fa-heart text-xl`}></i><span className="font-semibold text-sm">{post.likesCount || 0}</span></button>
                <button onClick={() => handlePostVote('dislike')} disabled={!user} className={`flex items-center space-x-1 transition-colors ${postIsDisliked ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500 hover:text-blue-400'} ${!user ? 'opacity-50' : ''}`}><i className={`${postIsDisliked ? 'fas' : 'far'} fa-thumbs-down text-xl`}></i></button>
            </div>
          </div>
          <div className="mt-8">
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">评论 ({post.commentsCount || 0})</h2><div className="flex items-center space-x-4 text-sm font-semibold"><button onClick={() => setSortOrder('最新')} className={sortOrder === '最新' ? 'text-blue-500' : 'text-gray-500 hover:text-blue-500'}>最新</button><button onClick={() => setSortOrder('最热')} className={sortOrder === '最热' ? 'text-blue-500' : 'text-gray-500 hover:text-blue-500'}>最热</button></div></div>
            {user ? (<form onSubmit={handleAddComment} className="mb-8 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg"><div className="relative"><textarea ref={commentInputRef} value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={replyTo ? `回复 @${replyTo.authorName}...` : "发表你的看法..."} rows="4" className="w-full p-3 text-base border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 resize-y"/><div className="absolute bottom-3 right-3 flex items-center space-x-2">{replyTo && <button type="button" onClick={() => { setReplyTo(null); setNewComment(''); }} className="text-sm text-gray-500 hover:text-red-500 font-semibold">取消回复</button>}<button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-md font-semibold hover:bg-blue-700 transition-colors text-base">发表评论</button></div></div></form>) : (<p className="text-center text-lg text-gray-600 dark:text-gray-400 mb-8 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg">请<Link href="/signin"><a className="text-blue-500 hover:underline">登录</a></Link>后发表评论。</p>)}
            <div className="space-y-6">{mainComments.map(comment => (<CommentItem key={comment.id} comment={comment} allComments={comments} user={user} postAuthorId={post.authorId} handleVote={handleCommentVote} handleDelete={handleDeleteComment} handleReply={handleReplyClick} handleTTS={handleTTS} handleTranslate={handleTranslate} translatedText={translatedComments[comment.id]} isTranslating={isTranslating} />))}</div>
          </div>
        </div>
      </div>
    </LayoutBase>
  );
};

export default PostDetailPage;
