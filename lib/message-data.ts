export type QuickReplyOption = {
  label: string;
  description: string;
  metadata: string;
};

export type Cta = {
  label: string;
  url: string;
};

export type AttachmentKind = "none" | "media" | "location_coord" | "location_place";

export type MessageDraft = {
  text: string;
  attachmentKind: AttachmentKind;
  mediaId: string;
  latitude: string;
  longitude: string;
  placeId: string;
  quickReplies: QuickReplyOption[];
  ctas: Cta[];
  customProfileId: string;
};

export const emptyDraft = (): MessageDraft => ({
  text: "",
  attachmentKind: "none",
  mediaId: "",
  latitude: "",
  longitude: "",
  placeId: "",
  quickReplies: [],
  ctas: [],
  customProfileId: "",
});

export function buildMessageData(draft: MessageDraft): Record<string, unknown> {
  const messageData: Record<string, unknown> = {
    text: draft.text,
  };

  const options = draft.quickReplies
    .filter((option) => option.label.trim())
    .slice(0, 20)
    .map((option) => {
      const next: Record<string, string> = { label: option.label.trim() };
      if (option.description.trim()) next.description = option.description.trim();
      if (option.metadata.trim()) next.metadata = option.metadata.trim();
      return next;
    });
  if (options.length) {
    messageData.quick_reply = { type: "options", options };
  }

  const ctas = draft.ctas
    .filter((cta) => cta.label.trim() && cta.url.trim())
    .map((cta) => ({
      type: "web_url",
      label: cta.label.trim(),
      url: cta.url.trim(),
    }));
  if (ctas.length) messageData.ctas = ctas;

  if (draft.attachmentKind === "media" && draft.mediaId.trim()) {
    messageData.attachment = {
      type: "media",
      media: { id: draft.mediaId.trim() },
    };
  }
  if (draft.attachmentKind === "location_coord" && draft.latitude && draft.longitude) {
    messageData.attachment = {
      type: "location",
      location: {
        type: "shared_coordinate",
        shared_coordinate: {
          coordinates: {
            type: "Point",
            coordinates: [Number(draft.longitude), Number(draft.latitude)],
          },
        },
      },
    };
  }
  if (draft.attachmentKind === "location_place" && draft.placeId.trim()) {
    messageData.attachment = {
      type: "location",
      location: {
        type: "shared_place",
        shared_place: {
          place: { id: draft.placeId.trim() },
        },
      },
    };
  }

  return messageData;
}
