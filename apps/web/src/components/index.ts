// Export all components from a single file for easy imports
export { Logo } from './Logo';
export { Spinner } from './Spinner';
export { GoogleSignInButton } from './GoogleSignInButton';
export { UserMenu } from './UserMenu';
export { LoginModal } from './LoginModal';
export { GatedButton } from './GatedButton';
export { AppShell, NAV, MOBILE_NAV, type AppShellProps, type NavDestination } from './AppShell';
export { TopBar, type TopBarProps } from './TopBar';
export { AccountMenu, type AccountMenuProps } from './AccountMenu';
export { SupportButton, type SupportButtonProps } from './SupportButton';
export { CapturePopover, type CapturePopoverProps } from './CapturePopover';
export { CapturePreview, type CapturePreviewProps } from './CapturePreview';
export { MobileBottomBar, type MobileBottomBarProps } from './MobileBottomBar';
export { VideoPlayer } from './VideoPlayer';
export { LandingNavbar, LANDING_LINKS, SITE_LINKS, type NavLinkSpec } from './LandingNavbar';
export { LandingFooter } from './LandingFooter';
export { AddToChromeButton } from './AddToChromeButton';
export { default as GoogleAd } from './GoogleAd';
export { default as ProtectedRoute } from './ProtectedRoute';
export {
    default as SEO,
    // SEO C1/W4: callers that build their own JSON-LD cite the same card asset.
    DEFAULT_OG_IMAGE,
    DEFAULT_OG_IMAGE_WIDTH,
    DEFAULT_OG_IMAGE_HEIGHT,
    SITE_URL,
} from './SEO';
export { CookieConsent } from './CookieConsent';
// SEO W7
export { AdSenseLoader } from './AdSenseLoader';
