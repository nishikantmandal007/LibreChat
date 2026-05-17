import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AnonymizedPromptToggle from '../AnonymizedPromptToggle';

describe('AnonymizedPromptToggle', () => {
  it('renders the same-size action button for prompts without PII', () => {
    const onToggle = jest.fn();

    render(
      <AnonymizedPromptToggle isShowing={false} onToggle={onToggle} piiDetected={false} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /no pii detected/i }));

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('toggles anonymized prompt display when PII changed the prompt', () => {
    const onToggle = jest.fn();

    render(
      <AnonymizedPromptToggle
        isShowing={false}
        onToggle={onToggle}
        piiDetected={true}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /show anonymized prompt/i }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('exposes active state when anonymized prompt is shown', () => {
    render(
      <AnonymizedPromptToggle isShowing={true} onToggle={jest.fn()} piiDetected={true} />,
    );

    expect(screen.getByRole('button', { name: /show original prompt/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
