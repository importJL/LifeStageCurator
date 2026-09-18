export type NotificationType = 'approved' | 'rejected' | 'comment' | 'reply' | 'like' | 'save';

export type AppNotification = {
  id: string;
  recipientEmail: string;
  type: NotificationType;
  actorName: string;
  articleId: string;
  articleTitle: string;
  commentPreview?: string;
  createdAt: string;
  read: boolean;
};

export const notificationsKey = 'lsc-notifications';
export const notificationsUpdatedEvent = 'lsc-notification-updated';

const notificationLabels: Record<NotificationType, string> = {
  approved: 'Approved',
  rejected: 'Not accepted',
  comment: 'New comment',
  reply: 'New reply',
  like: 'New like',
  save: 'Saved'
};

export function notificationLabel(type: NotificationType): string {
  return notificationLabels[type];
}

export function notificationMessage(notification: AppNotification): string {
  const title = `“${notification.articleTitle}”`;
  switch (notification.type) {
    case 'approved':
      return `Your submission ${title} was approved and published.`;
    case 'rejected':
      return `Your submission ${title} was not accepted this time.`;
    case 'comment':
      return `${notification.actorName} commented on ${title}`;
    case 'reply':
      return `${notification.actorName} also commented on ${title}`;
    case 'like':
      return `${notification.actorName} liked ${title}`;
    case 'save':
      return `${notification.actorName} saved ${title}`;
    default:
      return title;
  }
}

function newNotificationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isNotification(value: unknown): value is AppNotification {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppNotification>;
  const type = candidate.type as NotificationType | undefined;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.recipientEmail === 'string' &&
    typeof candidate.actorName === 'string' &&
    typeof candidate.articleId === 'string' &&
    typeof candidate.articleTitle === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.read === 'boolean' &&
    (type === 'approved' || type === 'rejected' || type === 'comment' || type === 'reply' || type === 'like' || type === 'save')
  );
}

export function persistNotifications(notifications: AppNotification[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(notificationsKey, JSON.stringify(notifications));
  window.dispatchEvent(new Event(notificationsUpdatedEvent));
}

export function loadNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return [];
  const stored = window.localStorage.getItem(notificationsKey);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isNotification);
  } catch {
    return [];
  }
}

export function notificationsFor(email: string): AppNotification[] {
  return loadNotifications()
    .filter(notification => notification.recipientEmail === email.toLowerCase())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function unreadCount(email: string): number {
  return notificationsFor(email).filter(notification => !notification.read).length;
}

export function pushNotification(input: {
  recipientEmail?: string;
  type: NotificationType;
  actorName: string;
  articleId: string;
  articleTitle: string;
  commentPreview?: string;
}): AppNotification | null {
  if (typeof window === 'undefined' || !input.recipientEmail) return null;
  const notification: AppNotification = {
    id: newNotificationId(),
    recipientEmail: input.recipientEmail.toLowerCase(),
    type: input.type,
    actorName: input.actorName,
    articleId: input.articleId,
    articleTitle: input.articleTitle,
    commentPreview: input.commentPreview,
    createdAt: new Date().toISOString(),
    read: false
  };
  persistNotifications([notification, ...loadNotifications()]);
  return notification;
}

export function markNotificationRead(id: string): AppNotification[] {
  const next = loadNotifications().map(notification =>
    notification.id === id ? { ...notification, read: true } : notification
  );
  persistNotifications(next);
  return next;
}

export function markAllNotificationsRead(email: string): AppNotification[] {
  const recipient = email.toLowerCase();
  const next = loadNotifications().map(notification =>
    notification.recipientEmail === recipient ? { ...notification, read: true } : notification
  );
  persistNotifications(next);
  return next;
}
