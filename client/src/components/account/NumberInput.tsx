import { useState, type ChangeEvent, type FocusEvent, type InputHTMLAttributes } from 'react';
import { fromMinorUnits, toBoundedInt, toMinorUnits } from '../../utils/numberInput';

interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max' | 'step'> {
  /** Stored value: a whole number, or minor units when `money` is set. */
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Treat the field as a currency amount (2 decimals, stored as minor units). */
  money?: boolean;
}

/**
 * A number field that lets people clear it and retype without the value
 * snapping back, and never reports NaN to the parent. The visible text is
 * tidied on blur.
 */
const NumberInput = ({ value, onValueChange, min = 0, max = 1_000_000_000, money = false, onBlur, ...rest }: NumberInputProps) => {
  const format = (v: number) => (money ? fromMinorUnits(v) : String(v));
  const [text, setText] = useState(() => format(value));

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setText(raw);
    if (money) {
      onValueChange(Math.min(max * 100, toMinorUnits(raw)));
    } else {
      onValueChange(toBoundedInt(raw, min, max));
    }
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    setText(format(value));
    onBlur?.(event);
  };

  return (
    <input
      {...rest}
      type="number"
      inputMode={money ? 'decimal' : 'numeric'}
      min={min}
      max={max}
      step={money ? '0.01' : 1}
      placeholder={money ? '0' : rest.placeholder}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};

export default NumberInput;
