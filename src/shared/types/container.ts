export interface Container {
  id: string;
  name: string;
  icon: string;
  color: string;
  cookieStoreId: string;
  created: number;
  modified: number;
  temporary: boolean;
  syncEnabled: boolean;
  metadata?: {
    description?: string;
    customIcon?: string;
    lifetime?: 'permanent' | 'untilLastTab';
    categories?: string[];
    notes?: string;
  };
}

export interface CreateContainerRequest {
  name: string;
  icon?: string;
  color?: string;
  temporary?: boolean;
  syncEnabled?: boolean;
  metadata?: {
    description?: string;
    customIcon?: string;
    lifetime?: 'permanent' | 'untilLastTab';
    categories?: string[];
    notes?: string;
  };
}