# Frontend Test Utilities

Test setup and utilities for frontend component and hook testing.

## Files

- `setup.ts` - Global test setup, mocks, and configuration
- `utils.tsx` - Test utilities and custom render functions

## Usage

### Testing Components

```typescript
import { renderWithProviders, screen, userEvent } from '../../../test/utils';

describe('MyComponent', () => {
  it('renders and handles interaction', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    
    renderWithProviders(<MyComponent onClick={onClick} />);
    
    expect(screen.getByText('Hello')).toBeInTheDocument();
    
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

### Testing Hooks

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('useMyHook', () => {
  it('fetches data', async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
    
    const { result } = renderHook(() => useMyHook(), { wrapper });
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
```

## Utilities

### `renderWithProviders(ui, options)`

Renders a component with all necessary providers (QueryClient, Router).

### `createTestQueryClient()`

Creates a QueryClient configured for testing.

### `mockApiResponse(data, delay)`

Helper for mocking successful API responses.

### `mockApiError(message, delay)`

Helper for mocking API errors.

## Best Practices

1. Use semantic queries: `getByRole`, `getByLabelText`, `getByText`
2. Prefer `findBy*` for async operations
3. Use `userEvent` for realistic interactions
4. Test user behavior, not implementation
5. Keep tests focused and isolated
