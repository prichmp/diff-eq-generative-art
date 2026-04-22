import { useMemo } from 'react';
import { compileEquation } from '../simulation/compileEquation';
import { InfoTip } from './InfoTip';

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  info?: string;
}

export function EquationInput({ label, value, onChange, info }: Props) {
  const check = useMemo(() => compileEquation(value), [value]);
  const invalid = !check.ok;
  const errorMsg = check.ok ? null : check.error;

  return (
    <label>
      <span>
        {label}
        {info && <InfoTip text={info} />}
      </span>
      <input
        type="text"
        value={value}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        className={invalid ? 'invalid' : ''}
        onChange={(e) => onChange(e.target.value)}
      />
      {errorMsg && <span className="error-text">{errorMsg}</span>}
    </label>
  );
}
