import axios from 'axios';

import { API_V1_BASE_URL } from '@/src/core/config/env';

export const rawClient = axios.create({
  baseURL: API_V1_BASE_URL,
  timeout: 15_000,
  headers: {
    Accept: 'application/json',
  },
});

