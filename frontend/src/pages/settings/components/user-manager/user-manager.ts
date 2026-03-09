import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { IconComponent } from '../../../../shared/components/icon';
import { ROLE_LABELS } from '../../../../core/models';
import type { User, CreateUserPayload, UpdateUserPayload, Role } from '../../../../core/models';

interface UserDraft {
  username: string;
  displayName: string;
  role: Role;
  password: string;
}

@Component({
  selector: 'app-user-manager',
  imports: [FormsModule, IconComponent],
  templateUrl: './user-manager.html',
  styleUrl: './user-manager.css',
})
export class UserManagerComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly confirmDialogService = inject(ConfirmDialogService);

  users = signal<User[]>([]);
  loading = signal(true);
  saving = signal<number | 'new' | null>(null);
  expandedUserId = signal<number | 'new' | null>(null);
  expandedInactiveId = signal<number | null>(null);

  activeUsers = computed(() =>
    this.users()
      .filter((u) => u.active)
      .sort((a, b) => a.id - b.id)
  );

  inactiveUsers = computed(() =>
    this.users()
      .filter((u) => !u.active)
      .sort((a, b) => a.id - b.id)
  );

  drafts: Record<number, UserDraft> = {};
  newUser: CreateUserPayload = this.emptyUser();

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    if (this.users().length === 0) {
      this.loading.set(true);
    }
    this.userService.getUsers().subscribe({
      next: (data) => {
        this.users.set(data);
        this.initDrafts(data);
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Error al cargar usuarios');
        this.loading.set(false);
      },
    });
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
          this.loadUsers();
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
        this.loadUsers();
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
        this.loadUsers();
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
    const original = this.users().find((u) => u.id === userId);
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
    const original = this.users().find((u) => u.id === userId);
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
        this.loadUsers();
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
        this.loadUsers();
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
        this.loadUsers();
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

  readonly roleLabels = ROLE_LABELS;

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

  private initDrafts(users: User[]): void {
    this.drafts = {};
    for (const user of users) {
      this.drafts[user.id] = this.toDraft(user);
    }
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
