import { z } from 'zod';

export const updateProfileSchema = z.object({
    firstName: z.string().min(2, 'First name must be at least 2 characters').max(128).optional(),
    lastName: z.string().min(2, 'Last name must be at least 2 characters').max(128).optional(),
    avatar: z.string().url('Invalid avatar URL').optional(),
    companyName: z.string().max(256).optional(),
    youtubeChannel: z.string().url('Invalid YouTube channel URL').or(z.literal('')).optional(),
    notificationEmail: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
