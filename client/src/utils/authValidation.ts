/**
 * Client-side mirrors of the server's signup rules (server/app/auth.py).
 * The server is authoritative; these exist to give instant, specific feedback.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const NAME_MAX = 100;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

// Keep in sync with COMMON_PASSWORDS in server/app/auth.py.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword', 'pa$$word',
  '12345678', '123456789', '1234567890', '11111111', '00000000', '87654321', '987654321', '123123123',
  'qwerty123', 'qwertyui', 'qwertyuiop', '1q2w3e4r', '1q2w3e4r5t', 'zaq12wsx', 'qazwsx123', 'abc12345', 'abcd1234',
  'iloveyou', 'iloveyou1', 'admin123', 'administrator', 'welcome1', 'welcome123', 'letmein123', 'trustno1',
  'monkey123', 'dragon123', 'football1', 'baseball1', 'superman1', 'sunshine1', 'princess1', 'whatever1',
  'changeme', 'changeme123', 'worldsphere', 'wildsphere', 'kenya2024', 'kenya2025', 'nairobi123',
]);

export const isCommonPassword = (password: string) => COMMON_PASSWORDS.has(password.toLowerCase());

export const validateEmail = (email: string): string | undefined => {
  const value = email.trim();
  if (!value) return 'Email is required.';
  if (value.length > 254 || !EMAIL_PATTERN.test(value)) return 'Enter a valid email address, like name@example.com.';
  return undefined;
};

export const validateName = (name: string): string | undefined => {
  const value = name.trim();
  if (!value) return 'Name is required.';
  if (value.length > NAME_MAX) return `Use ${NAME_MAX} characters or fewer.`;
  return undefined;
};

export const validateNewPassword = (password: string, email = ''): string | undefined => {
  if (!password) return 'Password is required.';
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use ${PASSWORD_MAX} characters or fewer.`;
  if (isCommonPassword(password)) return 'That password is too common. Choose something harder to guess.';
  if (email.trim() && password.toLowerCase() === email.trim().toLowerCase()) return "Your password can't be the same as your email.";
  return undefined;
};

export interface PasswordRule { id: string; label: string; required: boolean; met: boolean; }

export const getPasswordRules = (password: string, email = ''): PasswordRule[] => [
  { id: 'length', label: `At least ${PASSWORD_MIN} characters`, required: true, met: password.length >= PASSWORD_MIN },
  {
    id: 'common',
    label: 'Not a commonly used password or your email',
    required: true,
    met: password.length > 0 && !isCommonPassword(password) && password.toLowerCase() !== email.trim().toLowerCase(),
  },
  {
    id: 'mix',
    label: 'A mix of letters, numbers and symbols (recommended)',
    required: false,
    met: /[a-z]/i.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password),
  },
];

export type StrengthLevel = 0 | 1 | 2 | 3;
export interface PasswordStrength { level: StrengthLevel; label: string; }

export const getPasswordStrength = (password: string): PasswordStrength => {
  if (!password) return { level: 0, label: '' };
  if (isCommonPassword(password)) return { level: 1, label: 'Weak' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return { level: 1, label: 'Weak' };
  if (score === 3) return { level: 2, label: 'Fair' };
  return { level: 3, label: 'Strong' };
};
