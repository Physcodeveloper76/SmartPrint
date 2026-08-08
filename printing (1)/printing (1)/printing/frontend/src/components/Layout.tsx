import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/upload': 'Upload & Print',
  '/orders': 'My Orders',
  '/admin': 'Admin Dashboard',
  '/admin/orders': 'All Orders',
  '/admin/queue': 'Print Queue',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const basePath = '/' + location.pathname.split('/').filter(Boolean).slice(0, 2).join('/');
  const title = pageTitles[location.pathname] || pageTitles[basePath] || 'SmartPrint';

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header title={title} onMenuClick={() => setSidebarOpen(true)} />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
