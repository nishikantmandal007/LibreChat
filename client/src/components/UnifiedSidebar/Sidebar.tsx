import { memo } from 'react';
import type { NavLink } from '~/common';
import AccountSettings from '~/components/Nav/AccountSettings';
import SidePanelNav from '~/components/SidePanel/Nav';
import ExpandedPanel from './ExpandedPanel';

function Sidebar({
  links,
  expanded,
  onCollapse,
  onExpand,
  onResizeStart,
  onResizeKeyboard,
}: {
  links: NavLink[];
  expanded: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onResizeKeyboard: (direction: 'shrink' | 'grow') => void;
}) {
  if (expanded) {
    return (
      <div className="aisafe-sidebar-shell flex h-full w-full flex-col overflow-hidden">
        <ExpandedPanel
          links={links}
          expanded={expanded}
          onCollapse={onCollapse}
          onExpand={onExpand}
        />
        <nav className="aisafe-sidebar-nav min-h-0 flex-1 overflow-hidden">
          <SidePanelNav links={links} />
        </nav>
        <div className="aisafe-sidebar-footer border-t p-2">
          <AccountSettings />
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          tabIndex={0}
          className="absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize transition-colors hover:bg-border-medium active:bg-border-heavy"
          onMouseDown={onResizeStart}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              onResizeKeyboard('shrink');
            } else if (e.key === 'ArrowRight') {
              onResizeKeyboard('grow');
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="aisafe-sidebar-shell flex h-full w-full flex-col items-center overflow-hidden">
      <ExpandedPanel
        links={links}
        expanded={expanded}
        onCollapse={onCollapse}
        onExpand={onExpand}
      />
    </div>
  );
}

export default memo(Sidebar);
