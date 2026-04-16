import { z } from "zod";

const PLACEHOLDER_REGEX = /\{\{\s*payload\.([a-zA-Z0-9_.]+)\s*\}\}/g;

function isHttpOrHttpsUrl(value: string) {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

function isBodyTemplateJson(template: string) {
    try {
        const testRendered = template.replace(PLACEHOLDER_REGEX, "null");
        JSON.parse(testRendered);
        return true;
    } catch {
        return false;
    }
}

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
    triggerMetadata: z.any().optional(),
    actions: z.array(z.object({
        availableActionId: z.string(),
        actionMetadata: z.any().optional()
    })),
})

export const ZapUpdateSchema = z.object({
    actions: z.array(z.object({
        id: z.string(),
        actionMetadata: z.any().optional(),
    })).min(1),
});

export const ZapStatusUpdateSchema = z.object({
    isActive: z.boolean(),
});

const PostWebhookHeaderSchema = z.object({
    key: z.string().trim().min(1),
    value: z.string(),
});

const PostWebhookMetadataSchema = z.object({
    url: z.string().url().refine(isHttpOrHttpsUrl, {
        message: "URL must be http or https",
    }),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
    headers: z.array(PostWebhookHeaderSchema).optional(),
    bodyTemplate: z.string().optional(),
}).superRefine((metadata, ctx) => {
    const method = (metadata.method || "POST").toUpperCase();

    if (method === "GET" && metadata.bodyTemplate) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "GET method cannot have a body template",
            path: ["bodyTemplate"],
        });
    }

    if (metadata.bodyTemplate && !isBodyTemplateJson(metadata.bodyTemplate)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Body template must be valid JSON after placeholder substitution",
            path: ["bodyTemplate"],
        });
    }
});

export const TestPostWebhookSchema = z.object({
    actionMetadata: PostWebhookMetadataSchema,
    samplePayload: z.any(),
});

const SlackWebhookMetadataSchema = z.object({
    webhookUrl: z.string().url().refine(isHttpOrHttpsUrl, {
        message: "Webhook URL must be http or https",
    }),
    messageTemplate: z.string().trim().min(1),
    username: z.string().optional(),
    iconEmoji: z.string().optional(),
    channel: z.string().optional(),
});

export const TestSlackWebhookSchema = z.object({
    actionMetadata: SlackWebhookMetadataSchema,
    samplePayload: z.any(),
});

export const ValidatePostWebhookMetadataSchema = PostWebhookMetadataSchema;
export const ValidateSlackWebhookMetadataSchema = SlackWebhookMetadataSchema;
