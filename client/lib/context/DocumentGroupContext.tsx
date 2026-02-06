'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// Define the document groups available in the system
export type DocumentGroupString = 'jfk' | 'rfk' | string;

// Define the document group object structure
export interface DocumentGroup {
  id: string;
  name: string;
  count?: number;
}

// The shape of our context
interface DocumentGroupContextType {
  enabledGroups: DocumentGroupString[];
  documentGroups: DocumentGroup[];
  toggleGroup: (group: DocumentGroupString) => void;
  isGroupEnabled: (group: DocumentGroupString) => boolean;
  addDocumentGroup: (group: DocumentGroupString) => void;
  refreshGroups: () => Promise<void>;
  isLoading: boolean;
}

// Create the context with a default value
const DocumentGroupContext = createContext<DocumentGroupContextType>({
  enabledGroups: [],
  documentGroups: [],
  toggleGroup: () => {},
  isGroupEnabled: () => false,
  addDocumentGroup: () => {},
  refreshGroups: async () => {},
  isLoading: true,
});

// Create a provider component
export function DocumentGroupProvider({ children }: { children: ReactNode }) {
  const [enabledGroups, setEnabledGroups] = useState<DocumentGroupString[]>([]);
  const [availableGroups, setAvailableGroups] = useState<DocumentGroupString[]>([]);
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Fetch available groups from the API
  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/docs/document-groups');
      if (response.ok) {
        const data = await response.json();
        if (data.groups && Array.isArray(data.groups)) {
          const newGroups = data.groups.map((g: DocumentGroup) => g.id);
          const newCounts: Record<string, number> = {};
          data.groups.forEach((g: DocumentGroup) => {
            newCounts[g.id] = g.count || 0;
          });
          
          setAvailableGroups(prev => {
            // Merge with existing groups to preserve any manually added ones
            const merged = new Set([...prev, ...newGroups]);
            return Array.from(merged);
          });
          setGroupCounts(newCounts);
          
          // Auto-enable newly discovered groups
          setEnabledGroups(prev => {
            if (prev.length === 0) {
              // No groups enabled yet - enable all
              return newGroups;
            }
            // Add any new groups that weren't previously known
            const currentSet = new Set(prev);
            const newlyDiscovered = newGroups.filter((g: string) => !currentSet.has(g));
            if (newlyDiscovered.length > 0) {
              return [...prev, ...newlyDiscovered];
            }
            return prev;
          });
        }
      }
    } catch (error) {
      console.error('Error fetching document groups:', error);
    } finally {
      setIsLoading(false);
      setHasInitialized(true);
    }
  };
  
  // Load from localStorage on initial render (client-side only)
  useEffect(() => {
    try {
      const storedGroups = localStorage.getItem('enabledDocumentGroups');
      if (storedGroups) {
        const parsed = JSON.parse(storedGroups);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEnabledGroups(parsed);
        }
      }
      
      const storedAvailableGroups = localStorage.getItem('availableDocumentGroups');
      if (storedAvailableGroups) {
        const parsed = JSON.parse(storedAvailableGroups);
        if (Array.isArray(parsed)) {
          setAvailableGroups(parsed);
        }
      }
    } catch (error) {
      console.error('Error loading document groups from localStorage:', error);
    }
    
    // Fetch groups from API after loading localStorage
    fetchGroups();
  }, []);
  
  // Save to localStorage whenever enabledGroups changes
  useEffect(() => {
    try {
      localStorage.setItem('enabledDocumentGroups', JSON.stringify(enabledGroups));
    } catch (error) {
      console.error('Error saving document groups to localStorage:', error);
    }
  }, [enabledGroups]);
  
  // Save available groups to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('availableDocumentGroups', JSON.stringify(availableGroups));
    } catch (error) {
      console.error('Error saving available document groups to localStorage:', error);
    }
  }, [availableGroups]);

  // Toggle a document group on/off
  const toggleGroup = (group: DocumentGroupString) => {
    setEnabledGroups(prevGroups => {
      if (prevGroups.includes(group)) {
        // If this would disable all groups, don't allow it
        if (prevGroups.length === 1) {
          return prevGroups;
        }
        return prevGroups.filter(g => g !== group);
      } else {
        return [...prevGroups, group];
      }
    });
  };

  // Check if a document group is enabled
  const isGroupEnabled = (group: DocumentGroupString) => {
    return enabledGroups.includes(group);
  };
  
  // Add a new document group to the available list
  const addDocumentGroup = (group: DocumentGroupString) => {
    if (!availableGroups.includes(group)) {
      setAvailableGroups(prev => [...prev, group]);
      // Also enable it by default
      if (!enabledGroups.includes(group)) {
        setEnabledGroups(prev => [...prev, group]);
      }
    }
  };

  // Convert string groups to DocumentGroup objects with counts
  const documentGroups: DocumentGroup[] = availableGroups.map(group => ({
    id: group,
    name: group.toUpperCase(),
    count: groupCounts[group] || 0,
  }));

  return (
    <DocumentGroupContext.Provider value={{ 
      enabledGroups, 
      documentGroups,
      toggleGroup, 
      isGroupEnabled,
      addDocumentGroup,
      refreshGroups: fetchGroups,
      isLoading,
    }}>
      {children}
    </DocumentGroupContext.Provider>
  );
}

// Create a custom hook for using the context
export function useDocumentGroups() {
  return useContext(DocumentGroupContext);
} 