// data/speaking/index.js

// 1. 引入所有数据文件
// 如果您有新文件，请在这里加一行 import
import dazhaohu from './dazhaohu';
import diancan from './diancan';
import chucimian from './chucimian';
import jiubiechongfeng from './jiubiechongfeng';
import guanxinyuhuiying from './guanxinyuhuiying';
import zhaorenshuohua from './zhaorenshuohua';
import dianhuayuxinxi from './dianhuayuxinxi';
import jieshuyugaobie from './jieshuyugaobie';
import yudingzuowei from './yudingzuowei';
import jiezhang from './jiezhang';
import dache from './dache';
import wenlu from './wenlu';

// 2. 导出映射表
// 这里的 Key (左边的名字) 必须对应您 speaking-structure.js 里的 `file` 字段
export const SPEAKING_DATA = {
  dazhaohu,
  diancan,
  chucimian,
  jiubiechongfeng,
  guanxinyuhuiying,
  zhaorenshuohua,
  dianhuayuxinxi,
  jieshuyugaobie,
  yudingzuowei,
  jiezhang,
  dache,
  wenlu
};
