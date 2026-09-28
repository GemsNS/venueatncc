/**
 * TEMPORARY STUB. Replaced by the in-browser demo backend (localStorage) during the build-out.
 */
import type { VenueApi } from './types';

const notReady = async () => ({ ok: false as const, error: 'Demo backend not built yet.' });

export const demoApi: VenueApi = {
  demo: true,
  availability: notReady,
  formToken: notReady,
  submitInquiry: notReady,
  admin: {
    session: async () => null,
    login: notReady,
    logout: async () => {},
    stats: notReady,
    listInquiries: notReady,
    getInquiry: notReady,
    setStatus: notReady,
    addNote: notReady,
    listBlocks: notReady,
    createBlock: notReady,
    deleteBlock: notReady,
    exportCsv: notReady,
    changePassword: notReady,
  },
};
