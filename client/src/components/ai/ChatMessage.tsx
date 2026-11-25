import { Check, Copy, RotateCcw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import Markdown from './Markdown';
import { notify } from '../../utils/notifications';
import type { ChatMessage as Message } from '../../services/assistantApi';

interface Props {
  message: Message;
  streaming?: boolean;
  onRetry?: () => void;
  onFeedback?: (rating: -1 | 1) => void;
}

const ChatMessage = ({ message, streaming, onRetry, onFeedback }: Props) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
    } catch {
      // Clipboard API can be blocked (non-HTTPS, permissions); fall back to a hidden textarea.
      const area = document.createElement('textarea');
      area.value = message.content;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      if (!ok) { notify('Could not copy. Select the text and copy it manually.', 'error'); return; }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  const thinking = streaming && message.role === 'assistant' && !message.content;
  return (
    <article className={`chat-message chat-message--${message.role}`}>
      <div className="chat-message__role">{message.role === 'user' ? 'You' : 'WorldSphere'}</div>
      <div className="chat-message__content">
        {thinking
          ? <span className="chat-thinking" role="status"><span /><span /><span /><span className="visually-hidden">WorldSphere is thinking</span></span>
          : <Markdown>{message.content}</Markdown>}
        {streaming && !thinking && <span className="ai-caret" />}
      </div>
      {message.role === 'assistant' && !streaming && (
        <div className="chat-message__actions">
          <button onClick={copy} aria-label={copied ? 'Copied' : 'Copy response'} title="Copy response">{copied ? <Check size={15} /> : <Copy size={15} />}</button>
          {onRetry && <button onClick={onRetry} aria-label="Retry response"><RotateCcw size={15} /></button>}
          {message.id && onFeedback && <><button onClick={() => onFeedback(1)} aria-label="Helpful response"><ThumbsUp size={15} /></button><button onClick={() => onFeedback(-1)} aria-label="Unhelpful response"><ThumbsDown size={15} /></button></>}
        </div>
      )}
    </article>
  );
};

export default ChatMessage;
