import type { HealthStatus } from '@/api/client';
import { ThemedText } from '@/components/themed-text';

const LABELS: Record<HealthStatus, string> = {
	ok: 'API ok',
	'db-down': 'API up, database down',
	unreachable: 'API unreachable',
};

export function HealthBadge({ status }: { status: HealthStatus | 'checking' }) {
	if (status === 'checking') return <ThemedText themeColor="textSecondary">Checking…</ThemedText>;
	return (
		<ThemedText themeColor={status === 'ok' ? 'success' : 'danger'}>
			{LABELS[status]}
		</ThemedText>
	);
}
