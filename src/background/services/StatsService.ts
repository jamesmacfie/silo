import browser from 'webextension-polyfill';
import { STORAGE_KEYS } from '@/shared/constants';
import type { 
  EnhancedContainerStats, 
  SessionData, 
  DailyStats, 
  GlobalStats, 
  ActivityEvent, 
  TrendData, 
  StatEvent 
} from '@/shared/types/storage';
import { logger } from '@/shared/utils/logger';
import storageService from './StorageService';

class StatsService {
  private activeSessionCache = new Map<string, SessionData>();
  private batchBuffer: StatEvent[] = [];
  private batchTimer?: number;
  private readonly BATCH_INTERVAL = 30000; // 30 seconds
  private readonly MAX_BATCH_SIZE = 100;
  private readonly MAX_ACTIVITY_EVENTS = 200;

  constructor() {
    this.startBatchTimer();
    this.initializeCleanupTask();
  }

  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      this.flushBatchBuffer();
    }, this.BATCH_INTERVAL) as unknown as number;
  }

  private async flushBatchBuffer(): Promise<void> {
    if (this.batchBuffer.length === 0) return;

    const events = [...this.batchBuffer];
    this.batchBuffer = [];

    try {
      await this.processBatchedEvents(events);
    } catch (error) {
      logger.error('Failed to process batched stat events', error);
      // Re-add failed events to buffer (with limit)
      this.batchBuffer.unshift(...events.slice(0, this.MAX_BATCH_SIZE - this.batchBuffer.length));
    }
  }

  private async processBatchedEvents(events: StatEvent[]): Promise<void> {
    const prefs = await storageService.getPreferences();
    if (prefs?.stats?.enabled === false) return;

    // Group events by container for efficient processing
    const eventsByContainer = new Map<string, StatEvent[]>();
    for (const event of events) {
      if (!eventsByContainer.has(event.containerId)) {
        eventsByContainer.set(event.containerId, []);
      }
      eventsByContainer.get(event.containerId)!.push(event);
    }

    // Process each container's events
    for (const [containerId, containerEvents] of eventsByContainer) {
      await this.updateContainerStats(containerId, containerEvents);
    }

    // Update global stats
    await this.updateGlobalStats(events);
    
    // Update recent activity
    await this.updateRecentActivity(events);
  }

  private async updateContainerStats(containerId: string, events: StatEvent[]): Promise<void> {
    const stats = await storageService.getStats();
    const current = stats[containerId] || {
      containerId,
      tabsOpened: 0,
      rulesMatched: 0,
      lastUsed: 0,
      activeTabCount: 0,
      history: [],
    };

    let activeTabDelta = 0;
    
    for (const event of events) {
      // Update legacy record for backward compatibility
      await storageService.recordStat(containerId, this.mapEventToLegacy(event.event));

      // Track active tab changes
      if (event.event === 'tab-created') {
        activeTabDelta++;
      } else if (event.event === 'tab-closed') {
        activeTabDelta--;
      }
    }

    // Update active tab count
    current.activeTabCount = Math.max(0, (current.activeTabCount || 0) + activeTabDelta);
    current.lastUsed = Math.max(current.lastUsed || 0, ...events.map(e => e.timestamp));

    stats[containerId] = current;
    await storageService.setStats(stats);
  }

  private mapEventToLegacy(event: string): 'open' | 'match' | 'close' | 'touch' {
    switch (event) {
      case 'tab-created': return 'open';
      case 'tab-closed': return 'close';
      case 'rule-match': return 'match';
      default: return 'touch';
    }
  }

  private async updateGlobalStats(events: StatEvent[]): Promise<void> {
    const current = await this.getGlobalStats();
    const containers = await storageService.getContainers();
    const rules = await storageService.getRules();

    const tabCreatedEvents = events.filter(e => e.event === 'tab-created');
    const ruleMatchEvents = events.filter(e => e.event === 'rule-match');

    const updated: GlobalStats = {
      ...current,
      totalContainers: containers.length,
      totalRules: rules.length,
      totalTabsEverOpened: current.totalTabsEverOpened + tabCreatedEvents.length,
      totalRulesMatched: current.totalRulesMatched + ruleMatchEvents.length,
      lastUpdated: Date.now(),
    };

    // Calculate most used container
    const stats = await storageService.getStats();
    const mostUsed = Object.entries(stats)
      .sort(([,a], [,b]) => (b.tabsOpened || 0) - (a.tabsOpened || 0))[0];
    if (mostUsed) {
      updated.mostUsedContainer = mostUsed[0];
    }

    await this.setGlobalStats(updated);
  }

  private async updateRecentActivity(events: StatEvent[]): Promise<void> {
    const current = await this.getRecentActivity();
    
    const newActivities: ActivityEvent[] = events.map(event => ({
      id: `${event.timestamp}-${Math.random().toString(36).slice(2)}`,
      containerId: event.containerId,
      timestamp: event.timestamp,
      event: event.event,
      metadata: event.metadata,
    }));

    const updated = [...newActivities, ...current]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, this.MAX_ACTIVITY_EVENTS);

    await this.setRecentActivity(updated);
  }

  private initializeCleanupTask(): void {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanupOldData().catch(error => {
        logger.error('Failed to cleanup old stats data', error);
      });
    }, 60 * 60 * 1000) as unknown as number;
  }

  // Public API methods

  async recordEvent(containerId: string, event: StatEvent['event'], metadata?: Record<string, unknown>): Promise<void> {
    const statEvent: StatEvent = {
      containerId,
      event,
      timestamp: Date.now(),
      metadata,
    };

    this.batchBuffer.push(statEvent);

    // Flush immediately if buffer is full
    if (this.batchBuffer.length >= this.MAX_BATCH_SIZE) {
      await this.flushBatchBuffer();
    }
  }

  async trackTabSession(cookieStoreId: string, tabId: number, action: 'start' | 'end'): Promise<void> {
    const session = this.activeSessionCache.get(cookieStoreId) || {
      startTime: Date.now(),
      tabIds: new Set(),
      activeTime: 0,
    };

    if (action === 'start') {
      session.tabIds.add(tabId);
      this.activeSessionCache.set(cookieStoreId, session);
    } else if (action === 'end') {
      session.tabIds.delete(tabId);
      
      if (session.tabIds.size === 0) {
        // Session ended, record total time
        const sessionDuration = Date.now() - session.startTime;
        await this.recordEvent(cookieStoreId, 'tab-closed', { 
          sessionDuration,
          tabId 
        });
        this.activeSessionCache.delete(cookieStoreId);
      } else {
        this.activeSessionCache.set(cookieStoreId, session);
      }
    }
  }

  async getCurrentActiveTabs(): Promise<Record<string, number>> {
    try {
      const tabs = await browser.tabs.query({});
      const counts: Record<string, number> = {};
      
      for (const tab of tabs) {
        if (tab.cookieStoreId && tab.cookieStoreId !== 'firefox-default') {
          counts[tab.cookieStoreId] = (counts[tab.cookieStoreId] || 0) + 1;
        }
      }
      
      return counts;
    } catch (error) {
      logger.error('Failed to get active tab counts', error);
      return {};
    }
  }

  async getDailyStats(days: number = 7): Promise<DailyStats[]> {
    try {
      const dailyStats = await storageService.get<DailyStats[]>(STORAGE_KEYS.DAILY_STATS) || [];
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      
      return dailyStats.filter(stat => {
        const statDate = new Date(stat.date).getTime();
        return statDate >= cutoff;
      });
    } catch (error) {
      logger.error('Failed to get daily stats', error);
      return [];
    }
  }

  async getContainerTrends(days: number = 30): Promise<TrendData> {
    try {
      const dailyStats = await this.getDailyStats(days);
      const containers = await storageService.getContainers();
      
      const containerUsage = containers.map(container => {
        const containerStats = dailyStats.filter(s => s.containerId === container.cookieStoreId);
        const dates = containerStats.map(s => s.date);
        const values = containerStats.map(s => s.tabsOpened);
        
        return {
          containerId: container.cookieStoreId,
          dates,
          values,
        };
      });

      const totalTrend = dailyStats.reduce((acc, stat) => {
        const existing = acc.find(item => item.date === stat.date);
        if (existing) {
          existing.value += stat.tabsOpened;
        } else {
          acc.push({ date: stat.date, value: stat.tabsOpened });
        }
        return acc;
      }, [] as Array<{ date: string; value: number }>);

      return { containerUsage, totalTrend };
    } catch (error) {
      logger.error('Failed to get container trends', error);
      return { containerUsage: [], totalTrend: [] };
    }
  }

  async getGlobalStats(): Promise<GlobalStats> {
    try {
      const stats = await storageService.get<GlobalStats>(STORAGE_KEYS.GLOBAL_STATS);
      if (stats) return stats;

      // Initialize if not exists
      const containers = await storageService.getContainers();
      const rules = await storageService.getRules();
      
      const initial: GlobalStats = {
        totalContainers: containers.length,
        totalRules: rules.length,
        totalTabsEverOpened: 0,
        totalRulesMatched: 0,
        averageContainersPerDay: 0,
        dataRetentionDays: 30,
        lastUpdated: Date.now(),
      };

      await this.setGlobalStats(initial);
      return initial;
    } catch (error) {
      logger.error('Failed to get global stats', error);
      throw error;
    }
  }

  async setGlobalStats(stats: GlobalStats): Promise<void> {
    await storageService.set(STORAGE_KEYS.GLOBAL_STATS, stats);
  }

  async getRecentActivity(): Promise<ActivityEvent[]> {
    try {
      return await storageService.get<ActivityEvent[]>(STORAGE_KEYS.RECENT_ACTIVITY) || [];
    } catch (error) {
      logger.error('Failed to get recent activity', error);
      return [];
    }
  }

  async setRecentActivity(activities: ActivityEvent[]): Promise<void> {
    await storageService.set(STORAGE_KEYS.RECENT_ACTIVITY, activities);
  }

  async cleanupOldData(): Promise<void> {
    try {
      const prefs = await storageService.getPreferences();
      const retentionDays = prefs?.stats?.retentionDays || 30;
      const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

      // Cleanup daily stats
      const dailyStats = await storageService.get<DailyStats[]>(STORAGE_KEYS.DAILY_STATS) || [];
      const filteredDaily = dailyStats.filter(stat => {
        const statDate = new Date(stat.date).getTime();
        return statDate >= cutoff;
      });
      await storageService.set(STORAGE_KEYS.DAILY_STATS, filteredDaily);

      // Cleanup recent activity
      const activities = await this.getRecentActivity();
      const filteredActivities = activities.filter(activity => activity.timestamp >= cutoff);
      await this.setRecentActivity(filteredActivities);

      logger.info('Stats cleanup completed', { 
        retentionDays, 
        dailyStatsRemoved: dailyStats.length - filteredDaily.length,
        activitiesRemoved: activities.length - filteredActivities.length 
      });
    } catch (error) {
      logger.error('Failed to cleanup old stats data', error);
    }
  }

  async resetStats(): Promise<void> {
    await Promise.all([
      storageService.set(STORAGE_KEYS.STATS, {}),
      storageService.set(STORAGE_KEYS.DAILY_STATS, []),
      storageService.set(STORAGE_KEYS.GLOBAL_STATS, null),
      storageService.set(STORAGE_KEYS.RECENT_ACTIVITY, []),
      storageService.set(STORAGE_KEYS.ACTIVE_SESSIONS, {}),
    ]);
    
    this.activeSessionCache.clear();
    this.batchBuffer = [];
  }

  destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    this.flushBatchBuffer();
  }
}

export default new StatsService();