// /components/LianXianTi.js - (已修正) 提交后会显示正确答案
import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 连线题组件
 * @param {Array<Object>|string} pairsProp - 配对数据数组或其 JSON 字符串。
 *   格式: [{ id: 1, left: '苹果', right: 'Apple' }, { id: 2, left: '香蕉', right: 'Banana' }]
 * @param {string} question - 题目说明
 */
const LianXianTi = ({ pairs: pairsProp, question = '请将左右两边的词语正确连线：' }) => {
  const [leftItems, setLeftItems] = useState([]);
  const [rightItems, setRightItems] = useState([]);
  const [connections, setConnections] = useState([]); // 存储用户连线 { leftId, rightId }
  const [selectedLeft, setSelectedLeft] = useState(null); // 存储当前选中的左侧项 ID
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [results, setResults] = useState([]); // 存储检查结果 { leftId, rightId, isCorrect }
  const [correctLinesToShow, setCorrectLinesToShow] = useState([]); // 存储提交后需要显示的正确答案连线

  const containerRef = useRef(null);
  const itemRefs = useRef(new Map());
  const [lineCoordinates, setLineCoordinates] = useState([]);

  // --- Prop 解析和数据初始化 ---
  useEffect(() => {
    let initialPairs = [];
    if (typeof pairsProp === 'string') {
      try { initialPairs = JSON.parse(pairsProp); } catch (e) { console.error("Error parsing pairs JSON string:", e); initialPairs = []; }
    } else if (Array.isArray(pairsProp)) { initialPairs = pairsProp; }

    if (!initialPairs || initialPairs.length === 0) return;

    // 左侧保持原顺序，右侧打乱
    setLeftItems(initialPairs.map(p => ({ id: p.id, text: p.left })));
    setRightItems([...initialPairs.map(p => ({ id: p.id, text: p.right }))].sort(() => Math.random() - 0.5));

    // 重置所有状态
    setConnections([]);
    setSelectedLeft(null);
    setIsSubmitted(false);
    setResults([]);
    setCorrectLinesToShow([]);
  }, [pairsProp]);

  // --- 连线坐标计算 ---
  const updateLineCoordinates = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // 合并用户连线和需要显示的正确答案连线
    const allLines = isSubmitted ? [...results, ...correctLinesToShow] : connections;
    // 去重，防止同一条线被渲染两次
    const uniqueLines = Array.from(new Map(allLines.map(line => [`${line.leftId}-${line.rightId}`, line])).values());

    const newCoordinates = uniqueLines.map(({ leftId, rightId }) => {
      const leftNode = itemRefs.current.get(`left-${leftId}`);
      const rightNode = itemRefs.current.get(`right-${rightId}`);
      if (!leftNode || !rightNode) return null;

      const leftRect = leftNode.getBoundingClientRect();
      const rightRect = rightNode.getBoundingClientRect();

      return {
        key: `${leftId}-${rightId}`,
        leftId,
        rightId,
        x1: leftRect.right - containerRect.left,
        y1: leftRect.top + leftRect.height / 2 - containerRect.top,
        x2: rightRect.left - containerRect.left,
        y2: rightRect.top + rightRect.height / 2 - containerRect.top,
      };
    }).filter(Boolean);
    setLineCoordinates(newCoordinates);
  }, [connections, isSubmitted, results, correctLinesToShow]);

  useEffect(() => {
    updateLineCoordinates();
    window.addEventListener('resize', updateLineCoordinates);
    return () => window.removeEventListener('resize', updateLineCoordinates);
  }, [updateLineCoordinates]);
  
  // --- 交互逻辑 ---
  const handleLeftClick = (id) => {
    if (isSubmitted) return;
    setSelectedLeft(id);
  };

  const handleRightClick = (id) => {
    if (isSubmitted || !selectedLeft) return;

    const newConnections = connections
      .filter(c => c.rightId !== id && c.leftId !== selectedLeft)
      .concat({ leftId: selectedLeft, rightId: id });

    setConnections(newConnections);
    setSelectedLeft(null);
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
    const checkResults = connections.map(({ leftId, rightId }) => ({
      leftId,
      rightId,
      isCorrect: leftId === rightId,
    }));
    setResults(checkResults);
    
    // 找出所有正确的答案
    const allCorrectPairs = leftItems.map(item => ({ leftId: item.id, rightId: item.id }));
    // 找出用户答对的答案
    const userCorrectPairs = checkResults.filter(r => r.isCorrect);
    // 找出用户没答对的正确答案，这些是需要额外显示的
    const missedCorrectPairs = allCorrectPairs.filter(
      correctPair => !userCorrectPairs.some(userPair => userPair.leftId === correctPair.leftId)
    );
    setCorrectLinesToShow(missedCorrectPairs);
  };

  const handleReset = () => {
    setRightItems(prev => [...prev].sort(() => Math.random() - 0.5));
    setConnections([]);
    setSelectedLeft(null);
    setIsSubmitted(false);
    setResults([]);
    setCorrectLinesToShow([]);
  };

  // --- 动态样式 ---
  const getItemClass = (item, column) => {
    let classes = 'flex items-center justify-center p-3 m-2 border-2 rounded-lg cursor-pointer transition-all duration-200 text-lg font-medium select-none ';
    
    if (isSubmitted) {
      const result = results.find(r => (column === 'left' ? r.leftId : r.rightId) === item.id);
      if (result) {
        classes += result.isCorrect ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900 dark:text-red-300';
      } else {
         const missedConnection = correctLinesToShow.some(c => (column === 'left' ? c.leftId : c.rightId) === item.id);
         if (missedConnection) {
             classes += 'bg-gray-100 border-gray-400 text-gray-600 dark:bg-gray-800 dark:border-gray-500 dark:text-gray-400';
         } else {
            classes += 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400';
         }
      }
      return classes;
    }
    
    if (column === 'left' && selectedLeft === item.id) {
      classes += 'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900 dark:text-blue-300 ring-2 ring-blue-500 ring-offset-2 scale-105';
    } else if (connections.some(c => (column === 'left' ? c.leftId : c.rightId) === item.id)) {
      classes += 'bg-gray-200 border-gray-400 text-gray-800 dark:bg-gray-700 dark:border-gray-500';
    } else {
      classes += 'bg-white border-gray-300 text-gray-800 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 hover:border-primary hover:text-primary';
    }

    return classes;
  };
  
  return (
    <div className="max-w-4xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2xl border border-stroke dark:border-dark-3">
      <h3 className="text-2xl font-bold text-dark-DEFAULT dark:text-gray-1 mb-6 text-center">{question}</h3>

      <div ref={containerRef} className="relative w-full">
        <div className="flex justify-between">
          {/* 左侧栏 */}
          <div className="w-2/5 flex flex-col space-y-2">
            {leftItems.map(item => (
              <div
                key={`left-${item.id}`}
                ref={node => itemRefs.current.set(`left-${item.id}`, node)}
                onClick={() => handleLeftClick(item.id)}
                className={getItemClass(item, 'left')}
              >
                {item.text}
              </div>
            ))}
          </div>

          {/* 右侧栏 */}
          <div className="w-2/5 flex flex-col space-y-2">
            {rightItems.map(item => (
              <div
                key={`right-${item.id}`}
                ref={node => itemRefs.current.set(`right-${item.id}`, node)}
                onClick={() => handleRightClick(item.id)}
                className={getItemClass(item, 'right')}
              >
                {item.text}
              </div>
            ))}
          </div>
        </div>

        {/* SVG 连线层 */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          <defs>
              <marker id="arrowhead-correct" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" className="fill-green-500" />
              </marker>
              <marker id="arrowhead-incorrect" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" className="fill-red-500" />
              </marker>
              <marker id="arrowhead-default" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" className="fill-gray-500 dark:fill-gray-400" />
              </marker>
          </defs>
          {lineCoordinates.map(({ key, leftId, rightId, x1, y1, x2, y2 }) => {
              let lineClass = 'stroke-gray-500 dark:stroke-gray-400';
              let markerEnd = 'url(#arrowhead-default)';
              
              if (isSubmitted) {
                const result = results.find(r => r.leftId === leftId && r.rightId === rightId);
                const isMissedCorrect = correctLinesToShow.some(c => c.leftId === leftId && c.rightId === rightId);
                
                if (result) { // 用户连接的线
                    if(result.isCorrect) {
                        lineClass = 'stroke-green-500';
                        markerEnd = 'url(#arrowhead-correct)';
                    } else {
                        lineClass = 'stroke-red-500';
                        markerEnd = 'url(#arrowhead-incorrect)';
                    }
                } else if (isMissedCorrect) { // 系统补充的正确答案线
                    lineClass = 'stroke-gray-400 stroke-dashed'; // 使用虚线
                    markerEnd = 'url(#arrowhead-default)';
                } else {
                    return null; // 不渲染任何其他线
                }

              }
              
              return (
                  <line
                      key={key}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      className={`${lineClass} transition-all duration-300`}
                      strokeWidth="2.5"
                      markerEnd={markerEnd}
                      strokeDasharray={lineClass.includes('stroke-dashed') ? "5, 5" : "none"} // 应用虚线样式
                  />
              );
          })}
        </svg>
      </div>

      <div className="mt-8 flex justify-center space-x-4">
        {!isSubmitted ? (
          <button onClick={handleSubmit} className="px-8 py-3 bg-primary text-white font-medium rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200">
            检查答案
          </button>
        ) : (
          <button onClick={handleReset} className="px-8 py-3 bg-dark-6 text-white font-medium rounded-lg shadow-md hover:bg-dark-5 focus:outline-none focus:ring-2 focus:ring-dark-7 focus:ring-offset-2 transition-colors duration-200">
            再试一次
          </button>
        )}
      </div>
    </div>
  );
};

export default LianXianTi;
