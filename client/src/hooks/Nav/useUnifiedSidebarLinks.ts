import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { MessageCircle, Palette } from 'lucide-react';
import { useUserKeyQuery } from 'librechat-data-provider/react-query';
import { EModelEndpoint, getConfigDefaults, getEndpointField } from 'librechat-data-provider';
import type { TEndpointsConfig } from 'librechat-data-provider';
import type { NavLink } from '~/common';
import ConversationsSection from '~/components/UnifiedSidebar/ConversationsSection';
import { useGetEndpointsQuery, useGetStartupConfig } from '~/data-provider';
import useSideNavLinks from '~/hooks/Nav/useSideNavLinks';
import { IMAGE_GEN_MODEL_KEY } from '~/services/mdp/modelConfig';
import useNewConvo from '~/hooks/useNewConvo';
import store from '~/store';

const defaultInterface = getConfigDefaults().interface;

export default function useUnifiedSidebarLinks() {
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const endpoint = conversation?.endpoint;
  const { data: startupConfig } = useGetStartupConfig();
  const { data: endpointsConfig = {} as TEndpointsConfig } = useGetEndpointsQuery();

  const interfaceConfig = useMemo(
    () => startupConfig?.interface ?? defaultInterface,
    [startupConfig],
  );

  const endpointType = useMemo(
    () => getEndpointField(endpointsConfig, endpoint, 'type'),
    [endpoint, endpointsConfig],
  );

  const userProvidesKey = useMemo(
    () => !!(endpointsConfig?.[endpoint ?? '']?.userProvide ?? false),
    [endpointsConfig, endpoint],
  );

  const { data: keyExpiry = { expiresAt: undefined } } = useUserKeyQuery(endpoint ?? '');

  const keyProvided = useMemo(
    () => (userProvidesKey ? !!(keyExpiry.expiresAt ?? '') : true),
    [keyExpiry.expiresAt, userProvidesKey],
  );

  const { newConversation } = useNewConvo(0);
  const navigate = useNavigate();
  const setImageGenEnabled = useSetRecoilState(store.imageGenEnabled);

  const onConversationsClick = useCallback(() => {
    navigate('/chats');
  }, [navigate]);

  const onImageGenClick = useCallback(() => {
    setImageGenEnabled(true);
    newConversation({
      template: { endpoint: EModelEndpoint.openAI, model: IMAGE_GEN_MODEL_KEY },
      buildDefault: false,
    });
  }, [newConversation, setImageGenEnabled]);

  const sideNavLinks = useSideNavLinks({
    keyProvided,
    endpoint,
    endpointType,
    interfaceConfig,
    endpointsConfig,
    includeHidePanel: false,
  });

  const links = useMemo(() => {
    const conversationLink: NavLink = {
      title: 'com_ui_chat_history',
      label: '',
      icon: MessageCircle,
      id: 'conversations',
      Component: ConversationsSection,
      onClick: onConversationsClick,
    };

    const imageGenLink: NavLink = {
      title: 'com_ui_generate_image' as NavLink['title'],
      label: '',
      icon: Palette,
      id: 'image-gen',
      onClick: onImageGenClick,
    };

    const kept = new Set(['prompts', 'bookmarks', 'skills']);
    return [conversationLink, imageGenLink, ...sideNavLinks.filter(l => kept.has(l.id))];
  }, [sideNavLinks, onImageGenClick, onConversationsClick]);

  return links;
}
