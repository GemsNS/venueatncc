/**
 * The API client every island imports. The demo flag is a build-time constant,
 * so the unused implementation is dropped from the bundle.
 */
import { isDemo } from '../env';
import { demoApi } from './demo';
import { httpApi } from './http';
import type { VenueApi } from './types';

export const api: VenueApi = isDemo ? demoApi : httpApi;
export { isError } from './types';
export type { VenueApi, BlockInput, Result } from './types';
