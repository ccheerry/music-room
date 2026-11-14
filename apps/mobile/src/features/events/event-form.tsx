import {
	type EventDetail,
	type VoteLicense,
	type Visibility,
	type VoteZone,
} from '@music-room/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { Button } from '@/components/button';
import { Options } from '@/components/options';
import { Input } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { LICENSE_LABELS, VISIBILITY_LABELS } from '@/features/events/labels';
import { currentCoords } from '@/features/events/location';

export type EventFormValues = {
	name: string;
	visibility: Visibility;
	voteLicense: VoteLicense;
	zone: VoteZone | null;
};

type EventFormProps = {
	initial?: EventDetail;
	submitLabel: string;
	onSubmit: (values: EventFormValues) => Promise<void>;
};

// Length of the voting window, in hours.
const hoursOf = (zone: VoteZone) =>
	Math.round(((Date.parse(zone.endsAt) - Date.parse(zone.startsAt)) / 3600000) * 100) / 100;

// shortcut: the zone is placed at the phone's position (no map picker); add react-native-maps for remote placement.
export function EventForm({ initial, submitLabel, onSubmit }: EventFormProps) {
	const [name, setName] = useState(initial?.name ?? '');
	const [visibility, setVisibility] = useState<Visibility>(initial?.visibility ?? 'PUBLIC');
	const [license, setLicense] = useState<VoteLicense>(initial?.voteLicense ?? 'EVERYONE');
	const [place, setPlace] = useState(
		initial?.zone ? { lat: initial.zone.lat, lng: initial.zone.lng } : null,
	);
	const [radius, setRadius] = useState(String(initial?.zone?.radiusM ?? 200));
	const [hours, setHours] = useState(initial?.zone ? String(hoursOf(initial.zone)) : '4');
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const locate = async () => {
		setError(null);
		try {
			setPlace(await currentCoords());
		} catch (err) {
			setError(errorMessage(err));
		}
	};

	const submit = async () => {
		setError(null);
		let zone: VoteZone | null = null;
		if (license === 'LOCATION') {
			const radiusM = Number(radius);
			const duration = Number(hours);
			if (!place) return setError('Set the place first');
			if (!Number.isInteger(radiusM) || radiusM < 10 || radiusM > 50000) {
				return setError('Radius: a whole number of metres between 10 and 50000');
			}
			if (!(duration > 0 && duration <= 72))
				return setError('Duration: between 0 and 72 hours');
			const start = initial?.zone?.startsAt ?? new Date().toISOString();
			const end = new Date(Date.parse(start) + duration * 3600 * 1000).toISOString();
			zone = { ...place, radiusM, startsAt: start, endsAt: end };
		}
		setBusy(true);
		try {
			await onSubmit({ name: name.trim(), visibility, voteLicense: license, zone });
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			<View style={styles.group}>
				<ThemedText type="smallBold">Name</ThemedText>
				<Input
					accessibilityLabel="Event name"
					value={name}
					onChangeText={setName}
					autoCapitalize="sentences"
				/>
			</View>
			<Options
				label="Who can see it"
				value={visibility}
				options={VISIBILITY_LABELS}
				onChange={setVisibility}
			/>
			<Options
				label="Who can vote"
				value={license}
				options={LICENSE_LABELS}
				onChange={setLicense}
			/>
			{license === 'LOCATION' && (
				<View style={styles.group}>
					<ThemedText type="small" themeColor="textSecondary">
						{place
							? `Place: ${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`
							: 'Stand at the venue and set the place from your position.'}
					</ThemedText>
					<Button label="Use my current position" variant="secondary" onPress={locate} />
					<ThemedText type="smallBold">Radius (metres)</ThemedText>
					<Input
						accessibilityLabel="Radius in metres"
						value={radius}
						onChangeText={setRadius}
						inputMode="numeric"
					/>
					<ThemedText type="smallBold">Voting open for (hours)</ThemedText>
					<Input
						accessibilityLabel="Voting hours"
						value={hours}
						onChangeText={setHours}
						inputMode="decimal"
					/>
				</View>
			)}
			{error && <ThemedText themeColor="danger">{error}</ThemedText>}
			<Button
				label={submitLabel}
				onPress={submit}
				disabled={busy || name.trim().length === 0}
			/>
		</>
	);
}

const styles = StyleSheet.create({ group: { gap: Spacing.one } });
