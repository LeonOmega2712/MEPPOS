import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { IconComponent } from '../../../../shared/components/icon';
import { ROLE_LABELS } from '../../../../core/models';
import type { User, UserDraft, CreateUserPayload, UpdateUserPayload } from '../../../../core/models';

@Component({
  selector: 'app-user-manager',
  imports: [FormsModule, IconComponent],
  templateUrl: './user-manager.html',
})
export class UserManagerComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly confirmDialogService = inject(ConfirmDialogService);

  readonly loading = this.userService.usersLoading;
  readonly revalidating = this.userService.usersRevalidating;
  readonly error = this.userService.usersError;
  private readonly usersSignal = this.userService.users;

  saving = signal<number | 'new' | null>(null);
  expandedUserId = signal<number | 'new' | null>(null);
  expandedInactiveId = signal<number | null>(null);

  activeUsers = computed(() =>
    (this.usersSignal() ?? [])
      .filter((u) => u.active)
      .sort((a, b) => a.id - b.id)
  );

  inactiveUsers = computed(() =>
    (this.usersSignal() ?? [])
      .filter((u) => !u.active)
      .sort((a, b) => a.id - b.id)
  );

  drafts: Record<number, UserDraft> = {};
  newUser: CreateUserPayload = this.emptyUser();

  readonly roleLabels = ROLE_LABELS;

  constructor() {
    effect(() => {
      const items = this.usersSignal();
      if (!items) return;
      untracked(() => {
        const ids = new Set(items.map((u) => u.id));
        for (const item of items) {
          if (!this.drafts[item.id] || !this.hasDraftChanges(item.id)) {
            this.drafts[item.id] = this.toDraft(item);
          }
        }
        for (const id of Object.keys(this.drafts)) {
          if (!ids.has(Number(id))) delete this.drafts[Number(id)];
        }
      });
    });
  }

  ngOnInit(): void {
    this.userService.ensureUsers();
  }

  refresh(): void {
    this.userService.refreshUsers();
  }

  createUser(): void {
    if (!this.newUser.username.trim() || !this.newUser.password.trim() || !this.newUser.displayName.trim()) return;

    const inactive = this.inactiveUsers().find(
      (u) => u.username.toLowerCase() === this.newUser.username.trim().toLowerCase()
    );

    if (inactive) {
      this.saving.set('new');
      const payload: UpdateUserPayload = {
        username: this.newUser.username.trim(),
        displayName: this.newUser.displayName.trim(),
        role: this.newUser.role,
        password: this.newUser.password,
        active: true,
      };
      this.userService.updateUser(inactive.id, payload).subscribe({
        next: () => {
          this.newUser = this.emptyUser();
          this.saving.set(null);
          this.toastService.info(`Usuario "${inactive.username}" reactivado`);
          this.userService.refreshUsers();
        },
        error: () => {
          this.toastService.error('Error al reactivar usuario');
          this.saving.set(null);
        },
      });
      return;
    }

    this.saving.set('new');
    const payload: CreateUserPayload = {
      username: this.newUser.username.trim(),
      password: this.newUser.password,
      displayName: this.newUser.displayName.trim(),
      role: this.newUser.role,
    };
    this.userService.createUser(payload).subscribe({
      next: () => {
        this.newUser = this.emptyUser();
        this.saving.set(null);
        this.toastService.success('Usuario creado');
        this.userService.refreshUsers();
      },
      error: () => {
        this.toastService.error('Error al crear usuario');
        this.saving.set(null);
      },
    });
  }

  saveUser(user: User): void {
    const draft = this.drafts[user.id];
    if (!draft) return;
    this.saving.set(user.id);
    const payload: UpdateUserPayload = {
      username: draft.username,
      displayName: draft.displayName,
      role: draft.role,
    };
    if (draft.password.trim()) {
      payload.password = draft.password;
    }
    this.userService.updateUser(user.id, payload).subscribe({
      next: () => {
        this.saving.set(null);
        this.toastService.success('Usuario actualizado');
        this.userService.refreshUsers();
      },
      error: () => {
        this.toastService.error('Error al actualizar usuario');
        this.saving.set(null);
      },
    });
  }

  hasUnsavedChanges(): boolean {
    const expandedId = this.expandedUserId();
    if (expandedId === null) return false;
    return this.hasDraftChanges(expandedId);
  }

  discardChanges(): void {
    const expandedId = this.expandedUserId();
    if (expandedId !== null) {
      this.resetDraft(expandedId);
      this.expandedUserId.set(null);
    }
  }

  async onCollapseToggle(event: Event, userId: number | 'new'): Promise<void> {
    event.preventDefault();

    const currentExpandedId = this.expandedUserId();
    const isCurrentlyExpanded = currentExpandedId === userId;

    if (isCurrentlyExpanded) {
      if (userId !== 'new' && this.hasDraftChanges(userId)) {
        const confirmed = await this.confirmDialogService.confirm({
          message: 'Hay cambios sin guardar. ¿Desea descartarlos?',
        });
        if (!confirmed) return;
        this.resetDraft(userId);
      }
      this.expandedUserId.set(null);
    } else {
      if (currentExpandedId !== null) {
        if (this.hasDraftChanges(currentExpandedId)) {
          const confirmed = await this.confirmDialogService.confirm({
            message: 'Hay cambios sin guardar en otro usuario. ¿Desea descartarlos?',
          });
          if (!confirmed) return;
          this.resetDraft(currentExpandedId);
        }
      }
      this.expandedUserId.set(userId);
    }
  }

  hasDraftChanges(userId: number | 'new'): boolean {
    if (userId === 'new') {
      return this.hasNewUserChanges();
    }
    const original = (this.usersSignal() ?? []).find((u) => u.id === userId);
    const draft = this.drafts[userId];
    if (!original || !draft) return false;
    return (
      draft.username !== original.username ||
      draft.displayName !== original.displayName ||
      draft.role !== original.role ||
      draft.password.trim() !== ''
    );
  }

  resetDraft(userId: number | 'new'): void {
    if (userId === 'new') {
      this.resetNewUser();
      return;
    }
    const original = (this.usersSignal() ?? []).find((u) => u.id === userId);
    if (original) {
      this.drafts[userId] = this.toDraft(original);
    }
  }

  async deactivateUser(user: User): Promise<void> {
    if (this.isCurrentUser(user.id)) {
      this.toastService.warning('No puede desactivar su propio usuario');
      return;
    }
    const confirmed = await this.confirmDialogService.confirm({
      title: 'Desactivar usuario',
      message: `Se desactivará el usuario "${user.displayName}". ¿Desea continuar?`,
      confirmText: 'Desactivar',
    });
    if (!confirmed) return;
    this.saving.set(user.id);
    this.userService.deleteUser(user.id).subscribe({
      next: () => {
        this.saving.set(null);
        this.toastService.success('Usuario desactivado');
        this.userService.refreshUsers();
      },
      error: () => {
        this.toastService.error('Error al desactivar usuario');
        this.saving.set(null);
      },
    });
  }

  reactivateUser(user: User): void {
    this.saving.set(user.id);
    this.userService.updateUser(user.id, { active: true }).subscribe({
      next: () => {
        this.saving.set(null);
        this.toastService.success('Usuario reactivado');
        this.userService.refreshUsers();
      },
      error: () => {
        this.toastService.error('Error al reactivar usuario');
        this.saving.set(null);
      },
    });
  }

  async permanentDeleteUser(user: User): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      title: 'Eliminar usuario permanentemente',
      message: `Esta acción es irreversible. Se eliminará "${user.displayName}" de forma permanente. Escriba el nombre de usuario para confirmar:`,
      confirmText: 'Eliminar',
      requireInput: user.username,
    });
    if (!confirmed) return;
    this.saving.set(user.id);
    this.userService.deleteUser(user.id, true).subscribe({
      next: () => {
        this.saving.set(null);
        this.toastService.success('Usuario eliminado permanentemente');
        this.userService.refreshUsers();
      },
      error: () => {
        this.toastService.error('Error al eliminar usuario');
        this.saving.set(null);
      },
    });
  }

  isCurrentUser(userId: number): boolean {
    return this.authService.user()?.id === userId;
  }

  hasNewUserChanges(): boolean {
    return (
      !!this.newUser.username.trim() ||
      !!this.newUser.password.trim() ||
      !!this.newUser.displayName.trim() ||
      this.newUser.role !== 'WAITER'
    );
  }

  resetNewUser(): void {
    this.newUser = this.emptyUser();
  }

  private toDraft(user: User): UserDraft {
    return {
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      password: '',
    };
  }

  private emptyUser(): CreateUserPayload {
    return { username: '', password: '', displayName: '', role: 'WAITER' };
  }
}
