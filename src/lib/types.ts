export type Website = {
  id: string;
  url: string;
  label: string;
  checkInterval: number; // in minutes
  lastChecked: Date;
  status: 'active' | 'inactive' | 'error';
};
