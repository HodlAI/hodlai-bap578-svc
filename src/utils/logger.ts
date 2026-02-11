import pino from 'pino';
import { config } from '../config';

const logger = pino({
  level: config.service.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  },
});

export default logger;