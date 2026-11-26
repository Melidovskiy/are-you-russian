import { ipAddress } from '@vercel/functions';
import { apiResponse } from '../src/server/api.js';

export default {
  fetch(request) {
    return apiResponse('/api/whoami', request, ipAddress(request));
  },
};
