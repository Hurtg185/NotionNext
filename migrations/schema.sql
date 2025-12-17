-- 用户表
CREATE TABLE IF NOT EXISTS Users (
    email TEXT PRIMARY KEY,
    name TEXT,
    avatar_url TEXT,
    unlocked_levels TEXT DEFAULT '', -- 存 "H1,H2" 这样的字符串
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 激活码表
CREATE TABLE IF NOT EXISTS ActivationCodes (
    code TEXT PRIMARY KEY,
    level TEXT NOT NULL,
    is_used INTEGER DEFAULT 0, -- 0:未使用, 1:已使用
    used_by TEXT,
    used_at INTEGER
);

-- 索引加速查询
CREATE INDEX IF NOT EXISTS idx_code ON ActivationCodes(code);
