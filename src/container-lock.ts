import { logger } from './logger.js';

let containerLock = false;

export async function withContainerLock<T>(
  fn: () => Promise<T>,
): Promise<T | null> {
  if (containerLock) {
    logger.debug('Container already running, skipping');
    return null;
  }
  containerLock = true;
  try {
    return await fn();
  } finally {
    containerLock = false;
  }
}
