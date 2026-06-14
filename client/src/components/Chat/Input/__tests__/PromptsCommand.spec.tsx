import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptsCommand from '../PromptsCommand';

const CONVO_ID = 'convo-1';
const mockSetShowPromptsPopover = jest.fn();
const mockSetEphemeralAgent = jest.fn();
const mockSetPendingManualSkills = jest.fn();
const mockSubmitPrompt = jest.fn();

jest.mock('recoil', () => {
  const actual = jest.requireActual('recoil');
  return {
    ...actual,
    useRecoilValue: jest.fn(() => true),
    useSetRecoilState: jest.fn((atom: unknown) => {
      if (atom === 'show-prompts-popover') {
        return mockSetShowPromptsPopover;
      }
      if (atom === 'ephemeral-agent') {
        return mockSetEphemeralAgent;
      }
      if (atom === 'pending-manual-skills') {
        return mockSetPendingManualSkills;
      }
      return jest.fn();
    }),
  };
});

jest.mock('~/store', () => ({
  __esModule: true,
  default: {
    showPromptsPopoverFamily: () => 'show-prompts-popover',
    pendingManualSkillsByConvoId: () => 'pending-manual-skills',
  },
  ephemeralAgentByConvoId: () => 'ephemeral-agent',
}));

jest.mock('~/data-provider', () => ({
  useRecordPromptUsage: () => ({ mutate: jest.fn() }),
  useSkillsInfiniteQuery: () => ({
    data: {
      pages: [
        {
          skills: [
            {
              _id: 'skill-1',
              name: 'brand-guidelines',
              displayTitle: 'Brand Guidelines',
              description: 'Apply the brand voice',
              author: 'user',
              authorName: 'User',
              version: 1,
              source: 'inline',
              fileCount: 0,
              createdAt: '',
              updatedAt: '',
            },
          ],
          has_more: false,
          after: null,
        },
      ],
    },
    isLoading: false,
    isError: false,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
}));

jest.mock('~/Providers', () => ({
  useAgentsMapContext: () => ({}),
  usePromptGroupsContext: () => ({
    hasAccess: true,
    allPromptGroups: {
      data: { promptGroups: [], promptsMap: {} },
      isLoading: false,
    },
  }),
}));

jest.mock('~/hooks', () => ({
  useHasAccess: () => true,
  useLocalize: () => (key: string) => key,
  useSkillActiveState: () => ({ isActive: () => true }),
}));

jest.mock('~/components/Prompts', () => ({
  VariableDialog: () => null,
}));

jest.mock('@librechat/client', () => {
  const actual = jest.requireActual('@librechat/client');
  return {
    ...actual,
    Spinner: () => null,
  };
});

jest.mock('react-virtualized', () => ({
  ...jest.requireActual('react-virtualized'),
  AutoSizer: ({ children }: { children: (size: { width: number }) => React.ReactNode }) =>
    children({ width: 320 }),
  List: ({
    rowCount,
    rowRenderer,
  }: {
    rowCount: number;
    rowRenderer: (args: {
      index: number;
      key: string;
      style: React.CSSProperties;
    }) => React.ReactNode;
  }) => {
    const rows: React.ReactNode[] = [];
    for (let i = 0; i < rowCount; i++) {
      rows.push(rowRenderer({ index: i, key: `row-${i}`, style: {} }));
    }
    return <ul data-testid="slash-command-list">{rows}</ul>;
  },
}));

function makeTextarea(initial = '/') {
  const textarea = document.createElement('textarea');
  textarea.value = initial;
  document.body.appendChild(textarea);
  return { current: textarea } as React.MutableRefObject<HTMLTextAreaElement | null>;
}

describe('PromptsCommand slash skills', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('selecting a slash skill queues it without submitting prompt text', async () => {
    const user = userEvent.setup();
    const textAreaRef = makeTextarea('/');

    render(
      <PromptsCommand
        index={0}
        textAreaRef={textAreaRef}
        submitPrompt={mockSubmitPrompt}
        conversationId={CONVO_ID}
      />,
    );

    const skillButton = await screen.findByRole('button', { name: /Brand Guidelines/i });
    await act(async () => {
      await user.click(skillButton);
    });

    expect(mockSubmitPrompt).not.toHaveBeenCalled();
    expect(mockSetPendingManualSkills).toHaveBeenCalledTimes(1);
    const updater = mockSetPendingManualSkills.mock.calls[0][0] as (prev: string[]) => string[];
    expect(updater([])).toEqual(['brand-guidelines']);
    expect(textAreaRef.current?.value).toBe('');
  });
});
