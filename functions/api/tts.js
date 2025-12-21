// functions/api/tts.js
export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    const text = searchParams.get('t'); 
    const voice = searchParams.get('v');
    const rate = searchParams.get('r');

    if (!text) return new Response('Missing text', { status: 400 });

    // 默认值设置
    // 如果是中文发音人且没传语速，默认设为 -20
    let finalRate = rate || (voice && voice.startsWith('zh') ? '-20' : '0');
    let finalVoice = voice || 'zh-CN-XiaoyouNeural';

    // 拼凑目标 URL
    const targetUrl = `https://libretts.is-an.org/api/tts?text=${encodeURIComponent(text)}&voice=${finalVoice}&rate=${finalRate}`;

    const response = await fetch(targetUrl, {
        cf: {
            cacheEverything: true,
            cacheTtl: 7776000, // 缓存 90 天
        }
    });

    if (!response.ok) return new Response('TTS Origin Error', { status: response.status });

    const newResponse = new Response(response.body, response);
    
    // 强缓存头
    newResponse.headers.set('Cache-Control', 'public, s-maxage=7776000, max-age=2592000');
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    
    return newResponse;
}
