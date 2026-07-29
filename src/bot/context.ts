import type { Context, Scenes } from 'telegraf';
import type { User } from '../generated/prisma/client.js';
import type { ContentKey } from '../domain/content/keys.js';
import type { ContentParams } from '../domain/content/content.service.js';
import type { Logger } from '../infra/logger.js';

/** Дані, які сцена тримає між кроками */
export interface WizardState extends Record<string, unknown> {
  phone?: string;
  fullName?: string;
}

export interface AppSceneSession extends Scenes.WizardSessionData {
  state: WizardState;
}

export interface AppSession extends Scenes.WizardSession<AppSceneSession> {}

export interface AppContext extends Context {
  session: AppSession;
  scene: Scenes.SceneContextScene<AppContext, AppSceneSession>;
  wizard: Scenes.WizardContextWizard<AppContext>;
  user: User;
  log: Logger;
  t(key: ContentKey, params?: ContentParams): Promise<string>;
  reply_t(key: ContentKey, params?: ContentParams, extra?: object): Promise<unknown>;
}
