import { router } from 'expo-router';

import { createEvent } from '@/api/events';
import { Screen } from '@/components/screen';
import { EventForm } from '@/features/events/event-form';

export default function NewEventScreen() {
	return (
		<Screen>
			<EventForm
				submitLabel="Create event"
				onSubmit={async (values) => {
					const event = await createEvent(values);
					router.replace({ pathname: '/event/[id]', params: { id: event.id } });
				}}
			/>
		</Screen>
	);
}
