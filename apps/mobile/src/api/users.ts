import {
	FriendList,
	FriendRequestResult,
	FriendRequests,
	MeResponse,
	type UpdateMeBody,
	UserList,
	UserProfile,
} from '@music-room/shared';

import { request } from '@/api/client';
import { queryClient } from '@/api/query-client';

export const updateMe = async (body: UpdateMeBody) => {
	const me = await request('/me', { method: 'PATCH', body, auth: true }, MeResponse);
	queryClient.setQueryData(['me'], me);
	return me;
};

export const getUser = (id: string) => request(`/users/${id}`, { auth: true }, UserProfile);

export const searchUsers = (q: string) =>
	request(`/users?q=${encodeURIComponent(q)}`, { auth: true }, UserList);

export const getFriends = () => request('/friends', { auth: true }, FriendList);
export const getFriendRequests = () => request('/friends/requests', { auth: true }, FriendRequests);

// Every friendship change refreshes the friend lists and the profile shown.
const refreshFriends = () =>
	Promise.all([
		queryClient.invalidateQueries({ queryKey: ['friends'] }),
		queryClient.invalidateQueries({ queryKey: ['user'] }),
	]);

const mutate = async <T>(run: () => Promise<T>) => {
	const result = await run();
	await refreshFriends();
	return result;
};

export const sendFriendRequest = (userId: string) =>
	mutate(() =>
		request(
			'/friends/requests',
			{ method: 'POST', body: { userId }, auth: true },
			FriendRequestResult,
		),
	);
export const acceptFriend = (userId: string) =>
	mutate(() => request(`/friends/requests/${userId}/accept`, { method: 'POST', auth: true }));
export const dropFriendRequest = (userId: string) =>
	mutate(() => request(`/friends/requests/${userId}`, { method: 'DELETE', auth: true }));
export const removeFriend = (userId: string) =>
	mutate(() => request(`/friends/${userId}`, { method: 'DELETE', auth: true }));
