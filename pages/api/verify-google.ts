import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

// ⚠️ Pages Router 的 Edge Runtime 写法
export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: '缺少 Token' }, { status: 400 });
    }

    // 1. 验证 Google Token
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    const googleData = await googleRes.json();

    if (googleData.error || !googleData.email) {
      return NextResponse.json({ error: '无效的 Token' }, { status: 401 });
    }

    // 2. 获取数据库
    const { env } = getRequestContext();
    const db = env.DB; 

    const { email, name, picture } = googleData;

    // 3. 查库或注册
    const existingUser = await db.prepare('SELECT * FROM Users WHERE email = ?').bind(email).first();

    if (existingUser) {
      return NextResponse.json(existingUser);
    } else {
      await db.prepare(
        'INSERT INTO Users (email, name, avatar_url, unlocked_levels) VALUES (?, ?, ?, ?)'
      ).bind(email, name, picture, '').run();

      return NextResponse.json({
        email,
        name,
        avatar_url: picture,
        unlocked_levels: ''
      });
    }

  } catch (error) {
    console.error('Auth Error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
