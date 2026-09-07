export default function ControlPanel({
  mode,
  onModeChange,
  inputValue,
  onInputChange,
  corpus,
  selectedStoryId,
  onStoryChange,
  selectedStory,
  selectedCorpusWords,
  onToggleCorpusWord,
  onSelectAllCorpusWords,
  onClearCorpusWords,
  onGenerate,
  onConnect,
  connectDisabled,
  generateDisabled,
}) {
  return (
    <section className="control-panel">
      <div className="title-block">
        <h1 className="site-title">
          <span className="site-title-accent">inter</span>
          <span className="site-title-main">小径分岔的花园 / 语义空间</span>
        </h1>
        <p className="subtitle">将词语映射到三维语义结构中。</p>
      </div>

      <div className="mode-switch" role="tablist" aria-label="输入模式切换">
        <button
          type="button"
          className={`mode-switch__button ${mode === 'free' ? 'is-active' : ''}`}
          onClick={() => onModeChange('free')}
        >
          自由模式
        </button>
        <button
          type="button"
          className={`mode-switch__button ${mode === 'novel' ? 'is-active' : ''}`}
          onClick={() => onModeChange('novel')}
        >
          小说模式
        </button>
      </div>

      <div className="section-block">
        <p className="section-label">
          {mode === 'free' ? '+ Word Input / 词语输入' : '+ Corpus Selection / 语料选择'}
        </p>

        {mode === 'free' ? (
          <textarea
            id="word-input"
            rows={9}
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder={'镜子\n目录\nmirror\nmaze'}
          />
        ) : (
          <div className="novel-mode">
            <label className="field-label" htmlFor="story-select">
              选择篇目
            </label>
            <select
              id="story-select"
              className="story-select"
              value={selectedStoryId}
              onChange={(event) => onStoryChange(event.target.value)}
            >
              <option value="">请选择篇目</option>
              {corpus.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.id}｜{entry.titleCn}
                </option>
              ))}
            </select>

            <div className="corpus-meta">
              <span className="field-label">选择词语</span>
              <div className="corpus-actions">
                <button
                  type="button"
                  className="micro-action"
                  onClick={onSelectAllCorpusWords}
                  disabled={!selectedStory}
                >
                  全选
                </button>
                <button
                  type="button"
                  className="micro-action"
                  onClick={onClearCorpusWords}
                  disabled={selectedCorpusWords.length === 0}
                >
                  清空
                </button>
              </div>
            </div>

            <div className="corpus-tags">
              {selectedStory ? (
                selectedStory.words.map((word) => {
                  const active = selectedCorpusWords.includes(word);
                  return (
                    <button
                      key={word}
                      type="button"
                      className={`corpus-tag ${active ? 'is-active' : ''}`}
                      onClick={() => onToggleCorpusWord(word)}
                    >
                      {word}
                    </button>
                  );
                })
              ) : (
                <div className="corpus-empty">选择一篇小说后，此处会加载该篇的词语列表。</div>
              )}
            </div>
          </div>
        )}

        <div className="action-row">
          <button
            type="button"
            className="primary generate-button"
            onClick={() => onGenerate(inputValue)}
            disabled={generateDisabled}
          >
            Generate
          </button>
          <button
            type="button"
            className="connect-button"
            onClick={onConnect}
            disabled={connectDisabled}
          >
            Connect
          </button>
        </div>
      </div>
    </section>
  );
}
