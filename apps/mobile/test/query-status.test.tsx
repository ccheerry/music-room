import { render, screen } from '@testing-library/react-native';

import { ApiError } from '@/api/errors';
import { QueryStatus } from '@/components/query-status';

const base = { isLoading: false, isError: false, error: null };

describe('QueryStatus', () => {
	it('shows a spinner while the first load runs', async () => {
		await render(<QueryStatus query={{ ...base, isLoading: true }} />);
		expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
	});

	it('shows the error message when the request fails', async () => {
		const error = new ApiError(500, 'INTERNAL', 'Something went wrong');
		await render(<QueryStatus query={{ ...base, isError: true, error }} />);
		expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
	});

	it('shows the empty text only when the list is empty', async () => {
		const { rerender } = await render(
			<QueryStatus query={base} isEmpty={false} emptyText="Nothing here" />,
		);
		expect(screen.queryByText('Nothing here')).toBeNull();
		await rerender(<QueryStatus query={base} isEmpty emptyText="Nothing here" />);
		expect(screen.getByText('Nothing here')).toBeOnTheScreen();
	});
});
