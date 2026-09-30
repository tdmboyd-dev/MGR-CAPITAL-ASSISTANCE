/**
 * FraudDetectionService.ts — MGR CAPITAL ASSISTANCE
 * AI-Powered Fraud Detection with TensorFlow.js
 * Real-time anomaly scoring for transactions
 */

import * as tf from '@tensorflow/tfjs';
import { logger } from '../utils/logger.js';
import prisma from "../lib/prisma.js";

interface TransactionFeatures {
  amount: number;
  velocity: number; // transactions per hour
  ipGeoDistance: number; // distance from typical location
  hourOfDay: number;
  dayOfWeek: number;
  deviceFingerprint: string;
  userHistory: number; // months as customer
  paymentMethod: string;
}

interface FraudScore {
  score: number; // 0-1, higher = more risky
  risk: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  recommendation: 'approve' | 'review';
  confidence: number;
  modelUsed: boolean;
}

interface VelocityData {
  count: number;
  totalAmount: number;
  lastTransaction: Date;
}

// IP geolocation cache
interface GeoLocation {
  lat: number;
  lon: number;
  city: string;
  country: string;
}

export class FraudDetectionService {
  private model: tf.LayersModel | null = null;
  private isModelReady = false;
  private trainedSampleCount = 0;
  private evaluationMetrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  } | null = null;
  private velocityCache: Map<string, VelocityData> = new Map();
  private geoCache: Map<string, GeoLocation> = new Map();
  private userLocationCache: Map<string, GeoLocation> = new Map();

  /**
   * Build the model architecture only. Production scoring does not use an ML
   * model until it has been trained and evaluated on labeled MGR data.
   */
  private createModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ units: 32, activation: 'relu', inputShape: [8] }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  /**
   * Score a transaction for fraud risk
   */
  async scoreTransaction(data: {
    amount: number;
    userId: string;
    ip?: string;
    deviceId?: string;
    paymentMethod: string;
  }): Promise<FraudScore> {
    const factors: string[] = [];

    // Deterministic/rule-based checks are always the primary signal.
    const ruleScore = await this.applyRules(data, factors);

    // ML is advisory only after real labeled-data training + holdout evaluation.
    const modelUsed = this.isModelReady && !!this.model && !!this.evaluationMetrics;
    const mlScore = modelUsed ? await this.getMLScore(data) : 0;
    const finalScore = modelUsed
      ? Math.min(1, ruleScore * 0.7 + mlScore * 0.3)
      : ruleScore;

    // Determine risk level
    let risk: FraudScore['risk'];
    let recommendation: FraudScore['recommendation'];

    if (finalScore >= 0.8) {
      risk = 'critical';
      recommendation = 'review';
      factors.push('Critical risk threshold exceeded - human review required');
    } else if (finalScore >= 0.6) {
      risk = 'high';
      recommendation = 'review';
      factors.push('High risk - manual review required');
    } else if (finalScore >= 0.3) {
      risk = 'medium';
      recommendation = 'review';
    } else {
      risk = 'low';
      recommendation = 'approve';
    }

    // Log for audit
    logger.info('Fraud score computed', {
      userId: data.userId,
      amount: data.amount,
      score: finalScore,
      risk,
      recommendation,
    });

    return {
      score: finalScore,
      risk,
      factors,
      recommendation,
      confidence: modelUsed && this.evaluationMetrics
        ? Math.max(0.5, Math.min(0.95, this.evaluationMetrics.f1Score))
        : 0.5,
      modelUsed,
    };
  }

  /**
   * Apply rule-based fraud detection
   */
  private async applyRules(
    data: { amount: number; userId: string; ip?: string; paymentMethod: string },
    factors: string[]
  ): Promise<number> {
    let score = 0;

    // Amount-based rules
    if (data.amount > 50000) {
      score += 0.4;
      factors.push('Very high transaction amount ($50k+)');
    } else if (data.amount > 20000) {
      score += 0.2;
      factors.push('High transaction amount ($20k+)');
    } else if (data.amount > 10000) {
      score += 0.1;
      factors.push('Elevated transaction amount ($10k+)');
    }

    // Velocity check
    const velocity = await this.getVelocity(data.userId);
    if (velocity.count > 5) {
      score += 0.3;
      factors.push(`High velocity: ${velocity.count} transactions in past hour`);
    } else if (velocity.count > 3) {
      score += 0.15;
      factors.push(`Elevated velocity: ${velocity.count} transactions in past hour`);
    }

    // Time-based rules
    const hour = new Date().getHours();
    if (hour >= 0 && hour <= 5) {
      score += 0.15;
      factors.push('Transaction during unusual hours (midnight-5am)');
    }

    // Day-based rules
    const day = new Date().getDay();
    if (day === 0 || day === 6) {
      score += 0.05;
      factors.push('Weekend transaction');
    }

    // User history check
    const userHistory = await this.getUserHistory(data.userId);
    if (!userHistory.found) {
      score += 0.2;
      factors.push('New or unknown user');
    } else if (userHistory.totalTransactions < 3) {
      score += 0.1;
      factors.push('Limited transaction history');
    }

    // Anomaly detection: amount vs user average
    if (userHistory.found && userHistory.averageAmount > 0) {
      const ratio = data.amount / userHistory.averageAmount;
      if (ratio > 5) {
        score += 0.3;
        factors.push(`Amount ${ratio.toFixed(1)}x higher than user average`);
      } else if (ratio > 3) {
        score += 0.15;
        factors.push(`Amount ${ratio.toFixed(1)}x higher than user average`);
      }
    }

    return Math.min(score, 1);
  }

  /**
   * Get ML-based fraud score
   */
  private async getMLScore(data: {
    amount: number;
    userId: string;
    ip?: string;
    deviceId?: string;
    paymentMethod: string;
  }): Promise<number> {
    if (!this.model) return 0.5;

    try {
      const velocity = await this.getVelocity(data.userId);
      const userHistory = await this.getUserHistory(data.userId);
      const hour = new Date().getHours();
      const day = new Date().getDay();

      // Get IP geo distance (real calculation)
      const ipGeoDistance = data.ip ? await this.getIpGeoDistance(data.ip, data.userId) : 0;

      // Prepare features
      const features = [
        data.amount,
        velocity.count,
        ipGeoDistance,
        hour,
        day,
        data.deviceId ? 0.9 : 0.5, // Device trust score
        userHistory.monthsAsCustomer,
        this.getPaymentMethodRisk(data.paymentMethod),
      ];

      // Normalize features
      const normalizedFeatures = this.normalizeFeatures(features);

      // Predict
      const input = tf.tensor2d([normalizedFeatures]);
      const prediction = this.model.predict(input) as tf.Tensor;
      const score = (await prediction.data())[0];

      // Clean up
      input.dispose();
      prediction.dispose();

      return score;
    } catch (error: any) {
      logger.error('ML scoring failed', { error: error.message });
      return 0.5;
    }
  }

  /**
   * Normalize features for ML model
   */
  private normalizeFeatures(features: number[]): number[] {
    const maxValues = [100000, 20, 5000, 24, 7, 1, 36, 1];
    return features.map((f, i) => Math.min(f / maxValues[i], 1));
  }

  /**
   * Get IP geolocation using free ip-api.com service
   */
  private async getIpGeolocation(ip: string): Promise<GeoLocation | null> {
    // Check cache first
    const cached = this.geoCache.get(ip);
    if (cached) return cached;

    // Skip private/localhost IPs
    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '127.0.0.1' || ip === '::1') {
      return null;
    }

    try {
      // Using free ip-api.com (45 requests/minute, no key needed)
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,lat,lon,city,country`);
      const data: any = await response.json();

      if (data.status === 'success') {
        const location: GeoLocation = {
          lat: data.lat,
          lon: data.lon,
          city: data.city || 'Unknown',
          country: data.country || 'Unknown',
        };
        this.geoCache.set(ip, location);
        return location;
      }
    } catch (error) {
      logger.warn('IP geolocation failed', { ip, error });
    }

    return null;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Get IP geo distance from user's typical location
   */
  private async getIpGeoDistance(ip: string, userId: string): Promise<number> {
    const currentLocation = await this.getIpGeolocation(ip);
    if (!currentLocation) return 0;

    // Get user's typical location
    let userLocation = this.userLocationCache.get(userId);

    if (!userLocation) {
      // No stored IP on user model; user location will be set on first transaction
      // Future: could store lastLoginIp in user metadata
    }

    if (!userLocation) {
      // First time, record this as their location
      this.userLocationCache.set(userId, currentLocation);
      return 0;
    }

    // Calculate distance in km
    const distance = this.calculateDistance(
      userLocation.lat, userLocation.lon,
      currentLocation.lat, currentLocation.lon
    );

    return distance;
  }

  /**
   * Get transaction velocity for user
   */
  private async getVelocity(userId: string): Promise<VelocityData> {
    const cached = this.velocityCache.get(userId);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    if (cached && cached.lastTransaction > oneHourAgo) {
      return cached;
    }

    try {
      const recentPayments = await prisma.payment.findMany({
        where: {
          userId,
          createdAt: { gte: oneHourAgo },
        },
      });

      const data: VelocityData = {
        count: recentPayments.length,
        totalAmount: recentPayments.reduce((sum, p) => sum + p.amountCents, 0),
        lastTransaction: new Date(),
      };

      this.velocityCache.set(userId, data);
      return data;
    } catch {
      return { count: 0, totalAmount: 0, lastTransaction: new Date() };
    }
  }

  /**
   * Get user transaction history
   */
  private async getUserHistory(userId: string): Promise<{
    found: boolean;
    totalTransactions: number;
    averageAmount: number;
    monthsAsCustomer: number;
  }> {
    try {
      const payments = await prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });

      if (payments.length === 0) {
        return { found: false, totalTransactions: 0, averageAmount: 0, monthsAsCustomer: 0 };
      }

      const totalAmount = payments.reduce((sum, p) => sum + p.amountCents, 0);
      const firstPayment = payments[0].createdAt;
      const monthsAsCustomer = Math.floor(
        (Date.now() - firstPayment.getTime()) / (30 * 24 * 60 * 60 * 1000)
      );

      return {
        found: true,
        totalTransactions: payments.length,
        averageAmount: totalAmount / payments.length / 100,
        monthsAsCustomer,
      };
    } catch {
      return { found: false, totalTransactions: 0, averageAmount: 0, monthsAsCustomer: 0 };
    }
  }

  /**
   * Get payment method risk score
   */
  private getPaymentMethodRisk(method: string): number {
    const riskMap: Record<string, number> = {
      stripe: 0.1,
      paypal: 0.15,
      ach: 0.2,
      check: 0.3,
      crypto: 0.4,
    };
    return riskMap[method.toLowerCase()] || 0.25;
  }

  /**
   * Train the advisory model on labeled MGR data and evaluate on a holdout set.
   * Synthetic/random samples are not accepted as production evidence.
   */
  async trainOnNewData(transactions: {
    features: number[];
    isFraud: boolean;
  }[]): Promise<void> {
    if (transactions.length < 100) {
      throw new Error('At least 100 labeled transactions are required for fraud model training');
    }

    if (transactions.some((t) => t.features.length !== 8 || t.features.some((v) => !Number.isFinite(v)))) {
      throw new Error('Each training record must contain exactly 8 finite numeric features');
    }

    const positives = transactions.filter((t) => t.isFraud).length;
    const negatives = transactions.length - positives;
    if (positives < 10 || negatives < 10) {
      throw new Error('Training data must include at least 10 fraud and 10 non-fraud examples');
    }

    const shuffled = [...transactions];
    tf.util.shuffle(shuffled);
    const splitAt = Math.max(1, Math.floor(shuffled.length * 0.8));
    const train = shuffled.slice(0, splitAt);
    const test = shuffled.slice(splitAt);

    if (test.length < 10) {
      throw new Error('Training set is too small to reserve a meaningful holdout set');
    }

    this.model?.dispose();
    this.model = this.createModel();

    const trainX = tf.tensor2d(train.map((t) => this.normalizeFeatures(t.features)));
    const trainY = tf.tensor2d(train.map((t) => [t.isFraud ? 1 : 0]));

    await this.model.fit(trainX, trainY, {
      epochs: 20,
      batchSize: Math.min(32, train.length),
      validationSplit: 0.1,
      verbose: 0,
    });

    trainX.dispose();
    trainY.dispose();

    const testX = tf.tensor2d(test.map((t) => this.normalizeFeatures(t.features)));
    const predictionTensor = this.model.predict(testX) as tf.Tensor;
    const predictionValues = Array.from(await predictionTensor.data());

    testX.dispose();
    predictionTensor.dispose();

    let tp = 0;
    let tn = 0;
    let fp = 0;
    let fn = 0;

    test.forEach((sample, index) => {
      const predictedFraud = predictionValues[index] >= 0.5;
      if (predictedFraud && sample.isFraud) tp++;
      else if (predictedFraud && !sample.isFraud) fp++;
      else if (!predictedFraud && sample.isFraud) fn++;
      else tn++;
    });

    const accuracy = (tp + tn) / test.length;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    this.trainedSampleCount = transactions.length;
    this.evaluationMetrics = { accuracy, precision, recall, f1Score };
    this.isModelReady = true;

    logger.info('Fraud model trained and evaluated on labeled data', {
      samples: transactions.length,
      holdoutSamples: test.length,
      accuracy,
      precision,
      recall,
      f1Score,
    });
  }

  async getModelMetrics(): Promise<{
    accuracy: number | null;
    precision: number | null;
    recall: number | null;
    f1Score: number | null;
    isReady: boolean;
    evaluated: boolean;
    trainedSampleCount: number;
  }> {
    return {
      accuracy: this.evaluationMetrics?.accuracy ?? null,
      precision: this.evaluationMetrics?.precision ?? null,
      recall: this.evaluationMetrics?.recall ?? null,
      f1Score: this.evaluationMetrics?.f1Score ?? null,
      isReady: this.isModelReady,
      evaluated: !!this.evaluationMetrics,
      trainedSampleCount: this.trainedSampleCount,
    };
  }
}

export const fraudDetectionService = new FraudDetectionService();
