import { ArrowUp, Paperclip, Square } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

interface Props {
  placeholder: string;
  disabled?: boolean;
  streaming?: boolean;
  initialValue?: string;
  onSend: (value: string) => void;
  onStop: () => void;
}

const ChatInput = ({ placeholder, disabled, streaming, initialValue = '', onSend, onStop }: Props) => {
  const [value, setValue] = useState(initialValue);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  // Grow with the text up to ~6 lines, then scroll.
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight, 144)}px`;
  }, [value]);
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const next = value.trim();
    if (!next || disabled) return;
    setValue('');
    onSend(next);
  };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };
  return (
    <form className="chat-input" onSubmit={submit}>
      <button type="button" className="chat-input__attach" aria-label="Attach a file" title="Upload framework ready; provider processing is not enabled yet"><Paperclip size={18} /></button>
      <textarea ref={areaRef} rows={1} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={keyDown} placeholder={placeholder} aria-label="Message WorldSphere AI" disabled={disabled && !streaming} />
      {streaming
        ? <button type="button" className="chat-input__send" onClick={onStop} aria-label="Stop generating"><Square size={15} fill="currentColor" /></button>
        : <button type="submit" className="chat-input__send" disabled={disabled || !value.trim()} aria-label="Send message"><ArrowUp size={18} /></button>}
    </form>
  );
};

export default ChatInput;
