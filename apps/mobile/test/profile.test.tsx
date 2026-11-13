import type { MeResponse, UserProfile } from '@music-room/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ProfileForm } from '@/features/profile/profile-form';
import { UserView } from '@/features/profile/user-view';
import { useSession } from '@/stores/session';
import { ME, reply } from './fixtures';

const PROFILE: MeResponse = {
	...ME,
	publicInfo: { city: 'Madrid' },
	privateInfo: { phone: '123' },
	musicPrefs: ['Jazz'],
};

beforeEach(async () => {
	await useSession.getState().signIn({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 });
});

describe('ProfileForm', () => {
	it('labels every tier with who can see it', async () => {
		await render(<ProfileForm me={PROFILE} />);
		expect(screen.getByText('Everyone can see this')).toBeOnTheScreen();
		expect(screen.getByText('Only your friends can see this')).toBeOnTheScreen();
		expect(screen.getByText('Only you can see this')).toBeOnTheScreen();
		expect(screen.getByLabelText('Public City').props.value).toBe('Madrid');
		expect(screen.getByLabelText('Private Phone').props.value).toBe('123');
	});

	it('sends each tier and the preferences on save', async () => {
		const fetchMock = jest.fn().mockResolvedValue(reply(200, PROFILE));
		globalThis.fetch = fetchMock;
		await render(<ProfileForm me={PROFILE} />);

		await fireEvent.changeText(screen.getByLabelText('Friends Bio'), 'hello friends');
		await fireEvent.changeText(screen.getByLabelText('Add a preference'), 'Rock');
		await fireEvent(screen.getByLabelText('Add a preference'), 'submitEditing');
		await fireEvent.press(screen.getByText('Jazz'));
		await fireEvent.press(screen.getByText('Save profile'));

		expect(await screen.findByText('Profile saved')).toBeOnTheScreen();
		const [, init] = fetchMock.mock.calls[0];
		expect(init.method).toBe('PATCH');
		expect(JSON.parse(init.body)).toMatchObject({
			friendsInfo: { bio: 'hello friends' },
			privateInfo: { phone: '123' },
			musicPrefs: ['Rock'],
		});
	});

	it('shows schema errors without calling the API', async () => {
		const fetchMock = jest.fn();
		globalThis.fetch = fetchMock;
		await render(<ProfileForm me={PROFILE} />);
		await fireEvent.changeText(screen.getByLabelText('Public Birthday (YYYY-MM-DD)'), 'soon');
		await fireEvent.press(screen.getByText('Save profile'));
		expect(await screen.findByText('Use YYYY-MM-DD')).toBeOnTheScreen();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe('UserView', () => {
	const stranger: UserProfile = {
		id: PROFILE.id,
		displayName: 'Bob',
		relation: 'none',
		publicInfo: { city: 'Paris' },
		musicPrefs: [],
	};

	it('renders only the tiers returned', async () => {
		await render(<UserView user={stranger} />);
		expect(screen.getByText('Paris')).toBeOnTheScreen();
		expect(screen.queryByText('Friends')).toBeNull();
		expect(screen.queryByText('Private')).toBeNull();
		expect(screen.getByText('Add friend')).toBeOnTheScreen();
	});

	it('offers the action matching the relation', async () => {
		await render(
			<UserView user={{ ...stranger, relation: 'friend', friendsInfo: { bio: 'hey' } }} />,
		);
		expect(screen.getByText('hey')).toBeOnTheScreen();
		expect(screen.getByText('Remove friend')).toBeOnTheScreen();
	});
});
