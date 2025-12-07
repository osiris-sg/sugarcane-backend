import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc.js';

export const telegramRouter = createTRPCRouter({
  // Get all subscribers for a category
  getSubscribers: publicProcedure
    .input(z.object({
      category: z.enum(['STOCK', 'MAINTENANCE']),
    }))
    .query(async ({ ctx, input }) => {
      const subscribers = await ctx.db.subscriber.findMany({
        where: {
          categories: {
            has: input.category,
          },
        },
        select: {
          chatId: true,
          username: true,
          firstName: true,
        },
      });
      return subscribers;
    }),

  // Get all subscribers (for admin view)
  getAllSubscribers: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.subscriber.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }),

  // Subscribe to a category
  subscribe: publicProcedure
    .input(z.object({
      chatId: z.string(),
      category: z.enum(['STOCK', 'MAINTENANCE']),
      username: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { chatId, category, username, firstName, lastName } = input;

      // Find or create subscriber
      let subscriber = await ctx.db.subscriber.findUnique({
        where: { chatId },
      });

      if (subscriber) {
        // Add category if not already subscribed
        if (!subscriber.categories.includes(category)) {
          subscriber = await ctx.db.subscriber.update({
            where: { chatId },
            data: {
              categories: {
                push: category,
              },
            },
          });
          return { success: true, message: `Subscribed to ${category.toLowerCase()} alerts` };
        }
        return { success: false, message: `Already subscribed to ${category.toLowerCase()} alerts` };
      }

      // Create new subscriber
      await ctx.db.subscriber.create({
        data: {
          chatId,
          username,
          firstName,
          lastName,
          categories: [category],
        },
      });

      return { success: true, message: `Subscribed to ${category.toLowerCase()} alerts` };
    }),

  // Unsubscribe from a category
  unsubscribe: publicProcedure
    .input(z.object({
      chatId: z.string(),
      category: z.enum(['STOCK', 'MAINTENANCE']),
    }))
    .mutation(async ({ ctx, input }) => {
      const { chatId, category } = input;

      const subscriber = await ctx.db.subscriber.findUnique({
        where: { chatId },
      });

      if (!subscriber) {
        return { success: false, message: 'You are not subscribed to any alerts' };
      }

      if (!subscriber.categories.includes(category)) {
        return { success: false, message: `Not subscribed to ${category.toLowerCase()} alerts` };
      }

      // Remove category
      const newCategories = subscriber.categories.filter(c => c !== category);

      if (newCategories.length === 0) {
        // Delete subscriber if no categories left
        await ctx.db.subscriber.delete({
          where: { chatId },
        });
      } else {
        await ctx.db.subscriber.update({
          where: { chatId },
          data: { categories: newCategories },
        });
      }

      return { success: true, message: `Unsubscribed from ${category.toLowerCase()} alerts` };
    }),

  // Get subscriptions for a chat ID
  getSubscriptions: publicProcedure
    .input(z.object({
      chatId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const subscriber = await ctx.db.subscriber.findUnique({
        where: { chatId: input.chatId },
      });

      return subscriber?.categories || [];
    }),

  // Create pending verification for maintenance
  createPendingVerification: publicProcedure
    .input(z.object({
      chatId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Delete any existing pending verification
      await ctx.db.pendingVerification.deleteMany({
        where: { chatId: input.chatId },
      });

      // Create new pending verification (expires in 5 minutes)
      await ctx.db.pendingVerification.create({
        data: {
          chatId: input.chatId,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      return { success: true };
    }),

  // Verify password for maintenance subscription
  verifyPassword: publicProcedure
    .input(z.object({
      chatId: z.string(),
      password: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { chatId, password } = input;

      // Check if there's a pending verification
      const pending = await ctx.db.pendingVerification.findUnique({
        where: { chatId },
      });

      if (!pending) {
        return { success: false, message: 'No pending verification. Please use /subscribe maintenance first.' };
      }

      if (pending.expiresAt < new Date()) {
        await ctx.db.pendingVerification.delete({ where: { chatId } });
        return { success: false, message: 'Verification expired. Please try again.' };
      }

      // Check password
      const correctPassword = process.env.MAINTENANCE_PASSWORD || 'admin123';
      if (password !== correctPassword) {
        return { success: false, message: 'Incorrect password. Please try again.' };
      }

      // Delete pending verification
      await ctx.db.pendingVerification.delete({ where: { chatId } });

      return { success: true };
    }),

  // Log notification (optional)
  logNotification: publicProcedure
    .input(z.object({
      type: z.string(),
      deviceId: z.string().optional(),
      deviceName: z.string().optional(),
      message: z.string(),
      recipients: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.notificationLog.create({
        data: input,
      });
      return { success: true };
    }),
});
