// functions/api/tts.js
export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    const t = searchParams.get('t'); // 文本
    const v = searchParams.get('v'); // 发音人
    const r = searchParams.get('r'); // 语速

    if (!t) return new Response('Missing text', { status: 400 });

    // 1. 逻辑：处理默认语速和发音人
    const voice = v || 'zh-CN-XiaoyouNeural';
    // 中文默认 -20，其他默认 0
    let rate = r;
    if (rate === null || rate === undefined || rate === 'undefined') {
        rate = voice.startsWith('zh') ? '-20' : '0';
    }

    // 2. 构造目标接口 URL
    const targetUrl = `https://libretts.is-an.org/api/tts?text=${encodeURIComponent(t)}&voice=${voice}&rate=${rate}`;

    try {
        const response = await fetch(targetUrl, {
            cf: {
                cacheEverything: true,
                cacheTtl: 7776000, // 90天
            }
        });

        if (!response.ok) {
            return new Response('TTS Origin Error', { status: response.status });
        }

        // 3. 关键修复：使用流式传输，并强制指定 Content-Type
        const { readable, writable } = new TransformStream();
        response.body.pipeTo(writable);

        return new Response(readable, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'public, s-maxage=7776000, max-age=2592000',
                'Access-Control-Allow-Origin': '*',
                'X-Debug-URL': targetUrl, // 调试用：看最终请求的地址
                'X-Debug-Rate': rate      // 调试用：看最终语速
            }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
