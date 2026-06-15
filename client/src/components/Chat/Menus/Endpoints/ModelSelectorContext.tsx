import debounce from 'lodash/debounce';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogTitle,
  OGDialogDescription,
  OGDialogFooter,
} from '@librechat/client';
import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useSetRecoilState } from 'recoil';
import { EModelEndpoint, isAgentsEndpoint, isAssistantsEndpoint } from 'librechat-data-provider';
import type * as t from 'librechat-data-provider';
import type { Endpoint, SelectedValues } from '~/common';
import {
  useAgentDefaultPermissionLevel,
  useSelectorEffects,
  useKeyDialog,
  useEndpoints,
  useLocalize,
} from '~/hooks';
import { useAgentsMapContext, useAssistantsMapContext, useLiveAnnouncer } from '~/Providers';
import { useGetEndpointsQuery, useListAgentsQuery } from '~/data-provider';
import { useModelSelectorChatContext } from './ModelSelectorChatContext';
import useSelectMention from '~/hooks/Input/useSelectMention';
import { shouldBlockModelSwitch, type ModelSelection } from './modelSwitchGuard';
import { filterItems } from './utils';
import { IMAGE_GEN_MODEL_KEY, isImageGenModel } from '~/services/mdp/modelConfig';
import store from '~/store';

type ModelSelectorContextType = {
  // State
  searchValue: string;
  selectedValues: SelectedValues;
  endpointSearchValues: Record<string, string>;
  searchResults: (t.TModelSpec | Endpoint)[] | null;
  // LibreChat
  modelSpecs: t.TModelSpec[];
  mappedEndpoints: Endpoint[];
  agentsMap: t.TAgentsMap | undefined;
  assistantsMap: t.TAssistantsMap | undefined;
  endpointsConfig: t.TEndpointsConfig;

  // Functions
  endpointRequiresUserKey: (endpoint: string) => boolean;
  setSelectedValues: React.Dispatch<React.SetStateAction<SelectedValues>>;
  setSearchValue: (value: string) => void;
  setEndpointSearchValue: (endpoint: string, value: string) => void;
  handleSelectSpec: (spec: t.TModelSpec) => void;
  handleSelectEndpoint: (endpoint: Endpoint) => void;
  handleSelectModel: (endpoint: Endpoint, model: string) => void;
} & ReturnType<typeof useKeyDialog>;

const ModelSelectorContext = createContext<ModelSelectorContextType | undefined>(undefined);

export function useModelSelectorContext() {
  const context = useContext(ModelSelectorContext);
  if (context === undefined) {
    throw new Error('useModelSelectorContext must be used within a ModelSelectorProvider');
  }
  return context;
}

interface ModelSelectorProviderProps {
  children: React.ReactNode;
  startupConfig: t.TStartupConfig | undefined;
}

export function ModelSelectorProvider({ children, startupConfig }: ModelSelectorProviderProps) {
  const agentsMap = useAgentsMapContext();
  const assistantsMap = useAssistantsMapContext();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { endpoint, model, spec, agent_id, assistant_id, getConversation, newConversation } =
    useModelSelectorChatContext();
  const localize = useLocalize();
  const { announcePolite } = useLiveAnnouncer();
  const setImageGenEnabled = useSetRecoilState(store.imageGenEnabled);
  const modelSpecs = useMemo(() => {
    const specs = startupConfig?.modelSpecs?.list ?? [];
    if (!agentsMap) {
      return specs;
    }

    /**
     * Filter modelSpecs to only include agents the user has access to.
     * Use agentsMap which already contains permission-filtered agents (consistent with other components).
     */
    return specs.filter((spec) => {
      if (spec.preset?.endpoint === EModelEndpoint.agents && spec.preset?.agent_id) {
        return spec.preset.agent_id in agentsMap;
      }
      /** Keep non-agent modelSpecs */
      return true;
    });
  }, [startupConfig, agentsMap]);

  const permissionLevel = useAgentDefaultPermissionLevel();
  const { data: agents = null } = useListAgentsQuery(
    { requiredPermission: permissionLevel },
    {
      select: (data) => data?.data,
    },
  );

  const { mappedEndpoints, endpointRequiresUserKey } = useEndpoints({
    agents,
    assistantsMap,
    startupConfig,
    endpointsConfig,
  });

  const getModelDisplayName = useCallback(
    (endpoint: Endpoint, model: string): string => {
      if (isAgentsEndpoint(endpoint.value)) {
        return endpoint.agentNames?.[model] ?? agentsMap?.[model]?.name ?? model;
      }

      if (isAssistantsEndpoint(endpoint.value)) {
        return endpoint.assistantNames?.[model] ?? model;
      }

      return endpoint.modelLabels?.[model] ?? model;
    },
    [agentsMap],
  );

  const { onSelectEndpoint, onSelectSpec } = useSelectMention({
    // presets,
    modelSpecs,
    getConversation,
    assistantsMap,
    endpointsConfig,
    newConversation,
    returnHandlers: true,
  });

  const validSpec = spec && modelSpecs.some((item) => item.name === spec) ? spec : '';

  // State
  const [selectedValues, setSelectedValues] = useState<SelectedValues>(() => {
    let initialModel = model || '';
    if (isAgentsEndpoint(endpoint) && agent_id) {
      initialModel = agent_id;
    } else if (isAssistantsEndpoint(endpoint) && assistant_id) {
      initialModel = assistant_id;
    }
    return {
      endpoint: endpoint || '',
      model: initialModel,
      modelSpec: validSpec,
    };
  });
  useSelectorEffects({
    agentsMap,
    conversation: endpoint
      ? ({
          endpoint: endpoint ?? null,
          model: model ?? null,
          spec: validSpec || null,
          agent_id: agent_id ?? null,
          assistant_id: assistant_id ?? null,
        } as any)
      : null,
    assistantsMap,
    setSelectedValues,
  });

  const [searchValue, setSearchValueState] = useState('');
  const [endpointSearchValues, setEndpointSearchValues] = useState<Record<string, string>>({});

  const keyProps = useKeyDialog();

  /** Memoized search results */
  const searchResults = useMemo(() => {
    if (!searchValue) {
      return null;
    }
    const allItems = [...modelSpecs, ...mappedEndpoints];
    return filterItems(allItems, searchValue, agentsMap, assistantsMap || {});
  }, [searchValue, modelSpecs, mappedEndpoints, agentsMap, assistantsMap]);

  const setDebouncedSearchValue = useMemo(
    () =>
      debounce((value: string) => {
        setSearchValueState(value);
      }, 200),
    [],
  );
  const setEndpointSearchValue = useCallback((endpoint: string, value: string) => {
    setEndpointSearchValues((prev) => ({
      ...prev,
      [endpoint]: value,
    }));
  }, []);

  const getCurrentConversationId = useCallback(
    () => getConversation()?.conversationId ?? null,
    [getConversation],
  );

  const isModelSwitchBlocked = useCallback(
    (next: ModelSelection) =>
      shouldBlockModelSwitch({
        conversationId: getCurrentConversationId(),
        current: selectedValues,
        next,
      }),
    [getCurrentConversationId, selectedValues],
  );

  const [pendingSwitch, setPendingSwitch] = useState<{
    targetName: string;
    apply: () => void;
  } | null>(null);

  const showModelSwitchBlocked = useCallback((targetName: string, applySwitch: () => void) => {
    setPendingSwitch({ targetName, apply: applySwitch });
  }, []);

  const confirmModelSwitch = useCallback(() => {
    if (pendingSwitch) {
      pendingSwitch.apply();
      setPendingSwitch(null);
    }
  }, [pendingSwitch]);

  const cancelModelSwitch = useCallback(() => {
    setPendingSwitch(null);
  }, []);

  const handleSelectSpec = useCallback(
    (spec: t.TModelSpec) => {
      setImageGenEnabled(false);
      let model = spec.preset.model ?? null;
      if (isAgentsEndpoint(spec.preset.endpoint)) {
        model = spec.preset.agent_id ?? '';
      } else if (isAssistantsEndpoint(spec.preset.endpoint)) {
        model = spec.preset.assistant_id ?? '';
      }

      const nextSelection = {
        endpoint: spec.preset.endpoint,
        model,
        modelSpec: spec.name,
      };
      if (isModelSwitchBlocked(nextSelection)) {
        showModelSwitchBlocked(spec.label ?? spec.name, () => {
          newConversation({
            template: {
              endpoint: spec.preset.endpoint as EModelEndpoint,
              model: model ?? undefined,
            },
          });
        });
        return;
      }

      onSelectSpec?.(spec);
      setSelectedValues(nextSelection);
    },
    [
      isModelSwitchBlocked,
      newConversation,
      onSelectSpec,
      setImageGenEnabled,
      showModelSwitchBlocked,
    ],
  );

  const handleSelectEndpoint = useCallback(
    (endpoint: Endpoint) => {
      if (!endpoint.hasModels) {
        const nextSelection = {
          endpoint: endpoint.value,
          model: '',
          modelSpec: '',
        };
        if (isModelSwitchBlocked(nextSelection)) {
          showModelSwitchBlocked(endpoint.label ?? endpoint.value, () => {
            newConversation({ template: { endpoint: endpoint.value as EModelEndpoint } });
          });
          return;
        }
        if (endpoint.value) {
          onSelectEndpoint?.(endpoint.value);
        }
        setSelectedValues(nextSelection);
      }
    },
    [isModelSwitchBlocked, newConversation, onSelectEndpoint, showModelSwitchBlocked],
  );

  const handleSelectModel = useCallback(
    (endpoint: Endpoint, model: string) => {
      /**
       * Selecting the image-generation model mirrors the sidebar "Generate Image"
       * action: enter image-gen mode and open its landing page instead of treating
       * it as a normal chat model.
       */
      if (isImageGenModel(model)) {
        setImageGenEnabled(true);
        setSelectedValues({ endpoint: endpoint.value, model, modelSpec: '' });
        newConversation({
          template: { endpoint: EModelEndpoint.openAI, model: IMAGE_GEN_MODEL_KEY },
          buildDefault: false,
        });
        return;
      }
      setImageGenEnabled(false);
      const modelDisplayName = getModelDisplayName(endpoint, model);
      const nextSelection = {
        endpoint: endpoint.value,
        model,
        modelSpec: '',
      };
      if (isModelSwitchBlocked(nextSelection)) {
        showModelSwitchBlocked(modelDisplayName, () => {
          newConversation({
            template: { endpoint: endpoint.value as EModelEndpoint, model },
            buildDefault: false,
          });
        });
        return;
      }

      if (isAgentsEndpoint(endpoint.value)) {
        onSelectEndpoint?.(endpoint.value, {
          agent_id: model,
          model: agentsMap?.[model]?.model ?? '',
        });
      } else if (isAssistantsEndpoint(endpoint.value)) {
        onSelectEndpoint?.(endpoint.value, {
          assistant_id: model,
          model: assistantsMap?.[endpoint.value]?.[model]?.model ?? '',
        });
      } else if (endpoint.value) {
        onSelectEndpoint?.(endpoint.value, { model });
      }
      setSelectedValues(nextSelection);

      const announcement = localize('com_ui_model_selected', { 0: modelDisplayName });
      announcePolite({ message: announcement, isStatus: true });
    },
    [
      agentsMap,
      announcePolite,
      assistantsMap,
      getModelDisplayName,
      isModelSwitchBlocked,
      localize,
      newConversation,
      onSelectEndpoint,
      setImageGenEnabled,
      showModelSwitchBlocked,
    ],
  );

  const value = useMemo(
    () => ({
      searchValue,
      searchResults,
      selectedValues,
      endpointSearchValues,
      agentsMap,
      modelSpecs,
      assistantsMap,
      mappedEndpoints,
      endpointsConfig,
      handleSelectSpec,
      handleSelectModel,
      setSelectedValues,
      handleSelectEndpoint,
      setEndpointSearchValue,
      endpointRequiresUserKey,
      setSearchValue: setDebouncedSearchValue,
      ...keyProps,
    }),
    [
      searchValue,
      searchResults,
      selectedValues,
      endpointSearchValues,
      agentsMap,
      modelSpecs,
      assistantsMap,
      mappedEndpoints,
      endpointsConfig,
      handleSelectSpec,
      handleSelectModel,
      setSelectedValues,
      handleSelectEndpoint,
      setEndpointSearchValue,
      endpointRequiresUserKey,
      setDebouncedSearchValue,
      keyProps,
    ],
  );

  return (
    <ModelSelectorContext.Provider value={value}>
      {children}
      <OGDialog
        open={pendingSwitch !== null}
        onOpenChange={(open) => {
          if (!open) cancelModelSwitch();
        }}
      >
        <OGDialogContent className="aisafe-glass-dialog w-11/12 max-w-md text-foreground">
          <OGDialogTitle>{localize('com_ui_switch_model')}</OGDialogTitle>
          <OGDialogDescription>
            {localize('com_ui_switch_model_start_new', {
              0: pendingSwitch?.targetName ?? localize('com_ui_this_model'),
            })}
          </OGDialogDescription>
          <OGDialogFooter>
            <Button variant="outline" onClick={cancelModelSwitch}>
              {localize('com_ui_no')}
            </Button>
            <Button onClick={confirmModelSwitch}>{localize('com_ui_yes_new_chat')}</Button>
          </OGDialogFooter>
        </OGDialogContent>
      </OGDialog>
    </ModelSelectorContext.Provider>
  );
}
