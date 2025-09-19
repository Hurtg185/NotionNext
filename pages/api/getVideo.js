// pages/api/getVideo.js (最终修复版，处理 HTTP -> HTTPS 转换)

const API_URLS = [
    // 优先使用 HTTPS 源，如果它们稳定的话
    'https://api.vvhan.com/api/girl',
    'https://api.vvhan.com/api/video',
    'https://api.vvhan.com/api/dongman',
    'https://v2.xxapi.cn/api/meinv?return=302', // 注意这个 API 可能有自身问题
    'https://api.jkyai.top/API/jxhssp.php',
    'https://api.jkyai.top/API/jxbssp.php',
    'https://api.jkyai.top/API/rmtmsp/api.php',
    'https://api.jkyai.top/API/qcndxl.php',
    'https://www.hhlqilongzhu.cn/api/MP4_xiaojiejie.php',
    // 其次尝试 HTTP 源，并进行强制 HTTPS 转换
    'http://api.xingchenfu.xyz/API/hssp.php',
    'http://api.xingchenfu.xyz/API/wmsc.php',
    'http://api.xingchenfu.xyz/API/tianmei.php', // 你截图中的 API
    'http://api.xingchenfu.xyz/API/cdxl.php',
    'http://api.xingchenfu.xyz/API/yzxl.php',
    'http://api.xingchenfu.xyz/API/rwsp.php',
    'http://api.xingchenfu.xyz/API/nvgao.php',
    'http://api.xingchenfu.xyz/API/nvda.php',
    'http://api.xingchenfu.xyz/API/ndym.php',
    'http://api.xingchenfu.xyz/API/bsxl.php',
    'http://api.xingchenfu.xyz/API/zzxjj.php',
    'http://api.xingchenfu.xyz/API/qttj.php',
    'http://api.xingchenfu.xyz/API/xqtj.php',
    'http://api.xingchenfu.xyz/API/sktj.php',
    'http://api.xingchenfu.xyz/API/cossp.php',
    'http://api.xingchenfu.xyz/API/xiaohulu.php',
    'http://api.xingchenfu.xyz/API/manhuay.php',
    'http://api.xingchenfu.xyz/API/bianzhuang.php',
    'http://api.xingchenfu.xyz/API/jk.php',
];

const fetchWithTimeout = (url, options, timeout = 8000) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('请求超时')), timeout)
        )
    ]);
};

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const shuffledApis = [...API_URLS].sort(() => 0.5 - Math.random());

    for (const apiUrl of shuffledApis) {
        try {
            console.log(`[Server] 尝试请求 API: ${apiUrl}`);
            
            const response = await fetchWithTimeout(apiUrl, {
                method: 'GET',
                redirect: 'manual', // 不自动处理重定向
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
                }
            });

            let finalVideoUrl = null;

            // 检查是否是重定向
            if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
                finalVideoUrl = response.headers.get('location');
            } else if (response.ok && response.url && (response.url.includes('.mp4') || response.url.includes('.m3u8'))) {
                // 直接返回的视频 URL
                finalVideoUrl = response.url;
            }

            if (finalVideoUrl) {
                // 【核心修复】强制将 HTTP 链接转换为 HTTPS
                if (finalVideoUrl.startsWith('http://')) {
                    const httpsVideoUrl = finalVideoUrl.replace('http://', 'https://');
                    // 尝试验证 HTTPS 链接是否可用，或者直接返回
                    // 这里我们直接返回 HTTPS 链接，因为很多 CDN 会同时支持 HTTP 和 HTTPS
                    console.log(`[Server] 转换 HTTP -> HTTPS: ${finalVideoUrl} -> ${httpsVideoUrl}`);
                    return res.status(200).json({ videoUrl: httpsVideoUrl });
                } else if (finalVideoUrl.startsWith('https://')) {
                    console.log(`[Server] 成功获取 HTTPS 视频 URL: ${finalVideoUrl}`);
                    return res.status(200).json({ videoUrl: finalVideoUrl });
                }
            }
            
            console.warn(`[Server] API ${apiUrl} 未返回有效的重定向或视频链接。状态码: ${response.status}`);

        } catch (error) {
            console.warn(`[Server] 请求 API ${apiUrl} 失败:`, error.message);
        }
    }

    console.error("[Server] 所有 API 都获取视频失败");
    return res.status(500).json({ error: '所有视频源都加载失败，请稍后重试' });
}
