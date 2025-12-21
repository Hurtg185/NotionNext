// functions/api/tts.js
export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    const t = searchParams.get('t'); // 文本
    const v = searchParams.get('v'); // 发音人
    const r = searchParams.get('r'); // 语速

    if (!t) return new Response('Missing text', { status: 400 });

    // 1. 处理默认值
    const voice = v || 'zh-CN-XiaoyouNeural';
    let rate = r;
    // 如果是中文发音人且没传语速，默认设为 -20
    if (!rate || rate === 'undefined') {
        rate = voice.startsWith('zh') ? '-20' : '0';
    }

    // 2. 构造原始接口请求
    // 注意：这里我们必须用 POST，因为那个 libretts 接口只认 JSON POST
    const targetUrl = `https://libretts.is-an.org/api/tts`;
    
    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: t,
                voice: voice,
                rate: parseInt(rate),
                pitch: 0
            }),
            // 告诉 Cloudflare 即使后台是 POST，也要缓存这个 GET 请求的结果
            cf: {
                cacheEverything: true,
                cacheTtl: 7776000,
            }
        });

        if (!response.ok) {
            return new Response(`Origin Error: ${response.status}`, { status: 500 });
        }

        // 3. 获取音频二进制数据
        const audioBuffer = await response.arrayBuffer();

        // 4. 检查数据是否为空
        if (audioBuffer.byteLength === 0) {
            return new Response('Empty Audio Data', { status: 500 });
        }

        // 5. 返回给浏览器，并注入强缓存标头
        return new Response(audioBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'public, s-maxage=7776000, max-age=2592000',
                'Access-Control-Allow-Origin': '*',
                'X-Debug-Status': 'Success',
                'X-Debug-Size': audioBuffer.byteLength.toString()
            }
        });

    } catch (e) {
        return new Response(`Worker Error: ${e.message}`, { status: 500 });
    }
}
