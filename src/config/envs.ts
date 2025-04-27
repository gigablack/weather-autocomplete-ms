import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  NATS_SERVER: string;
  MONGODB_URI: string;
  REDIS_URI: string;
  REDIS_CACHE_TTL: number;
  WEATHER_API_KEY: string;
  WEATHER_API_BASE_URL: string;
}

const envSchema = joi
  .object<EnvVars>({
    NATS_SERVER: joi.string().required(),
    MONGODB_URI: joi.string().required(),
    REDIS_URI: joi.string().uri().required(),
    REDIS_CACHE_TTL: joi.number().required(),
    WEATHER_API_KEY: joi.string().required(),
    WEATHER_API_BASE_URL: joi.string().uri().required(),
  })
  .unknown(true);

const { error, value } = envSchema.validate({
  ...process.env,
});

if (error) throw new Error(`Error on environment variables: ${error.message}`);

const envVars: EnvVars = value;

export const envs = {
  nats: envVars.NATS_SERVER,
  mongo: envVars.MONGODB_URI,
  redis: envVars.REDIS_URI,
  redisTTL: envVars.REDIS_CACHE_TTL,
  weatherApiKey: envVars.WEATHER_API_KEY,
  weatherApiBaseUrl: envVars.WEATHER_API_BASE_URL,
};
