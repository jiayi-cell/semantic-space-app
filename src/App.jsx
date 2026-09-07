import { useEffect, useMemo, useRef, useState } from 'react';
import ControlPanel from './components/ControlPanel.jsx';
import SemanticScene from './components/SemanticScene.jsx';
import DetailsPanel from './components/DetailsPanel.jsx';
import AnalysisPanel from './components/AnalysisPanel.jsx';
import { DEFAULT_WORDS } from './lib/constants.js';
import { borgesCorpus } from './data/borgesCorpus.ts';
import {
  createSemanticItemFromScores,
  mapWordsToSemanticSpace,
  spreadSemanticItems,
} from './lib/semanticMapper.js';

const parseWords = (rawInput) =>
  rawInput
    .split(/[\n,，;；]/)
    .map((word) => word.trim())
    .filter(Boolean);

const createWordItems = (words, seed) =>
  mapWordsToSemanticSpace(words, seed).map((item, index) => ({
    id: `${item.word}-${index}`,
    ...item,
  }));

const createWordItemsFromApi = (items, seed) =>
  spreadSemanticItems(
    items.map((item, index) => ({
      id: `${item.word}-${index}`,
      ...createSemanticItemFromScores(item.word, item.scores, item.explanation, `${seed}-${index}`, item.meta),
    }))
  );

const streamAiSemanticMap = async (words, handlers) => {
  const response = await fetch('/api/semantic-map-stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ words }),
  });

  if (!response.ok) {
    throw new Error(`Semantic map request failed: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Missing response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    lines.forEach((line) => {
      if (!line.trim()) {
        return;
      }
      handlers?.onEvent?.(JSON.parse(line));
    });
  }
};

export default function App() {
  const [mode, setMode] = useState('novel');
  const [inputValue, setInputValue] = useState(DEFAULT_WORDS.join('\n'));
  const [selectedStoryId, setSelectedStoryId] = useState('');
  const [selectedCorpusWords, setSelectedCorpusWords] = useState([]);
  const [seed, setSeed] = useState(1);
  const [sceneResetToken, setSceneResetToken] = useState(0);
  const [words, setWords] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [connectionProgress, setConnectionProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('Ready');
  const [analysisLines, setAnalysisLines] = useState(['Waiting for a new semantic mapping request.']);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [burstIds, setBurstIds] = useState([]);
  const generationRef = useRef(0);
  const connectAnimationRef = useRef(null);

  const selectedWord = useMemo(
    () => words.find((item) => item.id === selectedId) || null,
    [selectedId, words]
  );
  const selectedStory = useMemo(
    () => borgesCorpus.find((entry) => entry.id === selectedStoryId) || null,
    [selectedStoryId]
  );
  const activeSourceWords = useMemo(
    () => (mode === 'novel' ? selectedCorpusWords : parseWords(inputValue)),
    [inputValue, mode, selectedCorpusWords]
  );

  const pushAnalysisLine = (message) => {
    setAnalysisLines((current) => [...current, message].slice(-7));
  };

  const handleGenerate = async (rawInput) => {
    const parsed = mode === 'novel' ? [...selectedCorpusWords] : parseWords(rawInput);
    const generationId = generationRef.current + 1;
    generationRef.current = generationId;
    setSceneResetToken((current) => current + 1);

    if (connectAnimationRef.current) {
      cancelAnimationFrame(connectAnimationRef.current);
      connectAnimationRef.current = null;
    }

    if (parsed.length === 0) {
      setWords([]);
      setSelectedId(null);
      setBurstIds([]);
      setGenerationComplete(false);
      setConnectionProgress(0);
      setAnalysisStatus('Ready');
      setAnalysisLines(['Waiting for a new semantic mapping request.']);
      setAnalysisVisible(false);
      return;
    }

    const nextSeed = seed + 1;
    setSeed(nextSeed);
    setWords([]);
    setSelectedId(null);
    setBurstIds([]);
    setGenerationComplete(false);
    setConnectionProgress(0);
    setAnalysisStatus('Thinking');
    setAnalysisLines(['Preparing semantic mapping...']);
    setAnalysisVisible(true);

    try {
      const progressiveItems = [];
      await streamAiSemanticMap(parsed, {
        onEvent(event) {
          if (generationRef.current !== generationId) {
            return;
          }

          if (event.type === 'status' || event.type === 'thinking' || event.type === 'note' || event.type === 'done') {
            pushAnalysisLine(event.message);
          }

          if (event.type === 'item' && event.item) {
            progressiveItems.push(event.item);
            const nextItems = createWordItemsFromApi(progressiveItems, nextSeed);
            const nextBurstId = nextItems.at(-1)?.id;
            if (nextBurstId) {
              setBurstIds((current) => [...current, nextBurstId]);
              window.setTimeout(() => {
                setBurstIds((current) => current.filter((id) => id !== nextBurstId));
              }, 2550);
            }
            setWords(nextItems);
          }

          if (event.type === 'done') {
            setAnalysisStatus('Complete');
            setGenerationComplete(true);
          }
        },
      });
    } catch (error) {
      if (generationRef.current !== generationId) {
        return;
      }
      pushAnalysisLine('Falling back to heuristic mapping.');
      setWords(createWordItems(parsed, nextSeed));
      setGenerationComplete(true);
      setAnalysisStatus('Fallback');
    }
  };

  useEffect(() => {
    return () => {
      if (connectAnimationRef.current) {
        cancelAnimationFrame(connectAnimationRef.current);
      }
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="sidebar">
        <ControlPanel
          mode={mode}
          onModeChange={(nextMode) => {
            setMode(nextMode);
            setAnalysisVisible(false);
          }}
          inputValue={inputValue}
          onInputChange={setInputValue}
          corpus={borgesCorpus}
          selectedStoryId={selectedStoryId}
          onStoryChange={(storyId) => {
            setSelectedStoryId(storyId);
            setSelectedCorpusWords([]);
          }}
          selectedStory={selectedStory}
          selectedCorpusWords={selectedCorpusWords}
          onToggleCorpusWord={(word) => {
            setSelectedCorpusWords((current) =>
              current.includes(word) ? current.filter((item) => item !== word) : [...current, word]
            );
          }}
          onSelectAllCorpusWords={() => {
            setSelectedCorpusWords(selectedStory ? [...selectedStory.words] : []);
          }}
          onClearCorpusWords={() => setSelectedCorpusWords([])}
          onGenerate={handleGenerate}
          onConnect={() => {
            if (generationComplete && words.length > 1) {
              if (connectAnimationRef.current) {
                cancelAnimationFrame(connectAnimationRef.current);
              }

              setConnectionProgress(0.0001);
              const start = performance.now();
              const duration = 2200;

              const tick = (now) => {
                const progress = Math.min((now - start) / duration, 1);
                setConnectionProgress(progress);
                if (progress < 1) {
                  connectAnimationRef.current = requestAnimationFrame(tick);
                } else {
                  connectAnimationRef.current = null;
                }
              };

              connectAnimationRef.current = requestAnimationFrame(tick);
            }
          }}
          connectDisabled={!generationComplete || words.length < 2}
          generateDisabled={mode === 'novel' && selectedCorpusWords.length === 0}
        />
        <AnalysisPanel
          visible={analysisVisible}
          status={analysisStatus}
          lines={analysisLines}
          sourceWords={activeSourceWords}
        />
      </section>

      <section className="workspace">
        <SemanticScene
          resetToken={sceneResetToken}
          words={words}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onClearSelection={() => setSelectedId(null)}
          burstIds={burstIds}
          connectionProgress={connectionProgress}
        />
      </section>
    </main>
  );
}
