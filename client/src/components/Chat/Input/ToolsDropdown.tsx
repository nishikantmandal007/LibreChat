import React, { useState, useMemo, useCallback, useEffect } from 'react';
import * as Ariakit from '@ariakit/react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import {
  TooltipAnchor,
  DropdownPopup,
  PinIcon,
} from '@librechat/client';
import { FileText, Globe, ImageIcon, Languages, Settings, Settings2 } from 'lucide-react';
import type { MenuItemProps } from '~/common';
import {
  AuthType,
  EModelEndpoint,
  Permissions,
  PermissionTypes,
  defaultAgentCapabilities,
} from 'librechat-data-provider';
import { useLocalize, useHasAccess, useAgentCapabilities, useNewConvo } from '~/hooks';
import { useBadgeRowContext } from '~/Providers';
import { MDP_SUPPORTED_LANGUAGES, normalizeMdpLanguage } from '~/services/mdp/language';
import { IMAGE_GEN_MODEL_KEY } from '~/services/mdp/modelConfig';
import store from '~/store';
import { cn } from '~/utils';

interface ToolsDropdownProps {
  disabled?: boolean;
}

const MDP_LANGUAGE_LABEL = 'Language';

const ToolsDropdown = ({ disabled }: ToolsDropdownProps) => {
  const localize = useLocalize();
  const context = useBadgeRowContext();

  const { webSearchEnabled } = useAgentCapabilities(
    context?.agentsConfig?.capabilities ?? defaultAgentCapabilities,
  );

  const canUseWebSearch = useHasAccess({
    permissionType: PermissionTypes.WEB_SEARCH,
    permission: Permissions.USE,
  });

  const [isPopoverActive, setIsPopoverActive] = useState(false);
  const { newConversation } = useNewConvo();
  const setImageGenEnabled = useSetRecoilState(store.imageGenEnabled);
  const setDocumentExportEnabled = useSetRecoilState(store.documentExportEnabled);
  const [isDocumentExportPinned, setIsDocumentExportPinned] = useRecoilState(
    store.documentExportPinned,
  );
  const [mdpLanguage, setMdpLanguage] = useRecoilState(store.mdpAnonymizationLanguage);
  const selectedMdpLanguage = normalizeMdpLanguage(mdpLanguage);
  const isDisabled = disabled ?? false;
  const { webSearch, searchApiKeyForm } = context ?? {};

  const { setIsDialogOpen: setIsSearchDialogOpen, menuTriggerRef: searchMenuTriggerRef } =
    searchApiKeyForm ?? {};
  const {
    isPinned: isSearchPinned,
    setIsPinned: setIsSearchPinned,
    authData: webSearchAuthData,
  } = webSearch ?? {};

  const showWebSearchSettings = useMemo(() => {
    const authTypes = webSearchAuthData?.authTypes ?? [];
    if (authTypes.length === 0) return true;
    return !authTypes.every(([, authType]) => authType === AuthType.SYSTEM_DEFINED);
  }, [webSearchAuthData?.authTypes]);

  const handleWebSearchToggle = useCallback(() => {
    const newValue = !webSearch?.toggleState;
    webSearch?.debouncedChange({ value: newValue });
  }, [webSearch]);

  const handleImageGenClick = useCallback(() => {
    setImageGenEnabled(true);
    newConversation({
      template: { endpoint: EModelEndpoint.openAI, model: IMAGE_GEN_MODEL_KEY },
      buildDefault: false,
    });
  }, [newConversation, setImageGenEnabled]);

  const handleDocumentExportToggle = useCallback(() => {
    setDocumentExportEnabled((prev) => !prev);
  }, [setDocumentExportEnabled]);

  useEffect(() => {
    if (mdpLanguage !== selectedMdpLanguage) {
      setMdpLanguage(selectedMdpLanguage);
    }
  }, [mdpLanguage, selectedMdpLanguage, setMdpLanguage]);

  const dropdownItems: MenuItemProps[] = [];

  if (canUseWebSearch && webSearchEnabled) {
    dropdownItems.push({
      onClick: handleWebSearchToggle,
      hideOnClick: false,
      render: (props) => (
        <div {...props}>
          <div className="flex items-center gap-2">
            <Globe className="icon-md" aria-hidden="true" />
            <span>{localize('com_ui_web_search')}</span>
          </div>
          <div className="flex items-center gap-1">
            {showWebSearchSettings && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSearchDialogOpen?.(true);
                }}
                className={cn(
                  'rounded p-1 transition-all duration-200',
                  'hover:bg-surface-secondary hover:shadow-sm',
                  'text-text-secondary hover:text-text-primary',
                )}
                aria-label="Configure web search"
                ref={searchMenuTriggerRef}
              >
                <div className="h-4 w-4">
                  <Settings className="h-4 w-4" aria-hidden="true" />
                </div>
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsSearchPinned?.(!isSearchPinned);
              }}
              className={cn(
                'rounded p-1 transition-all duration-200',
                'hover:bg-surface-secondary hover:shadow-sm',
                !isSearchPinned && 'text-text-secondary hover:text-text-primary',
              )}
              aria-label={isSearchPinned ? 'Unpin' : 'Pin'}
            >
              <div className="h-4 w-4">
                <PinIcon unpin={isSearchPinned} />
              </div>
            </button>
          </div>
        </div>
      ),
    });
  }

  dropdownItems.push({
    hideOnClick: false,
    render: (props) => (
      <div
        {...props}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="flex items-center gap-2">
          <Languages className="icon-md" aria-hidden="true" />
          <span>{MDP_LANGUAGE_LABEL}</span>
        </div>
        <div
          className="flex h-8 items-center rounded-lg border border-border-light bg-surface-secondary p-0.5"
          role="group"
          aria-label={MDP_LANGUAGE_LABEL}
        >
          {MDP_SUPPORTED_LANGUAGES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={selectedMdpLanguage === option.value}
              className={cn(
                'h-7 rounded-md px-2.5 text-sm font-medium transition-colors',
                selectedMdpLanguage === option.value
                  ? 'bg-surface-primary text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary',
              )}
              onClick={(e) => {
                e.stopPropagation();
                setMdpLanguage(normalizeMdpLanguage(option.value));
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    ),
  });

  dropdownItems.push({
    onClick: handleImageGenClick,
    hideOnClick: true,
    render: (props) => (
      <div {...props}>
        <div className="flex items-center gap-2">
          <ImageIcon className="icon-md" aria-hidden="true" />
          <span>{localize('com_ui_generate_image')}</span>
        </div>
      </div>
    ),
  });

  dropdownItems.push({
    onClick: handleDocumentExportToggle,
    hideOnClick: false,
    render: (props) => (
      <div {...props}>
        <div className="flex items-center gap-2">
          <FileText className="icon-md" aria-hidden="true" />
          <span>{localize('com_ui_document_export')}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsDocumentExportPinned((prev) => !prev);
            }}
            className={cn(
              'rounded p-1 transition-all duration-200',
              'hover:bg-surface-secondary hover:shadow-sm',
              !isDocumentExportPinned && 'text-text-secondary hover:text-text-primary',
            )}
            aria-label={isDocumentExportPinned ? 'Unpin' : 'Pin'}
          >
            <div className="h-4 w-4">
              <PinIcon unpin={isDocumentExportPinned} />
            </div>
          </button>
        </div>
      </div>
    ),
  });

  if (dropdownItems.length === 0) {
    return null;
  }

  const menuTrigger = (
    <TooltipAnchor
      render={
        <Ariakit.MenuButton
          disabled={isDisabled}
          id="tools-dropdown-button"
          aria-label="Tools Options"
          className={cn(
            'flex size-10 items-center justify-center rounded-full p-1 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-opacity-50',
            isPopoverActive && 'bg-surface-hover',
          )}
        >
          <div className="flex w-full items-center justify-center gap-2">
            <Settings2 className="size-5" aria-hidden="true" />
          </div>
        </Ariakit.MenuButton>
      }
      id="tools-dropdown-button"
      description={localize('com_ui_tools')}
      disabled={isDisabled}
    />
  );

  return (
    <DropdownPopup
      itemClassName="flex w-full cursor-pointer rounded-lg items-center justify-between hover:bg-surface-hover gap-5"
      menuId="tools-dropdown-menu"
      isOpen={isPopoverActive}
      setIsOpen={setIsPopoverActive}
      modal={true}
      unmountOnHide={true}
      trigger={menuTrigger}
      items={dropdownItems}
      iconClassName="mr-0"
    />
  );
};

export default React.memo(ToolsDropdown);
