import { createMemoryDriver, createMemoryState } from './driver';
import { storageContract } from '../core/storage.contract';

storageContract('memory', () => {
  const state = createMemoryState();
  return async (specs) => createMemoryDriver(specs, state);
});
