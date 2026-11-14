import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';

import { deleteEvent, eventKeys, getEvent, updateEvent } from '@/api/events';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { EventForm } from '@/features/events/event-form';

export default function EditEventScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const event = useQuery({ queryKey: eventKeys.detail(id), queryFn: () => getEvent(id) });
	if (!event.data) return <Screen>{null}</Screen>;
	return (
		<Screen>
			<EventForm
				initial={event.data}
				submitLabel="Save"
				onSubmit={async (values) => {
					await updateEvent(id, values);
					router.back();
				}}
			/>
			<Button
				label="Invite people"
				variant="secondary"
				onPress={() => router.push({ pathname: '/event/[id]/invite', params: { id } })}
			/>
			<Button
				label="Delete event"
				variant="secondary"
				onPress={async () => {
					await deleteEvent(id);
					router.dismissTo('/events');
				}}
			/>
		</Screen>
	);
}
