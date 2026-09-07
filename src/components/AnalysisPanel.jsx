import { useEffect, useMemo, useRef, useState } from 'react';

const STATUS_TO_CODE = {
  Ready: 'IDLE',
  Thinking: 'RUN',
  Complete: 'DONE',
  Fallback: 'SAFE',
};

const escapeWord = (word) => JSON.stringify(word);
const trimLine = (line) => line.replace(/\s+/g, ' ').trim();

export default function AnalysisPanel({ visible, status, lines, sourceWords }) {
  const [typedLine, setTypedLine] = useState('');
  const [revealedLines, setRevealedLines] = useState([]);
  const logRef = useRef(null);
  const latestLine = lines.at(-1) || '';
  const statusCode = STATUS_TO_CODE[status] || 'LOG';

  const runtimeBase = useMemo(() => {
    const wordsLiteral = `[${sourceWords.slice(0, 6).map(escapeWord).join(', ')}${sourceWords.length > 6 ? ', ...' : ''}]`;
    return [
      'const endpoint = "/api/semantic-map-stream";',
      `const words = ${wordsLiteral};`,
      'const request = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ words }) };',
      'const response = await fetch(endpoint, request);',
      'const reader = response.body.getReader();',
      'while (true) {',
      '  const { done, value } = await reader.read();',
      '  if (done) break;',
      '  const event = JSON.parse(decode(value));',
      '  switch (event.type) {',
    ];
  }, [sourceWords]);

  useEffect(() => {
    if (!visible) {
      setRevealedLines([]);
      setTypedLine('');
      return;
    }

    setRevealedLines(runtimeBase);
    setTypedLine('');
  }, [runtimeBase, visible]);

  useEffect(() => {
    if (!visible || !latestLine) {
      return undefined;
    }

    const normalized = trimLine(latestLine);
    let nextSnippet = [];

    if (normalized.toLowerCase().includes('preparing')) {
      nextSnippet = [
        '    case "status":',
        '      pushTrace(event.message); break;',
      ];
    } else if (normalized.toLowerCase().includes('reading semantic cues')) {
      nextSnippet = [
        '    case "thinking":',
        '      pushTrace(event.message); break;',
      ];
    } else if (normalized.includes('偏向') || normalized.includes(' / ')) {
      nextSnippet = [
        '    case "note":',
        '      pushTrace(event.message); break;',
      ];
    } else if (normalized.toLowerCase().includes('completed semantic mapping')) {
      nextSnippet = [
        '    case "done":',
        '      setGenerationComplete(true); break;',
        '  }',
        '}',
        `// status: ${statusCode}`,
      ];
    } else if (normalized.toLowerCase().includes('falling back')) {
      nextSnippet = [
        '    case "fallback":',
        '      setWords(createWordItems(words)); break;',
        `// status: ${statusCode}`,
      ];
    } else {
      nextSnippet = [
        '    case "item":',
        '      setWords(progressiveItems.concat(event.item)); break;',
      ];
    }

    setRevealedLines((current) => {
      const seen = new Set(current);
      const additions = nextSnippet.filter((line) => !seen.has(line));
      return additions.length > 0 ? [...current, ...additions] : current;
    });

    setTypedLine('');
    let frame = 0;
    const intervalId = window.setInterval(() => {
      frame += 1;
      setTypedLine(normalized.slice(0, frame));
      if (frame >= normalized.length) {
        window.clearInterval(intervalId);
      }
    }, 16);

    return () => window.clearInterval(intervalId);
  }, [latestLine, statusCode, visible]);

  useEffect(() => {
    if (!visible || !logRef.current) {
      return;
    }

    const element = logRef.current;
    element.scrollTop = element.scrollHeight;
  }, [revealedLines, typedLine, visible]);

  return (
    <section className="analysis-panel analysis-panel-sidebar">
      <div className="analysis-head">
        <span>Runtime Code</span>
        <span className="analysis-status">{visible ? statusCode : 'IDLE'}</span>
      </div>
      <div ref={logRef} className="analysis-log">
        <div className="analysis-log-head">
          <span>PIPELINE.RUN</span>
          <span>{visible ? statusCode : 'IDLE'}</span>
        </div>

        {revealedLines.map((line, index) => (
          <div key={`${index}-${line}`} className="analysis-line">
            <span className="analysis-line-number">{String(index + 1).padStart(2, '0')}</span>
            <span className="analysis-line-content">{line}</span>
          </div>
        ))}

        {visible ? (
          <div className="analysis-line typing">
            <span className="analysis-line-number">{String(revealedLines.length + 1).padStart(2, '0')}</span>
            <span className="analysis-line-content">
              {`// trace : ${typedLine}`}
              <span className="typing-caret" />
            </span>
          </div>
        ) : (
          <div className="analysis-line analysis-line-placeholder">
            <span className="analysis-line-number">--</span>
            <span className="analysis-line-content">await user.trigger("generate")</span>
          </div>
        )}

        <div className="analysis-footnote">
          <span>events</span>
          <span>{String(visible ? lines.length : 0).padStart(2, '0')}</span>
        </div>
      </div>
    </section>
  );
}
