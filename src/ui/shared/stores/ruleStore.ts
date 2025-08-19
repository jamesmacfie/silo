import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import browser from 'webextension-polyfill';
import type { Rule } from '@/shared/types';
import { MESSAGE_TYPES } from '@/shared/constants';

interface RuleState {
  rules: Rule[];
  loading: boolean;
  error?: string;
  
  actions: {
    load: () => Promise<void>;
    create: (rule: Partial<Rule>) => Promise<Rule>;
    update: (id: string, updates: Partial<Rule>) => Promise<void>;
    delete: (id: string) => Promise<void>;
    testPattern: (url: string, pattern: string, matchType: string) => Promise<boolean>;
    clearError: () => void;
  };
}

export const useRuleStore = create<RuleState>()(
  subscribeWithSelector((set, get) => ({
    rules: [],
    loading: false,
    error: undefined,
    
    actions: {
      load: async () => {
        set({ loading: true, error: undefined });
        
        try {
          const response = await browser.runtime.sendMessage({ 
            type: MESSAGE_TYPES.GET_RULES 
          });
          
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to fetch rules');
          }
          
          const rules = response.data || [];
          
          // Validate each rule (similar to existing useRules hook)
          rules.forEach((rule: Rule, index: number) => {
            if (!rule.metadata) {
              // Could add warning handling here
            }
            if (typeof rule.priority !== 'number') {
              // Could add validation handling here
            }
            if (!rule.ruleType || !['include', 'exclude', 'restrict'].includes(rule.ruleType)) {
              // Could add validation handling here
            }
            if (!rule.matchType || !['exact', 'domain', 'glob', 'regex'].includes(rule.matchType)) {
              // Could add validation handling here
            }
          });
          
          set({ rules, loading: false });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            loading: false 
          });
        }
      },
      
      create: async (rule) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.CREATE_RULE,
            payload: rule,
          });
          
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to create rule');
          }
          
          // Add and sort by priority (higher priority first)
          set(state => {
            const newRules = [...state.rules, response.data];
            newRules.sort((a, b) => b.priority - a.priority);
            return { rules: newRules };
          });
          
          return response.data;
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error' });
          throw error;
        }
      },
      
      update: async (id, updates) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.UPDATE_RULE,
            payload: { id, updates },
          });
          
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to update rule');
          }
          
          // Optimistic update with re-sorting if priority changed
          set(state => {
            let updatedRules = state.rules.map(r => 
              r.id === id ? { ...r, ...updates, modified: Date.now() } : r
            );
            
            // Re-sort if priority was updated
            if (updates.priority !== undefined) {
              updatedRules.sort((a, b) => b.priority - a.priority);
            }
            
            return { rules: updatedRules };
          });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error' });
          await get().actions.load();
          throw error;
        }
      },
      
      delete: async (id) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.DELETE_RULE,
            payload: { id },
          });
          
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to delete rule');
          }
          
          set(state => ({
            rules: state.rules.filter(r => r.id !== id)
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error' });
          await get().actions.load();
          throw error;
        }
      },
      
      testPattern: async (url, pattern, matchType) => {
        try {
          const response = await browser.runtime.sendMessage({
            type: MESSAGE_TYPES.TEST_PATTERN,
            payload: { url, pattern, matchType },
          });
          
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to test pattern');
          }
          
          return response.data?.matches || false;
        } catch (error) {
          throw error;
        }
      },
      
      clearError: () => set({ error: undefined }),
    },
  }))
);

export const useRules = () => useRuleStore(state => state.rules);
export const useRuleActions = () => useRuleStore(state => state.actions);
export const useRuleLoading = () => useRuleStore(state => state.loading);
export const useRuleError = () => useRuleStore(state => state.error);