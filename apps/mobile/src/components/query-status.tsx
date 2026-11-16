import { ActivityIndicator } from 'react-native';

import { errorMessage } from '@/api/errors';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

interface QueryLike {
	isLoading: boolean;
	isError: boolean;
	error: unknown;
}

interface QueryStatusProps {
	query: QueryLike;
	isEmpty?: boolean;
	emptyText?: string;
}

// Loading, error and empty states of one query, the same on every screen.
export function QueryStatus({ query, isEmpty, emptyText }: QueryStatusProps) {
	const theme = useTheme();
	if (query.isLoading)
		return <ActivityIndicator accessibilityLabel="Loading" color={theme.accent} />;
	if (query.isError)
		return <ThemedText themeColor="danger">{errorMessage(query.error)}</ThemedText>;
	if (isEmpty && emptyText)
		return <ThemedText themeColor="textSecondary">{emptyText}</ThemedText>;
	return null;
}
