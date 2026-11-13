import { queryClient } from '@/api/query-client';

// Cached queries keep garbage-collection timers that would hold Jest open.
afterAll(() => queryClient.clear());
