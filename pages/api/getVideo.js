// pages/api/getVideo.js (最终修复版 - 手动处理重定向)

// API 端点数组 (把你所有想用的 API 都放在这里)
const API_URLS = [
    'http://api.xingchenfu.xyz/API/tianmei.php',
    'http://api.xingchenfu.xyz/API/hssp.php',
    'http://api.xingchenfu.xyz/API/wmsc.php',
    'http://api.xingchenfu.xyz/API/ommn.php',
    'http://api.xingchenfu.xyz/API/cdxl.php',
    'http://api.xingchenfu.xyz/API/yzxl.php',
    'http://api.xingchenfu.xyz/API/rwsp.php',
    'http://api.xingchenfu.xyz/API/nvgao.php',
    'http://api.xingchenfu.xyz/API/nvda.php',
    'http://api.xingchenfu.xyz/API/ndym.php',
    'http://api.xingchenfu.xyz/API/bsxl.php',
    'http://api.xingchenfu.xyz/API/zzxjj.php',
    'http://api.xingchenfu.xyz/API/jk.php',
    // 也可以加上其他备用 API
    'https://api.vvhan.com/api/girl', 
];

// 请求超时函数
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
            
            // 【核心修复】设置 redirect: 'manual'
            const response = await fetchWithTimeout(apiUrl, {
                method: 'GET',
                redirect: 'manual', // <--- 关键！告诉 fetch 不要自动处理重定向
                headers: {
                    // 模拟浏览器 User-Agent，提高成功率
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
                }
            });

            // 检查响应头中的 'Location' 字段
            // 301, 302, 307, 308 都是重定向状态码
            if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
                const videoUrl = response.headers.get('location');
                
                // 确保获取到的 URL 是有效的
                if (videoUrl && (videoUrl.startsWith('http://') || videoUrl.startsWith('https://'))) {
                    console.log(`[Server] 成功从 Location 头获取视频 URL: ${videoUrl}`);
                    return res.status(200).json({ videoUrl: videoUrl });
                }
            } else if (response.ok && response.url.includes('.mp4')) {
                // 这是为了兼容那些直接返回最终 URL 的 API (比如 vvhan)
                console.log(`[Server] 成功获取直接视频 URL: ${response.url}`);
                return res.status(200).json({ videoUrl: response.url });
            }

            console.warn(`[Server] API ${apiUrl} 未返回有效的重定向或视频链接。状态码: ${response.status}`);

        } catch (error) {
            console.warn(`[Server] 请求 API ${apiUrl} 失败:`, error.message);
        }
    }

    // 如果所有 API 都失败了
    console.error("[Server] 所有 API 都获取视频失败");
    return res.status(500).json({ error: '所有视频源都加载失败，请稍后重试' });
}
