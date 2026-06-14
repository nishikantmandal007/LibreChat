import { useState, memo, useRef } from 'react';
import * as Menu from '@ariakit/react/menu';
import { FileText, LogOut } from 'lucide-react';
import { LinkIcon, GearIcon, DropdownMenuSeparator, Avatar } from '@librechat/client';
import { MyFilesModal } from '~/components/Chat/Input/Files/MyFilesModal';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';
import Settings from './Settings';

function AccountSettings({ collapsed = false }: { collapsed?: boolean }) {
  const localize = useLocalize();
  const { user, isAuthenticated, logout } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const helpAndFaqURL =
    startupConfig?.helpAndFaqURL && startupConfig.helpAndFaqURL !== '/'
      ? startupConfig.helpAndFaqURL
      : 'https://www.mayadataprivacy.com/faq';
  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && startupConfig?.balance?.enabled,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const accountSettingsButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <Menu.MenuProvider>
      <Menu.MenuButton
        ref={accountSettingsButtonRef}
        aria-label={localize('com_nav_account_settings')}
        data-testid="nav-user"
        className={
          collapsed
            ? 'aisafe-sidebar-nav-item flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200 aria-[expanded=true]:bg-white/[0.22]'
            : 'aisafe-sidebar-nav-item flex h-auto w-full items-center gap-2 rounded-xl p-2 text-[0.9375rem] leading-5 transition-all duration-200 ease-in-out aria-[expanded=true]:bg-white/[0.22]'
        }
      >
        <div
          className={collapsed ? 'size-9 flex-shrink-0' : '-ml-0.9 -mt-0.8 h-8 w-8 flex-shrink-0'}
        >
          <div className="relative flex">
            <Avatar user={user} size={collapsed ? 36 : 32} />
          </div>
        </div>
        {!collapsed && (
          <div
            className="mt-2 grow overflow-hidden text-ellipsis whitespace-nowrap text-left text-text-primary"
            style={{ marginTop: '0', marginLeft: '0' }}
          >
            {user?.name ?? user?.username ?? localize('com_nav_user')}
          </div>
        )}
      </Menu.MenuButton>
      <Menu.Menu
        portal
        className="account-settings-popover popover-ui z-[125] w-[305px] rounded-lg text-[0.9375rem] leading-5 md:w-[244px]"
        placement={collapsed ? 'right-end' : undefined}
        style={{
          transformOrigin: collapsed ? 'left bottom' : 'bottom',
          translate: collapsed ? '4px 0' : '0 -4px',
        }}
      >
        {startupConfig?.balance?.enabled === true && balanceQuery.data != null && (
          <>
            <div
              className="text-token-text-secondary ml-3 mr-2 py-2 text-[0.9375rem] leading-5"
              role="note"
            >
              {localize('com_nav_balance')}:{' '}
              {new Intl.NumberFormat().format(Math.round(balanceQuery.data.tokenCredits))}
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <Menu.MenuItem
          onClick={() => setShowFiles(true)}
          className="select-item text-[0.9375rem] leading-5"
        >
          <FileText className="icon-md" aria-hidden="true" />
          {localize('com_nav_my_files')}
        </Menu.MenuItem>
        <Menu.MenuItem
          onClick={() => {
            window.open(helpAndFaqURL, '_blank', 'noopener,noreferrer');
          }}
          className="select-item text-[0.9375rem] leading-5"
        >
          <LinkIcon aria-hidden="true" />
          {localize('com_nav_help_faq')}
        </Menu.MenuItem>
        <Menu.MenuItem
          onClick={() => setShowSettings(true)}
          className="select-item text-[0.9375rem] leading-5"
        >
          <GearIcon className="icon-md" aria-hidden="true" />
          {localize('com_nav_settings')}
        </Menu.MenuItem>
        <Menu.MenuItem onClick={() => logout()} className="select-item text-[0.9375rem] leading-5">
          <LogOut className="icon-md" aria-hidden="true" />
          {localize('com_nav_log_out')}
        </Menu.MenuItem>
      </Menu.Menu>
      {showFiles && (
        <MyFilesModal
          open={showFiles}
          onOpenChange={setShowFiles}
          triggerRef={accountSettingsButtonRef}
        />
      )}
      {showSettings && <Settings open={showSettings} onOpenChange={setShowSettings} />}
    </Menu.MenuProvider>
  );
}

export default memo(AccountSettings);
