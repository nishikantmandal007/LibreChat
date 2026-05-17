import { useState, memo } from 'react';
import { useRecoilValue } from 'recoil';
import { useDefaultLayout } from 'react-resizable-panels';
import { ResizablePanel, ResizablePanelGroup, ResizableHandleAlt, useMediaQuery } from '@librechat/client';
import { activeSourceState } from '~/store/sources';
import ArtifactsPanel from './ArtifactsPanel';
import SourcePanel from './SourcePanel';

const PANEL_IDS_SINGLE = ['messages-view'];
const PANEL_IDS_SPLIT = ['messages-view', 'artifacts-panel'];

interface SidePanelProps {
  artifacts?: React.ReactNode;
  children: React.ReactNode;
}

const SidePanelGroup = memo(({ artifacts, children }: SidePanelProps) => {
  const [shouldRenderArtifacts, setShouldRenderArtifacts] = useState(artifacts != null);
  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  const activeSource = useRecoilValue(activeSourceState);

  const hasSideContent = artifacts != null || activeSource != null;

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'side-panel-layout',
    panelIds: hasSideContent ? PANEL_IDS_SPLIT : PANEL_IDS_SINGLE,
    storage: localStorage,
  });

  const minSizeMain = hasSideContent ? '15' : '30';

  return (
    <>
      <ResizablePanelGroup
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        className="relative flex-1 bg-presentation"
      >
        <ResizablePanel defaultSize="50" minSize={minSizeMain} id="messages-view">
          {children}
        </ResizablePanel>

        {!isSmallScreen && artifacts != null && (
          <ArtifactsPanel
            artifacts={artifacts}
            minSizeMain={minSizeMain}
            shouldRender={shouldRenderArtifacts}
            onRenderChange={setShouldRenderArtifacts}
          />
        )}

        {!isSmallScreen && activeSource != null && artifacts == null && (
          <>
            <ResizableHandleAlt withHandle className="bg-border-medium text-text-primary" />
            <ResizablePanel defaultSize="40" maxSize="60" minSize="20" id="source-panel">
              <div className="h-full min-w-[300px] overflow-hidden">
                <SourcePanel />
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      {artifacts != null && isSmallScreen && (
        <div className="fixed inset-0 z-[100]">{artifacts}</div>
      )}
      {activeSource != null && isSmallScreen && (
        <div className="fixed inset-0 z-[100] bg-surface-primary">
          <SourcePanel />
        </div>
      )}
    </>
  );
});

SidePanelGroup.displayName = 'SidePanelGroup';

export default SidePanelGroup;
