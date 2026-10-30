import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { leaveLink } from '@/utils/leave-link';

// Shown when a mail-link screen is opened without its token.
export function MissingToken() {
	return (
		<Screen>
			<ThemedText>This link is incomplete. Open it again from the mail.</ThemedText>
			<Button label="Back" onPress={leaveLink} />
		</Screen>
	);
}
