import { useEffect, useState, type FormEvent } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { AuthAlert, PasswordField, PasswordGuide, TextField } from '../components/auth/AuthFields';
import { AuthShell } from '../components/auth/AuthShell';
import { consumeReturnPath, hasReturnPath } from '../utils/authRedirect';
import { NAME_MAX, validateEmail, validateName, validateNewPassword } from '../utils/authValidation';

interface Touched { name?: boolean; email?: boolean; password?: boolean; confirmPassword?: boolean; }
type Field = keyof Touched;

const FIELD_ORDER: Field[] = ['name', 'email', 'password', 'confirmPassword'];
const FIELD_IDS: Record<Field, string> = {
  name: 'signup-name', email: 'signup-email', password: 'signup-password', confirmPassword: 'signup-confirm',
};

const Signup = () => {
  const { signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Touched>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Redirect once signup() has finished (see Login for why it waits).
  useEffect(() => {
    if (isAuthenticated && !submitting) navigate(consumeReturnPath(location.state), { replace: true });
  }, [isAuthenticated, submitting, navigate, location.state]);

  const errors: Record<Field, string | undefined> = {
    name: validateName(name),
    email: validateEmail(email),
    password: validateNewPassword(password, email),
    confirmPassword: !confirmPassword ? 'Please confirm your password.' : confirmPassword !== password ? 'Passwords do not match.' : undefined,
  };
  const shown = (field: Field) => (touched[field] ? errors[field] : undefined);
  const touch = (field: Field) => setTouched(prev => ({ ...prev, [field]: true }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched({ name: true, email: true, password: true, confirmPassword: true });
    setServerError('');

    const firstInvalid = FIELD_ORDER.find(field => errors[field]);
    if (firstInvalid) {
      document.getElementById(FIELD_IDS[firstInvalid])?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await signup(name.trim(), email.trim(), password);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      scene="maasai-mara"
      title="Create your free account"
      lede={hasReturnPath(location.state)
        ? 'Create a free account and we will take you straight back.'
        : 'Save places, species and trip plans in one private workspace.'}
      benefits={['Favorite species and destinations', 'Trip plans from the AI guide', 'Budgets for your trips']}
      footer={<>Already have an account? <Link to="/login" state={location.state}>Sign in</Link></>}
    >
      <Form onSubmit={handleSubmit} noValidate>
        <TextField
          id={FIELD_IDS.name}
          label="Full name"
          value={name}
          onChange={event => setName(event.target.value)}
          onBlur={() => touch('name')}
          error={shown('name')}
          maxLength={NAME_MAX}
          autoComplete="name"
          autoFocus
        />
        <TextField
          id={FIELD_IDS.email}
          label="Email"
          type="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
          onBlur={() => touch('email')}
          error={shown('email')}
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
        />
        <PasswordField
          id={FIELD_IDS.password}
          label="Password"
          className="mb-1"
          value={password}
          onChange={event => setPassword(event.target.value)}
          onBlur={() => touch('password')}
          error={shown('password')}
          autoComplete="new-password"
          visible={showPassword}
          onToggleVisible={() => setShowPassword(prev => !prev)}
          describedByExtra="signup-password-guide"
        />
        <PasswordGuide id="signup-password-guide" password={password} email={email} />

        <PasswordField
          id={FIELD_IDS.confirmPassword}
          label="Confirm password"
          className="mb-4 mt-3"
          value={confirmPassword}
          onChange={event => setConfirmPassword(event.target.value)}
          onBlur={() => touch('confirmPassword')}
          error={shown('confirmPassword')}
          autoComplete="new-password"
          visible={showPassword}
        />

        <AuthAlert message={serverError} />

        <Button type="submit" disabled={submitting} className="btn-solar w-100 justify-content-center">
          {submitting && <Spinner animation="border" size="sm" aria-hidden="true" />}
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </Form>
    </AuthShell>
  );
};

export default Signup;
