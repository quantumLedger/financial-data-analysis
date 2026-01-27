/**
 * Centralized configuration management
 * Loads environment variables from .env.local or .env.prod based on NODE_ENV
 */

// Chat API Configuration
export const CHAT_API_BASE_URL = 
  process.env.NEXT_PUBLIC_CHAT_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://api.weidentify.ai/api/chat'
    : 'http://localhost:8000/api/chat');

// Weidentify API Configuration
export const WEIDENTIFY_API_URL = 
  process.env.NEXT_PUBLIC_WEIDENTIFY_API_URL || 
  'https://apis.weidentify.ai';

// Base URL for the application
export const BASE_URL = 
  process.env.NEXT_PUBLIC_BASE_URL || 
  (process.env.NODE_ENV === 'production'
    ? 'https://finance.weidentify.ai'
    : 'http://localhost:3000');

// API Keys (Server-side only)
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
export const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// Allowed Parent Origins for iframe communication
export const ALLOWED_PARENT_ORIGINS = 
  process.env.NEXT_PUBLIC_ALLOWED_PARENT_ORIGINS?.split(',').map(origin => origin.trim()) || 
  (process.env.NODE_ENV === 'production'
    ? ['https://weidentify.ai', 'https://app.weidentify.ai']
    : ['http://localhost:3000']);

// Environment
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';
export const IS_DEVELOPMENT = NODE_ENV === 'development';

// Validation
if (!ANTHROPIC_API_KEY && typeof window === 'undefined') {
  console.warn('⚠️ ANTHROPIC_API_KEY is not set in environment variables');
}

if (!PERPLEXITY_API_KEY && typeof window === 'undefined') {
  console.warn('⚠️ PERPLEXITY_API_KEY is not set in environment variables');
}

// Export config object for convenience
export const config = {
  chatApi: {
    baseUrl: CHAT_API_BASE_URL,
  },
  weidentifyApi: {
    url: WEIDENTIFY_API_URL,
  },
  app: {
    baseUrl: BASE_URL,
    allowedParentOrigins: ALLOWED_PARENT_ORIGINS,
  },
  apiKeys: {
    anthropic: ANTHROPIC_API_KEY,
    perplexity: PERPLEXITY_API_KEY,
  },
  env: {
    nodeEnv: NODE_ENV,
    isProduction: IS_PRODUCTION,
    isDevelopment: IS_DEVELOPMENT,
  },
} as const;
