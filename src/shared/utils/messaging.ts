import browser from 'webextension-polyfill';
import { MESSAGE_TYPES } from '@/shared/constants';
import type {
  Container,
  Rule,
  Preferences,
  EvaluationResult,
  CreateContainerRequest,
  CreateRuleRequest,
  BackupData,
} from '@/shared/types';
import { logger } from './logger';

export interface Message<T = unknown> {
  type: string;
  payload?: T;
  requestId?: string;
}

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  requestId?: string;
}

export class MessagingService {
  private requestCounter = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }>();

  constructor() {
    this.setupMessageHandler();
  }

  private setupMessageHandler(): void {
    browser.runtime.onMessage.addListener((message: Message, _sender) => {
      logger.debug('Received message', { type: message.type, payload: message.payload }, 'messaging');

      // Handle responses to our requests
      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const { resolve } = this.pendingRequests.get(message.requestId)!;
        this.pendingRequests.delete(message.requestId);
        resolve(message);
        return;
      }

      // This will be handled by the background script message handlers
      return Promise.resolve(false);
    });
  }

  private generateRequestId(): string {
    return `req_${++this.requestCounter}_${Date.now()}`;
  }

  async sendMessage<T = unknown>(type: string, payload?: unknown): Promise<MessageResponse<T>> {
    const requestId = this.generateRequestId();
    const message: Message = {
      type,
      payload,
      requestId,
    };

    logger.debug('Sending message', { type, payload }, 'messaging');

    try {
      const response = await browser.runtime.sendMessage(message);
      logger.debug('Received response', response, 'messaging');

      if (!response.success) {
        throw new Error(response.error || 'Unknown error');
      }

      return response;
    } catch (error) {
      logger.error('Message sending failed', { type, error }, 'messaging');
      throw error;
    }
  }

  // Container operations
  async getContainers(): Promise<Container[]> {
    const response = await this.sendMessage<Container[]>(MESSAGE_TYPES.GET_CONTAINERS);
    return response.data || [];
  }

  async createContainer(request: CreateContainerRequest): Promise<Container> {
    const response = await this.sendMessage<Container>(MESSAGE_TYPES.CREATE_CONTAINER, request);
    return response.data!;
  }

  async updateContainer(id: string, updates: Partial<Container>): Promise<void> {
    await this.sendMessage(MESSAGE_TYPES.UPDATE_CONTAINER, { id, updates });
  }

  async deleteContainer(id: string): Promise<void> {
    await this.sendMessage(MESSAGE_TYPES.DELETE_CONTAINER, { id });
  }

  async syncContainers(): Promise<void> {
    await this.sendMessage(MESSAGE_TYPES.SYNC_CONTAINERS);
  }

  // Rule operations
  async getRules(): Promise<Rule[]> {
    const response = await this.sendMessage<Rule[]>(MESSAGE_TYPES.GET_RULES);
    return response.data || [];
  }

  async createRule(request: CreateRuleRequest): Promise<Rule> {
    const response = await this.sendMessage<Rule>(MESSAGE_TYPES.CREATE_RULE, request);
    return response.data!;
  }

  async updateRule(id: string, updates: Partial<Rule>): Promise<void> {
    await this.sendMessage(MESSAGE_TYPES.UPDATE_RULE, { id, updates });
  }

  async deleteRule(id: string): Promise<void> {
    await this.sendMessage(MESSAGE_TYPES.DELETE_RULE, { id });
  }

  async evaluateUrl(url: string, currentContainer?: string): Promise<EvaluationResult> {
    const response = await this.sendMessage<EvaluationResult>(
      MESSAGE_TYPES.EVALUATE_URL,
      { url, currentContainer },
    );
    return response.data!;
  }

  async testPattern(url: string, pattern: string, matchType: string): Promise<{ matches: boolean }> {
    const response = await this.sendMessage<{ matches: boolean }>(
      MESSAGE_TYPES.TEST_PATTERN,
      { url, pattern, matchType },
    );
    return (response.data || { matches: false }) as { matches: boolean };
  }

  // Preferences operations
  async getPreferences(): Promise<Preferences> {
    const response = await this.sendMessage<Preferences>(MESSAGE_TYPES.GET_PREFERENCES);
    return (response.data || ({} as Preferences));
  }

  async updatePreferences(updates: Partial<Preferences>): Promise<void> {
    await this.sendMessage(MESSAGE_TYPES.UPDATE_PREFERENCES, updates);
  }

  // Backup operations
  async backupData(): Promise<BackupData> {
    const response = await this.sendMessage<BackupData>(MESSAGE_TYPES.BACKUP_DATA);
    return (response.data || ({} as BackupData));
  }

  async restoreData(backup: BackupData): Promise<void> {
    await this.sendMessage(MESSAGE_TYPES.RESTORE_DATA, backup);
  }

  // Sync operations
  async syncPush(): Promise<void> {
    await this.sendMessage(MESSAGE_TYPES.SYNC_PUSH);
  }

  async syncPull(): Promise<void> {
    await this.sendMessage(MESSAGE_TYPES.SYNC_PULL);
  }

  async getSyncState() {
    const response = await this.sendMessage(MESSAGE_TYPES.GET_SYNC_STATE);
    return response.data;
  }

  // Bookmark operations
  async getBookmarkAssociations() {
    const response = await this.sendMessage(MESSAGE_TYPES.GET_BOOKMARK_ASSOCIATIONS);
    return response.data || [];
  }

  async addBookmarkAssociation(payload: { bookmarkId: string; containerId: string; url: string; autoOpen?: boolean }) {
    await this.sendMessage(MESSAGE_TYPES.ADD_BOOKMARK_ASSOCIATION, payload);
  }

  async removeBookmarkAssociation(bookmarkId: string) {
    await this.sendMessage(MESSAGE_TYPES.REMOVE_BOOKMARK_ASSOCIATION, { bookmarkId });
  }

  async processBookmarkUrl(url: string): Promise<{ cleanUrl: string; containerId?: string }> {
    const response = await this.sendMessage(MESSAGE_TYPES.PROCESS_BOOKMARK_URL, { url });
    return (response.data || { cleanUrl: url }) as { cleanUrl: string; containerId?: string };
  }

  // Categories
  async getCategories(): Promise<string[]> {
    const response = await this.sendMessage<string[]>(MESSAGE_TYPES.GET_CATEGORIES);
    return response.data || [];
  }
  async addCategory(name: string): Promise<void> {
    await this.sendMessage(MESSAGE_TYPES.ADD_CATEGORY, { name });
  }
  async renameCategory(oldName: string, newName: string): Promise<void> {
    await this.sendMessage(MESSAGE_TYPES.RENAME_CATEGORY, { oldName, newName });
  }
  async deleteCategory(name: string): Promise<void> {
    await this.sendMessage(MESSAGE_TYPES.DELETE_CATEGORY, { name });
  }

  // Stats
  async getStats(): Promise<Record<string, unknown>> {
    const response = await this.sendMessage<Record<string, unknown>>(MESSAGE_TYPES.GET_STATS);
    return response.data || {};
  }
  async resetStats(): Promise<void> {
    await this.sendMessage(MESSAGE_TYPES.RESET_STATS);
  }

  // Templates
  async getTemplates(): Promise<unknown[]> {
    const response = await this.sendMessage<unknown[]>(MESSAGE_TYPES.GET_TEMPLATES);
    return response.data || [];
  }
  async saveTemplate(template: unknown): Promise<void> {
    await this.sendMessage(MESSAGE_TYPES.SAVE_TEMPLATE, template);
  }
  async deleteTemplate(name: string): Promise<void> {
    await this.sendMessage(MESSAGE_TYPES.DELETE_TEMPLATE, { name });
  }
  async applyTemplate(name: string): Promise<void> {
    await this.sendMessage(MESSAGE_TYPES.APPLY_TEMPLATE, { name });
  }
}

// Utility function to create a response
export function createResponse<T>(success: boolean, data?: T, error?: string): MessageResponse<T> {
  const response: MessageResponse<T> = { success };
  if (data !== undefined) response.data = data;
  if (error !== undefined) response.error = error;
  return response;
}

// Singleton instance
export default new MessagingService();