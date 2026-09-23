import { useEffect, useState } from 'react';
import { useT } from '../lib/i18n.ts';
import { getLocalConfig, isServerUp, listLocalModels, preferredModel, setLocalConfig, type LocalConfig } from '../lib/local-model.ts';

type State = 'checking' | 'ok' | 'empty' | 'blocked' | 'offline';

/** Address and model of a local model server, with a connection check that says what to fix. */
export function LocalModelSetup({ onChange }: { onChange?: () => void }) {
  const t = useT();
  const [config, setConfig] = useState<LocalConfig>(getLocalConfig);
  const [models, setModels] = useState<string[]>([]);
  const [state, setState] = useState<State>('checking');

  const save = (next: LocalConfig) => {
    setConfig(next);
    setLocalConfig(next);
    onChange?.();
  };

  const connect = async () => {
    const { url, model } = getLocalConfig();
    setState('checking');
    try {
      const list = await listLocalModels(url);
      setModels(list);
      setState(list.length ? 'ok' : 'empty');
      if (!list.includes(model)) save({ url, model: preferredModel(list) });
    } catch {
      setModels([]);
      setState((await isServerUp(url)) ? 'blocked' : 'offline');
    }
  };

  // Checks once on open; later checks run on "Connect".
  useEffect(() => {
    void connect();
  }, []);

  const hint = {
    checking: t('localChecking'),
    ok: t('localFound', { n: models.length }),
    empty: t('localNone'),
    blocked: t('localBlocked', { origin: location.origin }),
    // On a public page the browser may block localhost before the server is even asked, so both
    // causes look alike; name the origin setting too.
    offline: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? t('localOffline') : t('localOfflineHosted', { origin: location.origin }),
  }[state];

  return (
    <div className="key-field">
      <div className="field">
        <label className="label" htmlFor="local-url">
          {t('localServer')}
        </label>
        <div className="inline-field">
          <input
            id="local-url"
            value={config.url}
            onChange={(e) => save({ ...config, url: e.target.value })}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              void connect();
            }}
            spellCheck={false}
            autoComplete="off"
          />
          <button type="button" className="ghost small" onClick={() => void connect()}>
            {t('localConnect')}
          </button>
        </div>
      </div>
      {models.length > 0 && (
        <label className="field">
          <span className="label">{t('localModelLabel')}</span>
          <select value={config.model} onChange={(e) => save({ ...config, model: e.target.value })}>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className={`hint ${state === 'blocked' || state === 'offline' || state === 'empty' ? 'warn' : ''}`}>{hint}</p>
    </div>
  );
}
