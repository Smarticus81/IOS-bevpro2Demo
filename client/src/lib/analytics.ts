import { logger } from "./logger";

interface CommandMetrics {
  total: number;
  successful: number;
  failed: number;
  type: string;
  timestamp: number;
}

class VoiceAnalytics {
  private static instance: VoiceAnalytics;
  private metrics: Map<string, CommandMetrics>;
  private sessionStartTime: number;

  private constructor() {
    this.metrics = new Map();
    this.sessionStartTime = Date.now();
    this.initializeMetrics();
  }

  static getInstance(): VoiceAnalytics {
    if (!VoiceAnalytics.instance) {
      VoiceAnalytics.instance = new VoiceAnalytics();
    }
    return VoiceAnalytics.instance;
  }

  private initializeMetrics() {
    const categories = ['wake_word', 'drink_order', 'system_command', 'order_completion'];
    categories.forEach(category => {
      this.metrics.set(category, {
        total: 0,
        successful: 0,
        failed: 0,
        type: category,
        timestamp: Date.now()
      });
    });
  }

  trackCommand(
    type: string,
    isSuccessful: boolean,
    details?: { command: string; error?: string }
  ) {
    const metric = this.metrics.get(type);
    if (!metric) return;

    metric.total += 1;
    if (isSuccessful) {
      metric.successful += 1;
    } else {
      metric.failed += 1;
    }
    metric.timestamp = Date.now();

    // Log the event
    logger.info('Voice Command Tracked:', {
      type,
      success: isSuccessful,
      command: details?.command,
      error: details?.error,
      successRate: this.getSuccessRate(type)
    });
  }

  getSuccessRate(type: string): number {
    const metric = this.metrics.get(type);
    if (!metric || metric.total === 0) return 0;
    return (metric.successful / metric.total) * 100;
  }

  getOverallSuccessRate(): number {
    let totalSuccessful = 0;
    let totalCommands = 0;

    this.metrics.forEach(metric => {
      totalSuccessful += metric.successful;
      totalCommands += metric.total;
    });

    return totalCommands === 0 ? 0 : (totalSuccessful / totalCommands) * 100;
  }

  getMetricsSummary() {
    const summary: Record<string, { successRate: number; total: number }> = {};
    
    this.metrics.forEach((metric, type) => {
      summary[type] = {
        successRate: this.getSuccessRate(type),
        total: metric.total
      };
    });

    return {
      overall: this.getOverallSuccessRate(),
      categories: summary,
      sessionDuration: Date.now() - this.sessionStartTime
    };
  }

  resetMetrics() {
    this.initializeMetrics();
    this.sessionStartTime = Date.now();
  }
}

export const voiceAnalytics = VoiceAnalytics.getInstance();
