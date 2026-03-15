type Environment = 'development' | 'test' | 'production';

interface EnvVars {
  PORT: number;
  NODE_ENV: Environment;
  ENABLE_DATABASE: boolean;
  MONGODB_URI: string;
  MONGODB_DB_NAME: string;
  ENABLE_REDIS: boolean;
  REDIS_URL: string;
}

const toNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return String(value).toLowerCase() === 'true';
};

const toEnvironment = (value: unknown): Environment => {
  const env = String(value ?? 'development');

  if (env === 'development' || env === 'test' || env === 'production') {
    return env;
  }

  throw new Error(`Invalid NODE_ENV value: ${env}`);
};

export const validateEnv = (config: Record<string, unknown>): EnvVars => {
  const port = toNumber(config.PORT, 3000);
  const nodeEnv = toEnvironment(config.NODE_ENV);
  const enableRedis = toBoolean(config.ENABLE_REDIS, false);
  const redisUrl = String(config.REDIS_URL ?? 'redis://localhost:6379').trim();
  const mongoUri = String(
    config.MONGODB_URI ??
      'mongodb://root:root@localhost:27017/restaurant?authSource=admin',
  ).trim();
  const mongoDbName = String(config.MONGODB_DB_NAME ?? 'restaurant').trim();
  const enableDatabase = toBoolean(config.ENABLE_DATABASE, true);

  if (enableDatabase && nodeEnv !== 'test' && !mongoUri) {
    throw new Error('MONGODB_URI is required when ENABLE_DATABASE is true');
  }

  if (enableDatabase && nodeEnv !== 'test' && !mongoDbName) {
    throw new Error('MONGODB_DB_NAME is required when ENABLE_DATABASE is true');
  }

  if (enableRedis && nodeEnv !== 'test' && !redisUrl) {
    throw new Error('REDIS_URL is required when ENABLE_REDIS is true');
  }

  return {
    PORT: port,
    NODE_ENV: nodeEnv,
    ENABLE_DATABASE: enableDatabase,
    MONGODB_URI: mongoUri,
    MONGODB_DB_NAME: mongoDbName,
    ENABLE_REDIS: enableRedis,
    REDIS_URL: redisUrl,
  };
};
