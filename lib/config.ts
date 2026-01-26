export function getBackendApiUrl(): string {
  const env = process.env.NODE_ENV;
  const customEnv = process.env.ENV_FILE;

  if (customEnv === 'prod' || env === 'production') {
    return process.env.BACKEND_API_URL_PROD || process.env.BACKEND_API_URL || "https://apis.weidentify.ai";
  }

  if (customEnv === 'local' || env === 'development') {
    return process.env.BACKEND_API_URL_LOCAL || process.env.BACKEND_API_URL || "http://localhost:8000";
  }

  return process.env.BACKEND_API_URL || "https://apis.weidentify.ai";
}

export function getEnvironment(): 'local' | 'prod' {
  const env = process.env.NODE_ENV;
  const customEnv = process.env.ENV_FILE;

  if (customEnv === 'prod' || env === 'production') {
    return 'prod';
  }

  return 'local';
}
