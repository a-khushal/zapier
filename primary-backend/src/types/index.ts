import { z } from "zod";

export const SignUpSchema = z.object({
    userName: z.string().min(3),
    email: z.string().email(),
    password: z.string().min(8),
})

export const SignInSchema = z.object({
    email: z.string().email(),
    password: z.string(),
})

export const ZapCreateSchema = z.object({
    availableTriggerId: z.string(),
    actions: z.array(z.object({
        availableActionId: z.string(),
        actionMetadata: z.any().optional()
    })),
})

const PostWebhookHeaderSchema = z.object({
    key: z.string(),
    value: z.string(),
});

const PostWebhookAuthSchema = z.union([
    z.object({ type: z.literal("none") }),
    z.object({
        type: z.literal("api_key"),
        key: z.string(),
        value: z.string(),
        addTo: z.enum(["header", "query"]),
    }),
]);

const PostWebhookMetadataSchema = z.object({
    url: z.string().url(),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
    headers: z.array(PostWebhookHeaderSchema).optional(),
    bodyTemplate: z.string().optional(),
    auth: PostWebhookAuthSchema.optional(),
});

export const TestPostWebhookSchema = z.object({
    actionMetadata: PostWebhookMetadataSchema,
    samplePayload: z.any(),
});
