// functions/api/translate.js

// ============================================================
// 核心翻译提示词模板
// ============================================================
const TRANSLATION_PROMPT_TEMPLATE = `你是【中缅双语高保真翻译引擎】。

【总原则】
- 忠实原文，不增不减
- 不解释、不推测、不扩写
- 回译必须严格翻回源语言

【语言要求】
- 缅甸语：现代日常口语
- 中文：自然口语
- 不使用俚语、流行语
- 不添加敬语

【翻译任务】
源语言：{SOURCE_LANG}
目标语言：{TARGET_LANG}

原文：
"{USER_TEXT}"

【输出格式】

【① 原结构直译】
翻译：
<<<T1>>>
回译：
<<<B1>>>

【② 自然直译（推荐）】
翻译：
<<<T2>>>
回译：
<<<B2>>>

【③ 顺语直译】
翻译：
<<<T3>>>
回译：
<<<B3>>>

【④ 口语版】
翻译：
<<<T4>>>
回译：
<<<B4>>>

【⑤ 自然意译】
翻译：
<<<T5>>>
回译：
<<<B5>>>`;

// ============================================================
// 常量定义（复用以提升性能）
// ============================================================
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const STREAM_DELIMITER = "\n|||FINAL_JSON|||\n";
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 翻译类型配置
const TRANSLATION_TYPES = Object.freeze([
  { id: 'raw-direct', label: '原结构直译', tTag: 'T1', bTag: 'B1', recommended: false },
  { id: 'natural-direct', label: '自然直译', tTag: 'T2', bTag: 'B2', recommended: true },
  { id: 'fluent-direct', label: '顺语直译', tTag: 'T3', bTag: 'B3', recommended: false },
  { id: 'spoken', label: '口语版', tTag: 'T4', bTag: 'B4', recommended: false },
  { id: 'free', label: '自然意译', tTag: 'T5', bTag: 'B5', recommended: false },
]);

// ============================================================
// 工具函数
// ============================================================

/**
 * 创建 JSON 响应
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}

/**
 * 创建错误响应
 */
function errorResponse(message, status = 500, details = null) {
  const body = { error: message, success: false };
  if (details) body.details = details;
  return jsonResponse(body, status);
}

/**
 * 输入文本清洗和验证
 * - 移除潜在的注入内容
 * - 标准化换行符
 * - 限制长度
 */
function sanitizeInput(text, maxLength = 10000) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .slice(0, maxLength)                    // 限制长度
    .replace(/\r\n/g, '\n')                 // 标准化换行
    .replace(/\r/g, '\n')
    .replace(/<<<[TB]\d>>>/g, '')           // 移除可能干扰解析的标签
    .replace(/\|\|\|FINAL_JSON\|\|\|/g, '') // 移除分隔符注入
    .trim();
}

/**
 * 安全转义用于嵌入提示词的文本
 */
function escapeForPrompt(text) {
  return text
    .replace(/\\/g, '\\\\')  // 先转义反斜杠
    .replace(/"/g, '\\"');   // 再转义双引号
}

/**
 * [增强版] AI 结果解析器
 * - 支持多种边界情况
 * - 容错处理
 * - 性能优化
 */
function parseAIOutput(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // 预编译正则表达式（性能优化）
  const tagPatterns = new Map();
  
  const extract = (tag) => {
    // 使用缓存的正则表达式
    if (!tagPatterns.has(tag)) {
      // 匹配标签后的内容，直到遇到下一个标签或文本结束
      // 支持：<<<T1>>> 内容 <<<B1>>> 或 <<<T1>>> 内容 <<<T2>>>
      tagPatterns.set(tag, new RegExp(
        `<<<${tag}>>>\\s*([\\s\\S]*?)(?=<<<[TB][1-5]>>>|【[①②③④⑤]|$)`,
        'm'
      ));
    }
    
    const regex = tagPatterns.get(tag);
    const match = text.match(regex);
    
    if (!match?.[1]) return '';
    
    // 清理提取的内容
    return match[1]
      .replace(/^[\s\n]+|[\s\n]+$/g, '')  // 去除首尾空白
      .replace(/翻译：\s*$/m, '')          // 移除残留的标签
      .replace(/回译：\s*$/m, '')
      .trim();
  };

  const results = [];
  
  for (const type of TRANSLATION_TYPES) {
    const translation = extract(type.tTag);
    const back = extract(type.bTag);
    
    // 只添加有翻译内容的结果
    if (translation) {
      results.push({
        id: type.id,
        label: type.label,
        translation,
        back,
        recommended: type.recommended,
      });
    }
  }

  return results;
}

/**
 * 从 SSE 行中提取内容
 */
function extractSSEContent(line) {
  if (!line.startsWith('data: ')) return null;
  if (line.includes('[DONE]')) return null;
  
  try {
    const json = JSON.parse(line.slice(6));
    return json.choices?.[0]?.delta?.content || null;
  } catch {
    return null;
  }
}

// ============================================================
// 主处理函数
// ============================================================

/**
 * 处理 OPTIONS 请求（CORS 预检）
 */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * 处理 POST 请求
 */
export async function onRequestPost(context) {
  const startTime = Date.now();
  
  try {
    // ==================== 1. 解析和验证请求 ====================
    let requestBody;
    try {
      requestBody = await context.request.json();
    } catch {
      return errorResponse('Invalid JSON in request body', 400);
    }

    const { text, sourceLang, targetLang, customConfig } = requestBody;

    // 验证必填字段
    if (!text) {
      return errorResponse('Text is required', 400);
    }

    // 清洗输入
    const sanitizedText = sanitizeInput(text);
    if (!sanitizedText) {
      return errorResponse('Text is empty after sanitization', 400);
    }

    // ==================== 2. 配置 API ====================
    const apiKey = customConfig?.apiKey || context.env?.IFLOW_API_KEY;
    if (!apiKey) {
      return errorResponse('API Key is missing. Please configure IFLOW_API_KEY.', 401);
    }

    const apiUrl = (customConfig?.apiUrl || 'https://apis.iflow.cn/v1').replace(/\/+$/, '');
    const model = customConfig?.model || 'deepseek-v3.2';
    const timeout = customConfig?.timeout || 60000; // 60秒超时

    // ==================== 3. 构建提示词 ====================
    const finalPrompt = TRANSLATION_PROMPT_TEMPLATE
      .replace('{SOURCE_LANG}', sourceLang || 'auto')
      .replace('{TARGET_LANG}', targetLang || '中文')
      .replace('{USER_TEXT}', escapeForPrompt(sanitizedText));

    // ==================== 4. 调用外部 API ====================
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let apiResponse;
    try {
      apiResponse = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: '你是专业的中缅双语翻译引擎，严格按照格式输出。'
            },
            {
              role: 'user',
              content: finalPrompt
            }
          ],
          stream: true,
          temperature: 0.3,      // 降低温度提高准确性
          max_tokens: 4096,      // 确保足够的输出空间
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return errorResponse('Request timeout', 504);
      }
      return errorResponse('Failed to connect to translation API', 502, fetchError.message);
    }

    clearTimeout(timeoutId);

    if (!apiResponse.ok) {
      let errorDetail = '';
      try {
        const errorBody = await apiResponse.text();
        errorDetail = errorBody.slice(0, 500);
      } catch {}
      
      return errorResponse(
        `External API returned ${apiResponse.status}`,
        apiResponse.status >= 500 ? 502 : apiResponse.status,
        errorDetail
      );
    }

    // ==================== 5. 流式处理响应 ====================
    let fullResponseText = '';
    let streamState = {
      t2Started: false,
      t2Ended: false,
    };

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const chunkText = TEXT_DECODER.decode(chunk, { stream: true });
        const lines = chunkText.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          const content = extractSSEContent(trimmedLine);
          if (content === null) continue;
          
          fullResponseText += content;
          
          // ========== 智能流式发送推荐译文 (T2) ==========
          if (!streamState.t2Started) {
            // 检测 T2 开始
            if (fullResponseText.includes('<<<T2>>>')) {
              streamState.t2Started = true;
              // 提取 T2 标签后已有的内容
              const t2Index = fullResponseText.indexOf('<<<T2>>>');
              const afterT2 = fullResponseText.slice(t2Index + 8);
              if (afterT2 && !afterT2.includes('<<<B2>>>')) {
                const cleanContent = afterT2.replace(/<<<[TB]\d>>>/g, '');
                if (cleanContent) {
                  controller.enqueue(TEXT_ENCODER.encode(cleanContent));
                }
              }
            }
          } else if (!streamState.t2Ended) {
            // T2 已开始，继续流式输出直到 B2
            if (content.includes('<<<B2>>>') || fullResponseText.includes('<<<B2>>>')) {
              streamState.t2Ended = true;
              // 输出 B2 标签之前的剩余内容
              const cleanContent = content.split('<<<B2>>>')[0].replace(/<<<[TB]\d>>>/g, '');
              if (cleanContent) {
                controller.enqueue(TEXT_ENCODER.encode(cleanContent));
              }
            } else {
              // 清理并输出内容
              const cleanContent = content.replace(/<<<[TB]\d>>>/g, '');
              if (cleanContent) {
                controller.enqueue(TEXT_ENCODER.encode(cleanContent));
              }
            }
          }
        }
      },
      
      flush(controller) {
        // 流结束，解析完整结果并发送
        const parsedData = parseAIOutput(fullResponseText);
        
        const finalPayload = {
          success: true,
          parsed: parsedData,
          quick_replies: generateQuickReplies(parsedData), // 使用补全后的函数
          meta: {
            processingTime: Date.now() - startTime,
            model,
            sourceLength: sanitizedText.length,
          },
        };
        
        controller.enqueue(TEXT_ENCODER.encode(STREAM_DELIMITER));
        controller.enqueue(TEXT_ENCODER.encode(JSON.stringify(finalPayload)));
      },
    });

    // ==================== 6. 返回流式响应 ====================
    return new Response(apiResponse.body.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Processing-Start': startTime.toString(),
        'Cache-Control': 'no-cache',
        ...CORS_HEADERS,
      },
    });

  } catch (error) {
    console.error('[Translate API Error]', error);
    return errorResponse(
      'Internal Server Error',
      500,
      process.env.NODE_ENV === 'development' ? error.stack : undefined
    );
  }
}

/**
 * 补全：生成快速回复建议
 * (目前简单返回空数组，未来可以扩展逻辑)
 */
function generateQuickReplies(parsedData) {
  return []; 
}
