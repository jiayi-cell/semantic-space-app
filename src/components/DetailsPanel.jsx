const formatScore = (value) => (value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2));

export default function DetailsPanel({ selected, totalCount, overlay = false }) {
  if (overlay && !selected) {
    return null;
  }

  return (
    <section className={`details-panel ${overlay ? 'details-panel-overlay' : ''}`}>
      {!overlay && (
        <div className="panel-meta">
          <span>Detail / 详情</span>
          <span className="detail-count">{totalCount}</span>
        </div>
      )}

      {selected ? (
        <div className="details-card">
          <h2>{selected.word}</h2>
          {overlay ? (
            <div className="score-stack">
              <p>Entity {formatScore(selected.scores.entity)}</p>
              <p>Medium {formatScore(selected.scores.medium)}</p>
              <p>Stability {formatScore(selected.scores.stability)}</p>
            </div>
          ) : (
            <dl className="score-list compact">
              <div>
                <dt>Entity</dt>
                <dd>{formatScore(selected.scores.entity)}</dd>
              </div>
              <div>
                <dt>Medium</dt>
                <dd>{formatScore(selected.scores.medium)}</dd>
              </div>
              <div>
                <dt>Stability</dt>
                <dd>{formatScore(selected.scores.stability)}</dd>
              </div>
            </dl>
          )}
          <p className="details-explanation">{selected.explanation}</p>
        </div>
      ) : (
        <div className="details-empty">
          <p>点击右侧词语查看其评分与解释。当前映射 {totalCount} 个词。</p>
        </div>
      )}
    </section>
  );
}
