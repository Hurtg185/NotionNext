// functions/api/tts.js
export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    const t = searchParams.get('t'); // 文本
    const v = searchParams.get('v'); // 发音人
    const r = searchParams.get('r'); // 语速

    if (!t) return new Response('Missing text', { status: 400 });

    // 1. 处理默认值
    const finalVoice = v || 'zh-CN-XiaoyouNeural';
    // 如果是中文且没传语速，默认 -20；如果传了则用传的
    const finalRate = r !== null ? r : (finalVoice.startsWith('zh') ? '-20' : '0');

    // 2. 拼凑外部接口地址 (确保参数名 text, voice, rate 与目标接口一致)
    const targetUrl = `https://libretts.is-an.org/api/tts?text=${encodeURIComponent(t)}&voice=${finalVoice}&rate=${finalRate}`;

    try {
        const response = await fetch(targetUrl, {
            cf: {
                cacheEverything: true,
                cacheTtl: 7776000, // 90天
            }
        });

        // 3. 检查原始接口是否真的返回了内容
        if (!response.ok) {
            return new Response('Origin Error', { status: response.status });
        }

        // 4. 关键：创建一个新的 Response，手动设置正确的 Content-Type
        const audioData = await response.arrayBuffer();
        
        return new Response(audioData, {
            headers: {
                'Content-Type': 'audio/mpeg', // 必须强制设为音频格式
                'Cache-Control': 'public, s-maxage=7776000, max-age=2592000',
                'Access-Control-Allow-Origin': '*',
                'cf-cache-status': response.headers.get('cf-cache-status') || 'MISS'
            }
        });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}
