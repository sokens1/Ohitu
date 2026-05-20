
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  Users, 
  BarChart3, 
  MessageSquare, 
  Calendar,
  LogOut,
  Menu,
  Megaphone,
  Bell,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  Check,
  Trash2,
  IdCard,
  FileText
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNotifications } from '@/contexts/NotificationContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import NetworkIndicator from '@/components/NetworkIndicator';


interface LayoutProps {
  children: React.ReactNode;
}

const getNotificationIcon = (type: 'info' | 'success' | 'warning' | 'error') => {
  switch (type) {
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
  } = useNotifications();

  const menuItems = [
    { icon: Home, label: 'Tableau de Bord', path: '/dashboard' },
    { icon: Calendar, label: 'Élections', path: '/elections' },
    // { icon: IdCard, label: 'Inscrits', path: '/voters' },
    { icon: BarChart3, label: 'Résultats', path: '/results' },
    { icon: Users, label: 'Gestion Utilisateurs', path: '/users' },
    { icon: FileText, label: 'Piste d\'Audit', path: '/audit' },
    // { icon: Megaphone, label: 'Gestion Campagne', path: '/campaign' }, // Désactivé
    // { icon: MessageSquare, label: 'Conversations', path: '/conversations' }, // Désactivé
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Sur mobile, fermer automatiquement la sidebar
  React.useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isMobile]);

  return (
    <div className="min-h-screen bg-gov-gray-light flex w-full">
      {/* Sidebar */}
      <div className={`${
        isMobile 
          ? sidebarOpen ? 'fixed inset-y-0 left-0 z-50 w-64' : 'hidden'
          : sidebarOpen ? 'w-64 flex-shrink-0' : 'w-16 flex-shrink-0'
      } transition-all duration-300 gov-bg-primary text-white flex flex-col h-screen sticky top-0`}>
        <div className="flex-shrink-0 p-3 sm:p-4 border-b border-gov-blue-light">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
              <img src="/favicon.ico" alt="Logo iKADI" className="w-6 h-6 object-contain" />
            </div>
            {(sidebarOpen || isMobile) && (
              <div className="min-w-0">
                <h1 className="font-bold text-lg truncate">o'Hitu</h1>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-2 sm:p-4 overflow-y-auto">
          <ul className="space-y-1 sm:space-y-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={() => isMobile && setSidebarOpen(false)}
                  className={`flex items-center space-x-3 p-2 sm:p-3 rounded-lg transition-colors ${
                    location.pathname === item.path
                      ? 'bg-white text-gov-blue'
                      : 'text-blue-100 hover:bg-gov-blue-light'
                  }`}
                >
                  <item.icon size={20} className="flex-shrink-0" />
                  {(sidebarOpen || isMobile) && (
                    <span className="text-sm font-medium truncate">{item.label}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex-shrink-0 p-2 sm:p-4 border-t border-gov-blue-light">
          {(sidebarOpen || isMobile) && (
            <div className="mb-3">
              <p className="text-blue-100 text-sm font-medium truncate">{user?.name}</p>
              <p className="text-blue-200 text-xs truncate capitalize">
                {user?.role?.replace('-', ' ')}
              </p>
            </div>
          )}
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="text-blue-100 hover:bg-gov-blue-light w-full justify-start"
          >
            <LogOut size={16} className="flex-shrink-0" />
            {(sidebarOpen || isMobile) && <span className="ml-2 truncate">Déconnexion</span>}
          </Button>
        </div>
      </div>

      {/* Overlay pour mobile */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 bg-white border-b border-gray-200 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <Button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              variant="ghost"
              size="sm"
              className="text-gov-gray"
            >
              <Menu size={20} />
            </Button>
            
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              {/* Indicateur de qualité réseau */}
              <NetworkIndicator />
              {/* Icône de notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative text-gov-gray hover:bg-gray-100 rounded-full">
                    <Bell size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent sideOffset={8} align="end" className="z-50 w-80 max-h-[500px] overflow-y-auto rounded-md border bg-white p-2 shadow-lg">
                  <DropdownMenuLabel className="flex items-center justify-between px-2 py-1.5 text-sm font-medium text-gray-700">
                    <span>Notifications ({unreadCount} non lues)</span>
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-blue-600 hover:bg-blue-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAllAsRead();
                        }}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Tout marquer comme lu
                      </Button>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length === 0 ? (
                    <div className="text-sm text-gray-500 p-3 text-center">
                      Aucune notification
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className={`flex items-start gap-3 px-3 py-2 rounded-md focus:bg-gray-50 outline-none cursor-pointer ${!notification.read ? 'bg-blue-50' : ''}`}
                        onClick={() => {
                          markAsRead(notification.id);
                          const t = notification.title?.toLowerCase() || '';
                          if (t.includes('pv')) {
                            navigate('/results');
                          } else if (t.includes('élection') || t.includes('election')) {
                            navigate('/elections');
                          } else if (t.includes('électeur') || t.includes('electeur') || t.includes('votant')) {
                            navigate('/voters');
                          }
                        }}
                      >
                        <div className="mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <p className="font-medium text-sm text-gray-900">
                              {notification.title}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 ml-2 text-gray-400 hover:text-red-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNotification(notification.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDistanceToNow(new Date(notification.date), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              
              <div className="text-right min-w-0 hidden sm:block">
                <p className="font-medium text-gov-gray text-sm truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 capitalize truncate">
                  {user?.role?.replace('-', ' ')}
                </p>
              </div>
              <div className="w-8 h-8 bg-gov-blue rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                <img src="/favicon.ico" alt="Logo iKADI" className="w-6 h-6 object-contain" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto">
          <div className="max-w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
