import { fireEvent, render, screen } from '@testing-library/react-native';

import { EventForm } from '@/features/events/event-form';

const PLACE = { latitude: 48.8966, longitude: 2.3185 };

describe('EventForm', () => {
	it('places the voting zone where the map is tapped and sends it', async () => {
		const onSubmit = jest.fn(async () => undefined);
		await render(<EventForm submitLabel="Create" onSubmit={onSubmit} />);
		await fireEvent.changeText(screen.getByLabelText('Event name'), 'Party');
		await fireEvent.press(screen.getByText('People at the place, during a time window'));
		await fireEvent(screen.getByTestId('zone-map'), 'press', {
			nativeEvent: { coordinate: PLACE },
		});
		expect(screen.getByText('Place: 48.89660, 2.31850')).toBeOnTheScreen();
		await fireEvent.press(screen.getByText('Create'));
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				voteLicense: 'LOCATION',
				zone: expect.objectContaining({ lat: 48.8966, lng: 2.3185, radiusM: 200 }),
			}),
		);
	});
});
