// src/components/DanXuanTi.tsx

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';
import { HiCheckCircle, HiXCircle, HiVolumeUp } from 'react-icons/hi';
import { DanXuanQuizData, DanXuanFormFields, UserAnswer } from '../types/quiz';
import { speakText, getPinyin, checkAnswerCorrectness } from '../utils/quizUtils';

// Zod schema for single choice form validation
const danXuanSchema = z.object({
  selectedOption: z.string().min(1, '请选择一个答案'),
});

interface DanXuanTiProps {
  quizData: DanXuanQuizData;
  onAnswerSubmit: (quizId: string, selectedAnswer: string, isCorrect: boolean) => void;
  isReviewMode?: boolean;
  userAnswer?: UserAnswer;
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

const DanXuanTi: React.FC<DanXuanTiProps> = ({
  quizData,
  onAnswerSubmit,
  isReviewMode = false,
  userAnswer = null,
}) => {
  const { control, handleSubmit, formState: { errors, isValid }, watch, setValue } = useForm<DanXuanFormFields>({
    resolver: zodResolver(danXuanSchema),
    defaultValues: {
      selectedOption: (isReviewMode && typeof userAnswer === 'string') ? userAnswer : '',
    },
    mode: 'onChange',
  });

  const [isSubmitted, setIsSubmitted] = useState(isReviewMode);
  const [showPinyin, setShowPinyin] = useState(false);
  const [isCorrectFeedback, setIsCorrectFeedback] = useState<boolean | null>(null);

  const selectedOption = watch('selectedOption');

  useEffect(() => {
    setIsSubmitted(isReviewMode);
    setShowPinyin(false);

    if (isReviewMode && typeof userAnswer === 'string') {
      setValue('selectedOption', userAnswer);
    } else if (!isReviewMode) {
      setValue('selectedOption', '');
    }

    if (isReviewMode && quizData.correctAnswer) {
      const correct = checkAnswerCorrectness(quizData.type, userAnswer || '', quizData.correctAnswer);
      setIsCorrectFeedback(correct);
    } else {
      setIsCorrectFeedback(null);
    }
  }, [quizData.id, isReviewMode, userAnswer, setValue, quizData.correctAnswer, quizData.type]);

  useEffect(() => {
    return () => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, [quizData.id]);

  const onSubmit = (data: DanXuanFormFields) => {
    if (isReviewMode) return;
    const { selectedOption } = data;
    const isCorrect = checkAnswerCorrectness(quizData.type, selectedOption, quizData.correctAnswer);
    setIsCorrectFeedback(isCorrect);
    setIsSubmitted(true);
    onAnswerSubmit(quizData.id, selectedOption, isCorrect);
  };

  const getOptionClassName = (optionId: string) => {
    let className = 'flex items-center p-3 border rounded-lg cursor-pointer transition-colors duration-200 ease-in-out';
    const isUserCurrentlySelected = selectedOption === optionId;
    const isUserAnsweredInReview = isReviewMode && typeof userAnswer === 'string' && userAnswer === optionId;

    if (isReviewMode) {
      if (optionId === quizData.correctAnswer) {
        className += ' bg-green-100 border-green-500 text-green-700';
      } else if (isUserAnsweredInReview && optionId !== quizData.correctAnswer) {
        className += ' bg-red-100 border-red-500 text-red-700';
      } else if (isUserAnsweredInReview) {
        className += ' bg-blue-50 border-blue-500 text-blue-700';
      } else {
        className += ' border-gray-300 hover:border-blue-400';
      }
    } else {
      if (isUserCurrentlySelected) {
        className += ' bg-blue-50 border-blue-500 text-blue-700';
      } else if (isSubmitted && optionId === quizData.correctAnswer) {
        className += ' bg-green-100 border-green-500 text-green-700';
      } else if (isSubmitted && isUserCurrentlySelected && selectedOption !== quizData.correctAnswer) {
        className += ' bg-red-100 border-red-500 text-red-700';
      } else {
        className += ' border-gray-300 hover:border-blue-400';
      }
    }
    return className;
  };

  const getFeedbackIcon = (optionId: string) => {
    if (!isSubmitted && !isReviewMode) return null;
    const isUserCurrentlySelected = selectedOption === optionId;
    const isUserAnsweredInReview = isReviewMode && typeof userAnswer === 'string' && userAnswer === optionId;

    if (isReviewMode) {
      if (optionId === quizData.correctAnswer) {
        return <HiCheckCircle className="ml-2 text-green-500 text-xl" />;
      } else if (isUserAnsweredInReview && optionId !== quizData.correctAnswer) {
        return <HiXCircle className="ml-2 text-red-500 text-xl" />;
      }
    } else if (isSubmitted) {
      if (optionId === quizData.correctAnswer) {
        return <HiCheckCircle className="ml-2 text-green-500 text-xl" />;
      } else if (isUserCurrentlySelected && optionId !== quizData.correctAnswer) {
        return <HiXCircle className="ml-2 text-red-500 text-xl" />;
      }
    }
    return null;
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.05,
          },
        },
      }}
      className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-lg space-y-6"
    >
      <motion.h2 variants={itemVariants} className="text-2xl font-semibold text-gray-800 flex items-center">
        {quizData.question.text}
        <HiVolumeUp className="ml-2 text-gray-500 hover:text-blue-500 cursor-pointer text-xl" onClick={() => speakText(quizData.question.text)} />
      </motion.h2>

      <motion.div variants={itemVariants} className="space-y-2">
        <div className="flex items-center text-lg text-gray-700">
          <p className="flex-grow">{quizData.question.text}</p>
          <HiVolumeUp className="ml-2 text-gray-500 hover:text-blue-500 cursor-pointer text-xl" onClick={() => speakText(quizData.question.text)} />
        </div>
        <button
          onClick={() => setShowPinyin(!showPinyin)}
          className="text-blue-600 hover:text-blue-800 text-sm focus:outline-none"
        >
          {showPinyin ? '隐藏拼音' : '显示拼音'}
        </button>
        {showPinyin && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="text-gray-500 text-sm mt-1 pinyin-text"
          >
            {getPinyin(quizData.question.text)}
          </motion.p>
        )}
      </motion.div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <motion.div
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.07,
              },
            },
          }}
          className="space-y-3"
        >
          {quizData.options.map((option) => (
            <motion.label
              key={option.id}
              variants={itemVariants}
              className={getOptionClassName(option.id)}
            >
              <Controller
                name="selectedOption"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="radio"
                    value={option.id}
                    checked={field.value === option.id}
                    onChange={(e) => {
                      if (!isSubmitted && !isReviewMode) {
                        field.onChange(e);
                      }
                    }}
                    className="mr-3 text-blue-600 focus:ring-blue-500"
                    disabled={isSubmitted || isReviewMode}
                  />
                )}
              />
              <span className="flex-grow">{`${option.id}. ${option.text}`}</span>
              <HiVolumeUp className="ml-2 text-gray-400 hover:text-blue-500 cursor-pointer text-lg" onClick={(e) => { e.stopPropagation(); speakText(option.text); }} />
              {getFeedbackIcon(option.id)}
            </motion.label>
          ))}
        </motion.div>

        {!isReviewMode && !isSubmitted && (
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full py-3 px-4 rounded-lg text-white font-semibold transition-colors duration-200
              ${isValid ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
            disabled={!isValid || isSubmitted}
          >
            提交答案
          </motion.button>
        )}

        {isSubmitted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-6 p-4 rounded-lg text-center"
          >
            {isCorrectFeedback !== null && (
              <p className={`text-lg font-bold ${isCorrectFeedback ? 'text-green-600' : 'text-red-600'}`}>
                {isCorrectFeedback ? '回答正确！' : '回答错误。'}
              </p>
            )}
            {quizData.analysis && (
              <div className="mt-4 text-gray-700 text-sm bg-gray-50 p-3 rounded-md border border-gray-200">
                <h4 className="font-semibold mb-1 flex items-center">
                  答案解析
                  <HiVolumeUp className="ml-2 text-gray-500 hover:text-blue-500 cursor-pointer text-lg" onClick={() => speakText(quizData.analysis || '')} />
                </h4>
                <p>{quizData.analysis}</p>
              </div>
            )}
          </motion.div>
        )}
      </form>
    </motion.div>
  );
};

export default DanXuanTi;
