'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { trpc } from '@/lib/trpc';

interface AdminEditContextType {
  isAdmin: boolean;
}

const AdminEditContext = createContext<AdminEditContextType>({ isAdmin: false });

export function useAdminEdit() {
  return useContext(AdminEditContext);
}

export function AdminEditProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    trpc.admin.checkAuth.query().then((res) => {
      setIsAdmin(res.isAdmin);
    }).catch(() => {
      setIsAdmin(false);
    });
  }, []);

  return (
    <AdminEditContext.Provider value={{ isAdmin }}>
      {children}
    </AdminEditContext.Provider>
  );
}
