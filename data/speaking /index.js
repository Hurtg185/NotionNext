// 1. 引入您所有的口语数据文件
// 请根据您实际的文件名添加或修改
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

// 2. 将它们导出为一个总对象
// 键名 (key) 必须对应您 speaking-structure.js 里写的 "file" 字段
export const SPEAKING_DATA_MAP = {
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
