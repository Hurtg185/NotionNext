// src/types/quiz.ts

// 定义题型枚举，目前只包含单选和多选
export type QuizType = 'DanXuan' | 'DuoXuan';
export type QuizMode = 'answer' | 'review';

// 选项接口
export interface Option {
  id: string; // 例如 'A', 'B', 'C', 'D' (大写字母)
  text: string;
}

// 题干内容接口
export interface QuestionContent {
  text: string; // 题目内容
  imageUrl: null; // 不支持图片
  audioUrl: null; // 不支持音频
}

// 基础题目接口，所有题型共有的属性
export interface BaseQuizItem {
  id: string; // 题目唯一ID，映射到 Notion 的“题目ID”(Title属性，纯数字字符串，全局唯一)
  question: QuestionContent; // 题干内容，映射到 Notion 的“题目名称”(Text属性)
  analysis?: string; // 答案解析，可选 (原 explanation)
}

// 带有选项的题目类型的基础接口 (单选和多选会继承这个)
export interface QuizItemWithOptions extends BaseQuizItem {
  options: Option[]; // 选项列表
}

// 独有的单选题数据接口
export interface DanXuanQuizData extends QuizItemWithOptions {
  type: 'DanXuan';
  correctAnswer: string; // 正确答案的选项ID (例如 'B')
  correctAnswers?: never; // 明确不允许有多选题的正确答案数组
}

// 独有的多选题数据接口
export interface DuoXuanQuizData extends QuizItemWithOptions {
  type: 'DuoXuan';
  correctAnswers: string[]; // 正确答案的选项ID数组 (例如 ['A', 'C'])
  correctAnswer?: never; // 明确不允许有单选题的正确答案字符串
}

// 联合类型，表示可以是任一类型的题目数据
export type AnyQuizData = DanXuanQuizData | DuoXuanQuizData;

// 单选表单数据类型
export interface DanXuanFormFields {
  selectedOption: string;
}

// 多选表单数据类型
export interface DuoXuanFormFields {
  selectedOptions: string[];
}

// 用户提交的答案类型
export type UserAnswer = string | string[] | null;
