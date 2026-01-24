/**
 * PushService.ts — MGR CAPITAL ASSISTANCE
 * Custom Web Push Notifications (VAPID + service worker)
 */

import webpush from 'web-push';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

// Configure VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:founder@mgrcapital.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface PushResult {
  success: boolean;
  sent: number;
  failed: number;
  errors?: string[];
}

export class PushService {
  /**
   * Send push notification to a single subscription
   */
  async send(
    subscription: PushSubscription,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<boolean> {
    try {
      const payload = JSON.stringify({
        title,
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        data,
      });

      await webpush.sendNotification(subscription, payload);
      return true;
    } catch (error: any) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        // Subscription expired or invalid - should be removed
        logger.warn('Push subscription expired', { endpoint: subscription.endpoint });
      } else {
        logger.error('Push notification failed', { error });
      }
      return false;
    }
  }

  /**
   * Send push notification to a user by ID
   */
  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<boolean> {
    try {
      // Get user's push subscriptions from database
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId },
      });

      if (subscriptions.length === 0) {
        return false;
      }

      const results = await Promise.all(
        subscriptions.map(sub =>
          this.send(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            title,
            body,
            data
          )
        )
      );

      return results.some(r => r);
    } catch (error) {
      logger.error('Send to user failed', { userId, error });
      return false;
    }
  }

  /**
   * Broadcast push notification to all subscribers
   */
  async broadcast(
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<PushResult> {
    try {
      const subscriptions = await prisma.pushSubscription.findMany();
      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      await Promise.allSettled(
        subscriptions.map(async sub => {
          const success = await this.send(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            title,
            body,
            data
          );

          if (success) {
            sent++;
          } else {
            failed++;
            // Remove expired subscriptions
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          }
        })
      );

      logger.info('Broadcast complete', { sent, failed });
      return { success: true, sent, failed };
    } catch (error) {
      logger.error('Broadcast failed', { error });
      return { success: false, sent: 0, failed: 0, errors: ['Broadcast failed'] };
    }
  }

  /**
   * Send to users by role
   */
  async sendToRole(
    role: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<PushResult> {
    try {
      const users = await prisma.user.findMany({
        where: { role: role as any },
        select: { id: true },
      });

      let sent = 0;
      let failed = 0;

      for (const user of users) {
        const success = await this.sendToUser(user.id, title, body, data);
        if (success) sent++;
        else failed++;
      }

      return { success: true, sent, failed };
    } catch (error) {
      logger.error('Send to role failed', { role, error });
      return { success: false, sent: 0, failed: 0 };
    }
  }

  /**
   * Subscribe a user to push notifications
   */
  async subscribe(
    userId: string,
    subscription: PushSubscription
  ): Promise<boolean> {
    try {
      await prisma.pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        update: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userId,
        },
        create: {
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userId,
        },
      });

      logger.info('Push subscription added', { userId });
      return true;
    } catch (error) {
      logger.error('Subscribe failed', { userId, error });
      return false;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(endpoint: string): Promise<boolean> {
    try {
      await prisma.pushSubscription.delete({
        where: { endpoint },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get VAPID public key for client
   */
  getPublicKey(): string | undefined {
    return process.env.VAPID_PUBLIC_KEY;
  }
}

export const pushService = new PushService();
