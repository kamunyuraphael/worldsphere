import { useEffect, useState, type FormEvent } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { AuthAlert, PasswordField, TextField } from '../components/auth/AuthFields';
import { AuthShell } from '../components/auth/AuthShell';
import { consumeReturnPath, hasReturnPath } from '../utils/authRedirect';
import { validateEmail } from '../utils/authValidation';

interface Touched { email?: boolean; password?: boolean; }

const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Touched>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // One place decides where signed-in visitors go. It waits for login() to finish so
  // queued favorites/trips are saved before the destination page loads.
  useEffect(() => {
    if (isAuthenticated && !submitting) navigate(consumeReturnPath(location.state), { replace: true });
  }, [isAuthenticated, submitting, navigate, location.state]);

  const errors = {
    email: validateEmail(email),
    password: password ? undefined : 'Password is required.',
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched({ email: true, password: true });
    setServerError('');

    const firstInvalid = (['email', 'password'] as const).find(field => errors[field]);
    if (firstInvalid) {
      document.getElementById(`login-${firstInvalid}`)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not sign in. Check your email and password, then try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      scene="amboseli"
      title="Welcome back"
      lede={hasReturnPath(location.state)
        ? 'Sign in to continue where you left off.'
        : 'Sign in to pick up your saved places, species and trip plans.'}
      footer={<>New to WorldSphere? <Link to="/signup" state={location.state}>Create an account</Link></>}
    >
      <Form onSubmit={handleSubmit} noValidate>
        <TextField
          id="login-email"
          label="Email"
          type="email"
          value={email}
          onChange={event => setEmail(event.target.value)}
          onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
          error={touched.email ? errors.email : undefined}
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
        />
        <PasswordField
          id="login-password"
          label="Password"
          className="mb-4"
          value={password}
          onChange={event => setPassword(event.target.value)}
          onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
          error={touched.password ? errors.password : undefined}
          autoComplete="current-password"
          visible={showPassword}
          onToggleVisible={() => setShowPassword(prev => !prev)}
        />

        <AuthAlert message={serverError} />

        <Button type="submit" disabled={submitting} className="btn-solar w-100 justify-content-center">
          {submitting && <Spinner animation="border" size="sm" aria-hidden="true" />}
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </Form>
    </AuthShell>
  );
};

export default Login;
