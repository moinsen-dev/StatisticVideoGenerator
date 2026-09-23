import { useState } from 'react';
import { useT } from '../lib/i18n.ts';
import { getKey, isRemembered, setKey, type KeyName } from '../lib/keys.ts';

/** API key input that saves on every change: for this tab only, or in localStorage with "remember". */
export function KeyField(props: {
  name: KeyName;
  label: string;
  createUrl: string;
  hint: string;
  placeholder?: string;
  onChange?: () => void;
}) {
  const t = useT();
  const [value, setValue] = useState(() => getKey(props.name));
  const [remember, setRemember] = useState(() => isRemembered(props.name) || !getKey(props.name));
  const save = (key: string, keep: boolean) => {
    setKey(props.name, key, keep);
    props.onChange?.();
  };

  return (
    <div className="key-field">
      <label className="field">
        <span className="label">
          {props.label}
          <a href={props.createUrl} target="_blank" rel="noreferrer">
            {t('keyCreate')} ↗
          </a>
        </span>
        <input
          type="password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            save(e.target.value, remember);
          }}
          placeholder={props.placeholder}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => {
            setRemember(e.target.checked);
            save(value, e.target.checked);
          }}
        />
        {t('keyRemember')}
      </label>
      <p className="hint">{props.hint}</p>
    </div>
  );
}
