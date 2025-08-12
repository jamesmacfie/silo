import { useQuery, useQueryClient } from '@tanstack/react-query';
import browser from 'webextension-polyfill';
import { MESSAGE_TYPES } from '@/shared/constants';
import type { Rule } from '@/shared/types';

export function useRules() {
  return useQuery({
    queryKey: ['rules'],
    queryFn: async (): Promise<Rule[]> => {
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_RULES
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to fetch rules');
      }

      return response.data || [];
    },
    staleTime: 30000, // 30 seconds
  });
}

export function useRuleActions() {
  const queryClient = useQueryClient();

  const invalidateRules = () => {
    queryClient.invalidateQueries({ queryKey: ['rules'] });
  };

  const createRule = async (rule: Partial<Rule>) => {
    const response = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.CREATE_RULE,
      payload: rule
    });

    if (!response?.success) {
      throw new Error(response?.error || 'Failed to create rule');
    }

    invalidateRules();
    return response.data;
  };

  const updateRule = async (id: string, updates: Partial<Rule>) => {
    const response = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.UPDATE_RULE,
      payload: { id, updates }
    });

    if (!response?.success) {
      throw new Error(response?.error || 'Failed to update rule');
    }

    invalidateRules();
  };

  const deleteRule = async (id: string) => {
    const response = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.DELETE_RULE,
      payload: { id }
    });

    if (!response?.success) {
      throw new Error(response?.error || 'Failed to delete rule');
    }

    invalidateRules();
  };

  const testPattern = async (url: string, pattern: string, matchType: string) => {
    const response = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.TEST_PATTERN,
      payload: { url, pattern, matchType }
    });

    if (!response?.success) {
      throw new Error(response?.error || 'Failed to test pattern');
    }

    return response.data?.matches || false;
  };

  return {
    createRule,
    updateRule,
    deleteRule,
    testPattern,
    invalidateRules
  };
}