import { el } from './dom';
import type { Sheet } from './Sheet';
import { t } from '../i18n';
import {
  acceptFriendRequest,
  currentUser,
  fetchProfile,
  listFriends,
  onlineAvailable,
  sendFriendRequest,
  sendLoginEmail,
  signOut,
  updateProfile,
  verifyLoginCode,
  type CloudUser,
} from '../online/cloud';
import { resetProgress, syncNow, type SyncResult } from '../online/sync';
import { isEmail, normalizeFriendCode, normalizeLoginCode } from '../systems/sync';
import creditsJson from '../../data/credits.json';

const creditLines = creditsJson as string[];

const errorText = (e: unknown): string => t('account.error', { message: e instanceof Error ? e.message : String(e) });

/**
 * Konto-Knopf im Riff und die Karten dahinter: Login per Mail (Link oder Code),
 * Abgleich, Name, Freunde per Code.
 */
export class AccountMenu {
  private readonly button: HTMLButtonElement | null;
  private pendingEmail = '';

  constructor(
    root: HTMLElement,
    private readonly sheet: Sheet,
    private readonly onSynced: (result: SyncResult) => void,
    private readonly say: (text: string) => void,
  ) {
    if (!onlineAvailable()) {
      this.button = null;
      return;
    }
    this.button = el('button', 'account-button');
    this.button.type = 'button';
    this.button.textContent = t('account.button');
    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      void this.open();
    });
    root.append(this.button);
    void this.refreshButton();
  }

  async refreshButton(): Promise<void> {
    const user = await currentUser().catch(() => null);
    this.button?.classList.toggle('online', user !== null);
  }

  async open(): Promise<void> {
    const user = await currentUser().catch(() => null);
    if (user) await this.showLoggedIn(user);
    else if (this.pendingEmail) this.showCodeEntry();
    else this.showLogin();
  }

  private close = { label: t('riff.close'), onSelect: () => this.sheet.close() };
  private reset = {
    label: t('account.reset'),
    onSelect: () =>
      this.sheet.show(t('account.reset'), t('account.resetText'), [
        { label: t('account.resetYes'), onSelect: () => void resetProgress() },
        { label: t('account.resetNo'), onSelect: () => this.sheet.close() },
      ]),
  };
  private credits = { label: t('credits.title'), onSelect: () => this.sheet.show(t('credits.title'), creditLines.join(' · '), [this.close]) };

  private showLogin(): void {
    this.sheet.show(
      t('account.title'),
      t('account.loggedOut'),
      [
        {
          label: t('account.sendLink'),
          onSelect: async () => {
            const email = this.sheet.inputValue.trim();
            if (!isEmail(email)) return this.sheet.setText(t('account.invalidEmail'));
            this.sheet.setText(t('account.busy'));
            try {
              await sendLoginEmail(email);
              this.pendingEmail = email;
              this.showCodeEntry();
            } catch (e) {
              this.sheet.setText(errorText(e));
            }
          },
        },
        this.credits,
        this.reset,
        this.close,
      ],
      { id: 'account-email', type: 'email', inputMode: 'email', autocomplete: 'email', placeholder: t('account.emailPlaceholder') },
    );
  }

  private showCodeEntry(): void {
    this.sheet.show(
      t('account.title'),
      t('account.sent', { email: this.pendingEmail }),
      [
        {
          label: t('account.verify'),
          onSelect: async () => {
            const code = normalizeLoginCode(this.sheet.inputValue);
            if (!code) return this.sheet.setText(t('account.invalidCode'));
            this.sheet.setText(t('account.busy'));
            try {
              await verifyLoginCode(this.pendingEmail, code);
              this.pendingEmail = '';
              await this.afterLogin();
            } catch (e) {
              this.sheet.setText(errorText(e));
            }
          },
        },
        { label: t('account.otherEmail'), onSelect: () => ((this.pendingEmail = ''), this.showLogin()) },
        this.close,
      ],
      { id: 'account-code', type: 'text', inputMode: 'numeric', autocomplete: 'one-time-code', maxLength: 7, placeholder: t('account.codePlaceholder') },
    );
  }

  /** Nach erfolgreichem Login (Code oder Link): abgleichen und melden. */
  async afterLogin(): Promise<void> {
    this.sheet.close();
    await this.refreshButton();
    this.say(t('account.loggedInToast'));
    this.onSynced(await syncNow());
  }

  private async showLoggedIn(user: CloudUser): Promise<void> {
    this.sheet.show(t('account.title'), t('account.busy'), [this.close]);
    const profile = await fetchProfile(user.id).catch(() => null);
    const email = user.email ?? '';
    this.sheet.show(
      profile ? `${t('account.title')} · ${profile.name}` : t('account.title'),
      profile ? t('account.loggedIn', { email, code: profile.friendCode }) : t('account.loggedInNoProfile', { email }),
      [
        {
          label: t('account.syncNow'),
          onSelect: async () => {
            this.sheet.setText(t('account.busy'));
            const r = await syncNow();
            this.sheet.close();
            this.onSynced(r);
          },
        },
        { label: t('account.friends'), onSelect: () => void this.showFriends() },
        { label: t('account.rename'), onSelect: () => this.showRename(user, profile?.name ?? '') },
        this.credits,
        this.reset,
        {
          label: t('account.logout'),
          onSelect: async () => {
            await syncNow();
            await signOut().catch(() => {});
            this.sheet.close();
            await this.refreshButton();
            this.say(t('account.loggedOutToast'));
          },
        },
        this.close,
      ],
    );
  }

  private showRename(user: CloudUser, name: string): void {
    this.sheet.show(
      t('account.renameTitle'),
      '',
      [
        {
          label: t('account.save'),
          onSelect: async () => {
            const next = this.sheet.inputValue.trim().slice(0, 24);
            if (!next) return;
            try {
              await updateProfile(user.id, { name: next });
              await this.showLoggedIn(user);
            } catch (e) {
              this.sheet.setText(errorText(e));
            }
          },
        },
        { label: t('account.back'), onSelect: () => void this.showLoggedIn(user) },
      ],
      { id: 'account-name', type: 'text', placeholder: t('account.namePlaceholder'), maxLength: 24, value: name },
    );
  }

  private async showFriends(note = ''): Promise<void> {
    this.sheet.show(t('friends.title'), t('account.busy'), [this.close]);
    let friends;
    try {
      friends = await listFriends();
    } catch (e) {
      this.sheet.show(t('friends.title'), errorText(e), [this.close]);
      return;
    }
    const accepted = friends.filter((f) => f.direction === 'friend');
    const incoming = friends.filter((f) => f.direction === 'incoming');
    const outgoing = friends.filter((f) => f.direction === 'outgoing');
    const lines = [
      note,
      accepted.length === 0 ? t('friends.empty') : accepted.map((f) => t('friends.entry', { name: f.name, level: f.reefLevel })).join(', '),
      outgoing.map((f) => t('friends.outgoing', { name: f.name })).join(', '),
    ].filter(Boolean);
    this.sheet.show(
      t('friends.title'),
      lines.join(' · '),
      [
        {
          label: t('friends.add'),
          onSelect: async () => {
            const code = normalizeFriendCode(this.sheet.inputValue);
            if (!code) return this.sheet.setText(t('friends.invalidCode'));
            try {
              const result = await sendFriendRequest(code);
              await this.showFriends(t(`friends.result.${result}`));
            } catch (e) {
              this.sheet.setText(errorText(e));
            }
          },
        },
        ...incoming.map((f) => ({
          label: t('friends.accept', { name: f.name }),
          color: f.avatarColor,
          onSelect: async () => {
            await acceptFriendRequest(f.id).catch(() => false);
            await this.showFriends(t('friends.result.accepted'));
          },
        })),
        { label: t('account.back'), onSelect: () => void this.open() },
      ],
      { id: 'friend-code', type: 'text', placeholder: t('friends.codePlaceholder'), maxLength: 7, autocomplete: 'off' },
    );
  }
}
