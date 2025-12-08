// Environment variable validation for Valyu OAuth and critical systems

interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePaymentEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = !isDevelopment;

  // Core Supabase requirements (always required)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is required');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required');
  }

  // Production-only requirements
  if (isProduction) {
    // Valyu OAuth requirements
    if (!process.env.NEXT_PUBLIC_VALYU_SUPABASE_URL) {
      errors.push('NEXT_PUBLIC_VALYU_SUPABASE_URL is required in production');
    }
    if (!process.env.NEXT_PUBLIC_VALYU_CLIENT_ID) {
      errors.push('NEXT_PUBLIC_VALYU_CLIENT_ID is required in production');
    }
    if (!process.env.VALYU_CLIENT_SECRET) {
      errors.push('VALYU_CLIENT_SECRET is required in production');
    }
  }

  // Development warnings
  if (isDevelopment) {
    if (!process.env.VALYU_API_KEY) {
      warnings.push('VALYU_API_KEY missing - API calls will fail without OAuth token');
    }
  }

  // Validate URL formats
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('https://')) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function logEnvironmentStatus(): void {
  const validation = validatePaymentEnvironment();
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (validation.valid) {
    // Environment is properly configured
  } else {
    // Environment has issues
  }

  if (validation.warnings.length > 0) {
    // Warnings present
  }
}

// Auto-validate on import in production
if (process.env.NODE_ENV !== 'development') {
  const validation = validatePaymentEnvironment();
  if (!validation.valid) {
    // Don't throw in production to avoid complete app failure, but log critically
  }
}
