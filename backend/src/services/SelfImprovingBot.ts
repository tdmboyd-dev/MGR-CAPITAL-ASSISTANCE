import * as tf from '@tensorflow/tfjs-node';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

/**
 * Self-Improving Bot - Uses historical data to retrain fraud model
 *
 * NOTE: This is a simplified meta-learning approach, not full MAML.
 * True MAML requires task distribution and inner/outer loop optimization.
 *
 * What this actually does:
 * 1. Collects historical payment data with fraud labels
 * 2. Retrains the fraud model periodically
 * 3. Saves model weights for persistence
 */
export class SelfImprovingBot {
  private model: tf.LayersModel | null = null;
  private modelPath = path.join(process.cwd(), 'models', 'fraud_model');

  constructor() {
    this.loadModel();
  }

  /**
   * Load existing model or create new one
   */
  private async loadModel(): Promise<void> {
    try {
      if (fs.existsSync(`${this.modelPath}/model.json`)) {
        this.model = await tf.loadLayersModel(`file://${this.modelPath}/model.json`);
        console.log('[SelfImprove] Loaded existing fraud model');
      } else {
        this.model = this.createModel();
        console.log('[SelfImprove] Created new fraud model');
      }
    } catch (error) {
      console.error('[SelfImprove] Model load failed, creating new:', error);
      this.model = this.createModel();
    }
  }

  /**
   * Create a new fraud detection model
   */
  private createModel(): tf.LayersModel {
    const model = tf.sequential();

    model.add(tf.layers.dense({
      inputShape: [8], // 8 features: amount, hour, dayOfWeek, isWeekend, velocity, avgAmount, riskScore, accountAge
      units: 64,
      activation: 'relu'
    }));

    model.add(tf.layers.dropout({ rate: 0.3 }));

    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu'
    }));

    model.add(tf.layers.dropout({ rate: 0.2 }));

    model.add(tf.layers.dense({
      units: 1,
      activation: 'sigmoid'
    }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Extract features from payment data
   */
  private extractFeatures(payment: any): number[] {
    const date = new Date(payment.createdAt);
    const hour = date.getHours();
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;

    return [
      payment.amount / 10000, // Normalize amount (assuming max ~$10k)
      hour / 24,
      dayOfWeek / 7,
      isWeekend,
      (payment.velocity || 1) / 10, // Transactions per hour
      (payment.avgAmount || payment.amount) / 10000,
      (payment.riskScore || 0.5),
      (payment.accountAge || 30) / 365 // Days normalized to years
    ];
  }

  /**
   * Improve model using historical data
   */
  async improveModel(): Promise<{
    trained: boolean;
    samplesUsed: number;
    accuracy: number;
  }> {
    if (!this.model) {
      await this.loadModel();
    }

    try {
      // Fetch historical payments with fraud labels
      const payments = await prisma.payment.findMany({
        where: {
          // Only use payments with confirmed fraud status
          OR: [
            { status: 'COMPLETED' },
            { status: 'FLAGGED' },
            { status: 'FRAUD_CONFIRMED' }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 1000 // Use last 1000 payments
      });

      if (payments.length < 50) {
        console.log('[SelfImprove] Not enough data to retrain (need 50+, have', payments.length, ')');
        return { trained: false, samplesUsed: payments.length, accuracy: 0 };
      }

      // Prepare training data
      const features: number[][] = [];
      const labels: number[][] = [];

      for (const payment of payments) {
        features.push(this.extractFeatures(payment));
        // Determine if fraud based on status
        const isFraud = payment.status === 'FRAUD_CONFIRMED' || payment.status === 'FLAGGED' ? 1 : 0;
        labels.push([isFraud]);
      }

      const xs = tf.tensor2d(features);
      const ys = tf.tensor2d(labels);

      // Train with early stopping simulation
      const history = await this.model!.fit(xs, ys, {
        epochs: 20,
        batchSize: 32,
        validationSplit: 0.2,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`[SelfImprove] Epoch ${epoch + 1}: loss=${logs?.loss?.toFixed(4)}, acc=${logs?.acc?.toFixed(4)}`);
          }
        }
      });

      // Save model
      await this.saveModel();

      // Calculate final accuracy
      const finalAccuracy = history.history.val_acc
        ? (history.history.val_acc[history.history.val_acc.length - 1] as number) * 100
        : 0;

      // Clean up tensors
      xs.dispose();
      ys.dispose();

      console.log(`[SelfImprove] Model improved! Accuracy: ${finalAccuracy.toFixed(2)}%`);

      return {
        trained: true,
        samplesUsed: payments.length,
        accuracy: finalAccuracy
      };
    } catch (error: any) {
      console.error('[SelfImprove] Training failed:', error.message);
      return { trained: false, samplesUsed: 0, accuracy: 0 };
    }
  }

  /**
   * Save model to disk
   */
  private async saveModel(): Promise<void> {
    if (!this.model) return;

    // Ensure directory exists
    const modelDir = path.dirname(this.modelPath);
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }

    await this.model.save(`file://${this.modelPath}`);
    console.log('[SelfImprove] Model saved to', this.modelPath);
  }

  /**
   * Score a payment for fraud
   */
  async scoreFraud(paymentData: any): Promise<number> {
    if (!this.model) {
      await this.loadModel();
    }

    const features = this.extractFeatures(paymentData);
    const input = tf.tensor2d([features]);
    const prediction = this.model!.predict(input) as tf.Tensor;
    const score = (await prediction.data())[0];

    input.dispose();
    prediction.dispose();

    return score;
  }

  /**
   * Get model metrics
   */
  async getMetrics(): Promise<{
    modelExists: boolean;
    lastTrained: Date | null;
    totalSamples: number;
  }> {
    const modelExists = fs.existsSync(`${this.modelPath}/model.json`);

    let lastTrained: Date | null = null;
    if (modelExists) {
      const stats = fs.statSync(`${this.modelPath}/model.json`);
      lastTrained = stats.mtime;
    }

    const totalSamples = await prisma.payment.count();

    return {
      modelExists,
      lastTrained,
      totalSamples
    };
  }
}

export const selfImprovingBot = new SelfImprovingBot();

// Schedule daily retraining at midnight
// NOTE: node-cron must be installed: npm install node-cron @types/node-cron
cron.schedule('0 0 * * *', async () => {
  console.log('[SelfImprove] Starting scheduled model improvement...');
  await selfImprovingBot.improveModel();
});
