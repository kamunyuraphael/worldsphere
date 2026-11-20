import type { InputHTMLAttributes } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { FiCheck, FiCircle, FiEye, FiEyeOff } from 'react-icons/fi';
import { getPasswordRules, getPasswordStrength } from '../../utils/authValidation';
import './auth.css';

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'id' | 'value' | 'defaultValue'> & { value?: string };

interface FieldProps extends InputProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
}

const describedBy = (id: string, error?: string, hint?: string, extra?: string) =>
  [hint ? `${id}-hint` : '', error ? `${id}-error` : '', extra ?? ''].filter(Boolean).join(' ') || undefined;

/** Labelled text input whose error and hint text are programmatically linked to the control. */
export const TextField = ({ id, label, error, hint, className = 'mb-3', ...input }: FieldProps) => (
  <div className={`auth-field ${className}`}>
    <Form.Label htmlFor={id} className="auth-label">{label}</Form.Label>
    <Form.Control id={id} isInvalid={!!error} aria-invalid={!!error} aria-describedby={describedBy(id, error, hint)} {...input} />
    {hint && <div id={`${id}-hint`} className="auth-hint">{hint}</div>}
    <Form.Control.Feedback type="invalid" id={`${id}-error`}>{error}</Form.Control.Feedback>
  </div>
);

interface PasswordFieldProps extends Omit<FieldProps, 'type'> {
  visible: boolean;
  /** Omit to render the field without its own show/hide button. */
  onToggleVisible?: () => void;
  /** Extra element ids (e.g. a rules list) that describe this field. */
  describedByExtra?: string;
}

/** Password input with a keyboard-reachable show/hide toggle. */
export const PasswordField = ({
  id, label, error, hint, className = 'mb-3', visible, onToggleVisible, describedByExtra, ...input
}: PasswordFieldProps) => (
  <div className={`auth-field ${className}`}>
    <Form.Label htmlFor={id} className="auth-label">{label}</Form.Label>
    <InputGroup hasValidation>
      <Form.Control
        id={id}
        type={visible ? 'text' : 'password'}
        isInvalid={!!error}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, error, hint, describedByExtra)}
        {...input}
      />
      {onToggleVisible && (
        <Button
          variant="outline-secondary"
          type="button"
          className="auth-toggle"
          onClick={onToggleVisible}
          aria-controls={id}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
        </Button>
      )}
      <Form.Control.Feedback type="invalid" id={`${id}-error`}>{error}</Form.Control.Feedback>
    </InputGroup>
    {hint && <div id={`${id}-hint`} className="auth-hint">{hint}</div>}
  </div>
);

/** Always-mounted live region so screen readers announce server errors when they appear. */
export const AuthAlert = ({ message }: { message: string }) => (
  <div className="auth-alert" role="alert">{message}</div>
);

interface PasswordGuideProps { id: string; password: string; email: string; }

/** Strength meter + requirement checklist. State is conveyed with text and icons, not colour alone. */
export const PasswordGuide = ({ id, password, email }: PasswordGuideProps) => {
  const strength = getPasswordStrength(password);
  const rules = getPasswordRules(password, email);
  return (
    <div id={id}>
      {password.length > 0 && (
        <>
          <div
            className="auth-meter"
            data-level={strength.level}
            role="meter"
            aria-label="Password strength"
            aria-valuemin={0}
            aria-valuemax={3}
            aria-valuenow={strength.level}
            aria-valuetext={strength.label}
          >
            {[1, 2, 3].map(step => (
              <span key={step} className={`auth-meter__bar${strength.level >= step ? ' is-on' : ''}`} />
            ))}
          </div>
          <p className="auth-strength" aria-live="polite">Password strength: <strong>{strength.label}</strong></p>
        </>
      )}
      <ul className="auth-checklist" aria-label="Password requirements">
        {rules.map(rule => (
          <li key={rule.id} data-met={rule.met}>
            {rule.met ? <FiCheck aria-hidden="true" /> : <FiCircle aria-hidden="true" />}
            <span>
              {rule.label}
              <span className="visually-hidden">{rule.met ? ' — met' : rule.required ? ' — not met yet' : ' — optional'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
