import { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react';
import { ScrollText } from 'lucide-react';
import { AutoSizer, List } from 'react-virtualized';
import { Spinner, useCombobox } from '@librechat/client';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import type { TPromptGroup, TSkillSummary, TSavedPromptRef } from 'librechat-data-provider';
import type { MentionOption, PromptOption } from '~/common';
import useInitPopoverInput from '~/hooks/Input/useInitPopoverInput';
import { removeCharIfLast, detectVariables } from '~/utils';
import { useRecordPromptUsage, useSkillsInfiniteQuery } from '~/data-provider';
import { VariableDialog } from '~/components/Prompts';
import { useAgentsMapContext, usePromptGroupsContext } from '~/Providers';
import { isEphemeralAgent } from '~/common';
import { ephemeralAgentByConvoId } from '~/store';
import MentionItem from './MentionItem';
import { useHasAccess, useLocalize, useSkillActiveState } from '~/hooks';
import { filterSkillsForPopover } from './SkillsCommand';
import store from '~/store';

const commandChar = '/';
const skillIcon = <ScrollText className="icon-md text-cyan-500" />;
type SlashCommandOption = PromptOption | (MentionOption & { id: string; type: 'skill' });

const PopoverContainer = memo(
  ({
    index,
    children,
    isVariableDialogOpen,
    variableGroup,
    setVariableDialogOpen,
    textAreaRef,
  }: {
    index: number;
    children: React.ReactNode;
    isVariableDialogOpen: boolean;
    variableGroup: TPromptGroup | null;
    setVariableDialogOpen: (isOpen: boolean) => void;
    textAreaRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  }) => {
    const showPromptsPopover = useRecoilValue(store.showPromptsPopoverFamily(index));
    return (
      <>
        {showPromptsPopover ? children : null}
        <VariableDialog
          open={isVariableDialogOpen}
          onClose={() => {
            setVariableDialogOpen(false);
            requestAnimationFrame(() => {
              textAreaRef.current?.focus();
            });
          }}
          group={variableGroup}
        />
      </>
    );
  },
);

const ROW_HEIGHT = 44;

function PromptsCommand({
  index,
  textAreaRef,
  submitPrompt,
  conversationId,
  agentId,
}: {
  index: number;
  textAreaRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  submitPrompt: (textPrompt: string, savedPrompt?: TSavedPromptRef) => void;
  conversationId: string;
  agentId?: string | null;
}) {
  const localize = useLocalize();
  const { mutate: recordUsage } = useRecordPromptUsage();
  const promptGroupsContext = usePromptGroupsContext();
  const { allPromptGroups, hasAccess } = promptGroupsContext ?? {};
  const { data, isLoading } = allPromptGroups ?? {};
  const agentsMap = useAgentsMapContext();
  const { isActive } = useSkillActiveState();
  const hasSkillsAccess = useHasAccess({
    permissionType: PermissionTypes.SKILLS,
    permission: Permissions.USE,
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isVariableDialogOpen, setVariableDialogOpen] = useState(false);
  const [variableGroup, setVariableGroup] = useState<TPromptGroup | null>(null);
  const setShowPromptsPopover = useSetRecoilState(store.showPromptsPopoverFamily(index));
  const showPromptsPopover = useRecoilValue(store.showPromptsPopoverFamily(index));
  const setEphemeralAgent = useSetRecoilState(ephemeralAgentByConvoId(conversationId));
  const setPendingManualSkills = useSetRecoilState(
    store.pendingManualSkillsByConvoId(conversationId),
  );

  const agentSkillIds = useMemo<string[] | null | undefined>(() => {
    if (!agentId || isEphemeralAgent(agentId)) {
      return undefined;
    }
    if (!agentsMap) {
      return [];
    }
    const agent = agentsMap[agentId];
    if (!agent || agent.skills_enabled !== true) {
      return [];
    }
    return Array.isArray(agent.skills) && agent.skills.length > 0 ? agent.skills : undefined;
  }, [agentId, agentsMap]);

  const {
    data: skillsData,
    isLoading: isSkillsLoading,
    isError: isSkillsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSkillsInfiniteQuery({ limit: 50 }, { enabled: showPromptsPopover && hasSkillsAccess });
  const skillPaginationBlockedRef = useRef(false);

  const prompts = useMemo(() => (hasAccess ? data?.promptGroups : []), [data, hasAccess]);
  const promptsMap = useMemo(() => (hasAccess ? data?.promptsMap : undefined), [data, hasAccess]);
  const skillOptions: SlashCommandOption[] = useMemo(() => {
    if (!hasSkillsAccess) {
      return [];
    }
    const allSkills: TSkillSummary[] = [];
    for (const page of skillsData?.pages ?? []) {
      allSkills.push(...page.skills);
    }
    return filterSkillsForPopover(allSkills, { agentSkillIds, isActive }).map((skill) => ({
      id: skill._id,
      label: skill.displayTitle ?? skill.name,
      value: skill.name,
      description: skill.description,
      type: 'skill',
      icon: skillIcon,
    }));
  }, [hasSkillsAccess, skillsData?.pages, agentSkillIds, isActive]);
  const slashOptions: SlashCommandOption[] = useMemo(
    () => [...(prompts ?? []), ...skillOptions],
    [prompts, skillOptions],
  );

  const { open, setOpen, searchValue, setSearchValue, matches } = useCombobox({
    value: '',
    options: slashOptions,
  });

  const initInputRef = useInitPopoverInput({
    inputRef,
    textAreaRef,
    commandChar,
    setSearchValue,
    setOpen,
  });

  const handleSelect = useCallback(
    (mention?: SlashCommandOption, e?: React.KeyboardEvent<HTMLInputElement>) => {
      if (!mention) {
        return;
      }

      setSearchValue('');
      setOpen(false);
      setShowPromptsPopover(false);

      if (textAreaRef.current) {
        removeCharIfLast(textAreaRef.current, commandChar);
      }

      if (mention.type === 'skill') {
        setEphemeralAgent((prev) => (prev?.skills ? prev : { ...(prev || {}), skills: true }));
        setPendingManualSkills((prev) =>
          prev.includes(mention.value) ? prev : [...prev, mention.value],
        );
        textAreaRef.current?.focus();
        return;
      }

      const group = promptsMap?.[mention.id];
      if (!group) {
        return;
      }

      const hasVariables = detectVariables(group.productionPrompt?.prompt ?? '');
      if (hasVariables) {
        if (e && e.key === 'Tab') {
          e.preventDefault();
        }
        setVariableGroup(group);
        setVariableDialogOpen(true);
        return;
      } else {
        submitPrompt(
          group.productionPrompt?.prompt ?? '',
          group._id ? { groupId: group._id, name: group.name } : undefined,
        );
        if (group._id) {
          recordUsage(group._id);
        }
      }
    },
    [
      setSearchValue,
      setOpen,
      setShowPromptsPopover,
      textAreaRef,
      setEphemeralAgent,
      setPendingManualSkills,
      promptsMap,
      submitPrompt,
      recordUsage,
    ],
  );

  useEffect(() => {
    if (isSkillsError) {
      skillPaginationBlockedRef.current = true;
    }
  }, [isSkillsError]);

  useEffect(() => {
    if (skillPaginationBlockedRef.current || isSkillsError) {
      return;
    }
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isSkillsError, fetchNextPage]);

  useEffect(() => {
    if (!open) {
      setActiveIndex(0);
    } else {
      setVariableGroup(null);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(matches.length - 1, 0)));
  }, [matches.length]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const currentActiveItem =
      document.getElementById(`prompt-item-${activeIndex}`) ??
      document.getElementById(`skill-item-${activeIndex}`);
    currentActiveItem?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  }, [activeIndex]);

  const rowRenderer = ({
    index,
    key,
    style,
  }: {
    index: number;
    key: string;
    style: React.CSSProperties;
  }) => {
    const mention = matches[index] as SlashCommandOption;
    return (
      <MentionItem
        index={index}
        type={mention.type === 'skill' ? 'skill' : 'prompt'}
        key={key}
        style={style}
        onClick={() => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = null;
          handleSelect(mention);
        }}
        name={mention.label ?? ''}
        icon={mention.icon}
        description={mention.description}
        isActive={index === activeIndex}
      />
    );
  };

  return (
    <PopoverContainer
      index={index}
      isVariableDialogOpen={isVariableDialogOpen}
      variableGroup={variableGroup}
      setVariableDialogOpen={setVariableDialogOpen}
      textAreaRef={textAreaRef}
    >
      <div className="absolute bottom-full left-2 z-20 mb-2 w-[min(28rem,calc(100%-1rem))] space-y-2">
        <div className="popover border-token-border-light rounded-2xl border bg-surface-tertiary-alt p-2 shadow-lg">
          <input
            ref={initInputRef}
            placeholder={localize('com_ui_command_usage_placeholder')}
            className="mb-1 w-full border-0 bg-surface-tertiary-alt p-2 text-sm focus:outline-none dark:text-gray-200"
            autoComplete="off"
            value={searchValue}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                setShowPromptsPopover(false);
                textAreaRef.current?.focus();
              }
              if (e.key === 'ArrowDown') {
                if (matches.length === 0) {
                  return;
                }
                setActiveIndex((prevIndex) => (prevIndex + 1) % matches.length);
              } else if (e.key === 'ArrowUp') {
                if (matches.length === 0) {
                  return;
                }
                setActiveIndex((prevIndex) => (prevIndex - 1 + matches.length) % matches.length);
              } else if (e.key === 'Enter' || e.key === 'Tab') {
                if (matches.length === 0) {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                  setOpen(false);
                  setShowPromptsPopover(false);
                  textAreaRef.current?.focus();
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
                handleSelect(matches[activeIndex] as SlashCommandOption | undefined, e);
              } else if (e.key === 'Backspace' && searchValue === '') {
                setOpen(false);
                setShowPromptsPopover(false);
                textAreaRef.current?.focus();
              }
            }}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              timeoutRef.current = setTimeout(() => {
                setOpen(false);
                setShowPromptsPopover(false);
              }, 150);
            }}
          />
          {open && (isLoading || isSkillsLoading) && matches.length === 0 && (
            <div className="flex h-32 items-center justify-center text-text-primary">
              <Spinner />
            </div>
          )}
          {open && matches.length > 0 && (
            <div className="max-h-40">
              <AutoSizer disableHeight>
                {({ width }) => (
                  <List
                    width={width}
                    overscanRowCount={5}
                    rowHeight={ROW_HEIGHT}
                    rowCount={matches.length}
                    rowRenderer={rowRenderer}
                    scrollToIndex={activeIndex}
                    height={Math.min(matches.length * ROW_HEIGHT, 160)}
                  />
                )}
              </AutoSizer>
            </div>
          )}
        </div>
      </div>
    </PopoverContainer>
  );
}

export default memo(PromptsCommand);
