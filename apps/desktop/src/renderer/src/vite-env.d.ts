/// <reference types="vite/client" />

interface Window {
  beelite?: {
    versions: () => Promise<{
      chrome: string;
      electron: string;
      node: string;
    }>;
  };
}
