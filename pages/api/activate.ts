import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

// ⚠️ Pages Router 的 Edge Runtime 写法
export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  try {
    const { email, code } = await req.json();

    if (!email || !code) {
        return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }

    const { env } = getRequestContext();
    const db = env.DB;

    // 1. 查激活码
    const codeRecord = await db.prepare('SELECT * FROM ActivationCodes WHERE code = ?').bind(code).first();

    if (!codeRecord) {
      return NextResponse.json({ error: '激活码不存在' }, { status: 404 });
    }
    if (codeRecord.is_used === 1) {
      return NextResponse.json({ error: '该激活码已被使用' }, { status: 409 });
    }

    // 2. 查用户
    const user = await db.prepare('SELECT unlocked_levels FROM Users WHERE email = ?').bind(email).first();
    
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const currentLevels = user.unlocked_levels ? (user.unlocked_levels as string).split(',') : [];
    const newLevel = codeRecord.level as string;

    if (currentLevels.includes(newLevel)) {
       return NextResponse.json({ 
        success: true, 
        level: newLevel, 
        new_unlocked_levels: user.unlocked_levels 
      });
    }

    // 3. 执行更新 (事务)
    currentLevels.push(newLevel);
    const newUnlockedStr = currentLevels.join(',');

    await db.batch([
      db.prepare('UPDATE ActivationCodes SET is_used = 1, used_by = ?, used_at = ? WHERE code = ?')
        .bind(email, Math.floor(Date.now() / 1000), code),
      db.prepare('UPDATE Users SET unlocked_levels = ? WHERE email = ?')
        .bind(newUnlockedStr, email)
    ]);

    return NextResponse.json({
      success: true,
      level: newLevel,
      new_unlocked_levels: newUnlockedStr
    });

  } catch (error) {
    console.error('Activate Error:', error);
    return NextResponse.json({ error: '激活失败' }, { status: 500 });
  }
}
