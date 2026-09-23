import { useMemo, useState } from 'react';
import { parseDataset, type Dataset, type StoryEvent } from '../../shared/dataset.ts';
import { makeValueFormatter } from '../engine/format.ts';
import { useT } from '../lib/i18n.ts';

const hex6 = (c: string) => (/^#[0-9a-f]{3}$/i.test(c) ? `#${[...c.slice(1)].map((x) => x + x).join('')}` : c);

export function DataPanel({ dataset: ds, setDataset }: { dataset: Dataset; setDataset: (fn: (d: Dataset) => Dataset) => void }) {
  const t = useT();
  const [json, setJson] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const fmt = useMemo(() => makeValueFormatter(ds), [ds]);

  const setSeries = (i: number, patch: Partial<Dataset['series'][number]>) =>
    setDataset((d) => ({ ...d, series: d.series.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));
  const setEvent = (i: number, patch: Partial<StoryEvent>) =>
    setDataset((d) => ({ ...d, events: d.events.map((e, k) => (k === i ? { ...e, ...patch } : e)) }));
  const removeEvent = (i: number) => setDataset((d) => ({ ...d, events: d.events.filter((_, k) => k !== i) }));
  const addEvent = () =>
    setDataset((d) => ({
      ...d,
      events: [...d.events, { t: d.timeline[d.timeline.length - 1], icon: '💡', title: t('newEvent'), text: '' }],
    }));

  return (
    <div className="stack">
      <label className="field">
        <span className="label">{t('title')}</span>
        <input value={ds.title} onChange={(e) => setDataset((d) => ({ ...d, title: e.target.value }))} />
      </label>
      <label className="field">
        <span className="label">{t('subtitle')}</span>
        <input value={ds.subtitle} onChange={(e) => setDataset((d) => ({ ...d, subtitle: e.target.value }))} />
      </label>

      <h3>
        {t('series')} <span className="count">{ds.series.length}</span>
      </h3>
      <ul className="series-list">
        {ds.series.map((s, i) => {
          const peak = Math.max(0, ...s.values.map((v) => v ?? 0));
          return (
            <li key={s.id}>
              <input
                type="color"
                value={hex6(s.color)}
                onChange={(e) => setSeries(i, { color: e.target.value })}
                aria-label={t('colorOf', { name: s.name })}
              />
              <input
                className="emoji-input"
                value={s.icon}
                onChange={(e) => setSeries(i, { icon: e.target.value })}
                aria-label={t('iconOf', { name: s.name })}
              />
              <input value={s.name} onChange={(e) => setSeries(i, { name: e.target.value })} aria-label={t('name')} />
              <span className="peak">{fmt(peak)}</span>
            </li>
          );
        })}
      </ul>

      <h3>
        {t('events')} <span className="count">{ds.events.length}</span>
      </h3>
      <ul className="event-list">
        {ds.events.map((e, i) => (
          <li key={i}>
            <div className="event-row">
              <input
                type="number"
                step={0.1}
                className="year-input"
                defaultValue={e.t}
                onBlur={(ev) => {
                  const t = Number(ev.target.value);
                  if (Number.isFinite(t)) setEvent(i, { t });
                }}
                aria-label={t('eventTime')}
              />
              <input className="emoji-input" value={e.icon} onChange={(ev) => setEvent(i, { icon: ev.target.value })} aria-label={t('icon')} />
              <input value={e.title} onChange={(ev) => setEvent(i, { title: ev.target.value })} aria-label={t('headline')} />
              <button type="button" className="icon-btn" onClick={() => removeEvent(i)} aria-label={t('removeEvent')}>
                ✕
              </button>
            </div>
            <textarea rows={2} value={e.text} onChange={(ev) => setEvent(i, { text: ev.target.value })} aria-label={t('text')} />
          </li>
        ))}
      </ul>
      <button type="button" className="ghost" onClick={addEvent}>
        {t('addEvent')}
      </button>

      <h3>{t('sources')}</h3>
      <ul className="sources">
        {ds.sources.map((s, i) => (
          <li key={i}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.title || s.url}
            </a>
          </li>
        ))}
      </ul>
      {ds.notes && <p className="notes">{ds.notes}</p>}

      <details
        className="json-editor"
        onToggle={(e) => {
          if (e.currentTarget.open) {
            setJson(JSON.stringify(ds, null, 2));
            setJsonError(null);
          }
        }}
      >
        <summary>{t('editJson')}</summary>
        <textarea
          className="json"
          rows={18}
          spellCheck={false}
          value={json ?? ''}
          onChange={(e) => setJson(e.target.value)}
        />
        <button
          type="button"
          className="primary"
          onClick={() => {
            try {
              const next = parseDataset(JSON.parse(json ?? ''));
              setDataset(() => next);
              setJsonError(null);
            } catch (err) {
              setJsonError((err as Error).message);
            }
          }}
        >
          {t('apply')}
        </button>
        {jsonError && <p className="error">{jsonError}</p>}
      </details>
    </div>
  );
}
