// functions/api/tts.js
export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    const text = searchParams.get('t'); // 对应你的 t 参数
    const voice = searchParams.get('v') || 'zh-CN-XiaoyouNeural'; // 对应你的 v 参数

    if (!text) {
        return new Response('Missing text', { status: 400 });
    }

    // 你的原始接口地址
    const targetUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;

    // 使用 Cloudflare 的 fetch 抓取音频
    const response = await fetch(targetUrl, {
        // 这里的 cf 配置确保 Cloudflare 尝试缓存此请求
        cf: {
            cacheEverything: true,
            cacheTtl: 7776000, // 边缘缓存 90 天 (单位：秒)
        }
    });

    // 如果接口报错，直接返回
    if (!response.ok) {
        return new Response('TTS Origin Error', { status: response.status });
    }

    // 创建新的响应，注入缓存控制头
    const newResponse = new Response(response.body, response);
    
    // 设置缓存策略
    // s-maxage=7776000: Cloudflare 节点缓存 90 天
    // max-age=6592000: 用户浏览器缓存 30 天
    newResponse.headers.set('Cache-Control', 'public, s-maxage=7776000, max-age=6592000');
    
    // 允许跨域（确保所有组件都能调用）
    newResponse.headers.set('Access-Control-Allow-Origin', '*');

    return newResponse;
}
