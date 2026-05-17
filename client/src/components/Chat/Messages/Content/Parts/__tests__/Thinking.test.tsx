import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Thinking from '../Thinking';

jest.mock('~/hooks', () => ({
  useLocalize:
    () =>
    (key: string): string =>
      key,
  useExpandCollapse: (isExpanded: boolean) => ({
    style: { display: isExpanded ? 'block' : 'none' },
    ref: { current: null },
  }),
}));

jest.mock('@librechat/client', () => ({
  CheckMark: () => <span data-testid="check-icon" />,
  Clipboard: () => <span data-testid="clipboard-icon" />,
  TooltipAnchor: ({ render }: { render: React.ReactElement }) => render,
}));

describe('Thinking', () => {
  it('toggles thought content with matching aria state', () => {
    const thoughtText = 'Private plan';
    render(<Thinking>{thoughtText}</Thinking>);

    const toggle = screen.getByRole('button', { name: 'com_ui_thoughts' });
    const contentId = toggle.getAttribute('aria-controls');
    const content = contentId ? document.getElementById(contentId) : null;

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(content).not.toBeNull();
    expect(content).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(content).not.toHaveAttribute('aria-hidden');
    expect(screen.getByText(thoughtText)).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(content).toHaveAttribute('aria-hidden', 'true');
  });
});
