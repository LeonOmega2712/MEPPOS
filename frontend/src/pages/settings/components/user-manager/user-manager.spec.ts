import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserManagerComponent } from './user-manager';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import type { User } from '../../../../core/models';

const USER_1: User = {
  id: 1,
  username: 'mesero1',
  displayName: 'Mesero Uno',
  role: 'WAITER',
  active: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const USER_2: User = { ...USER_1, id: 2, username: 'mesero2', displayName: 'Mesero Dos' };

describe('UserManagerComponent — issue #51 cleanup', () => {
  let fixture: ComponentFixture<UserManagerComponent>;
  let component: UserManagerComponent;

  let usersData: ReturnType<typeof signal<User[] | null>>;
  let deleteSubject: Subject<void>;
  let userServiceMock: any;
  let authServiceMock: any;
  let toastServiceMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };
  let confirmDialogServiceMock: { confirm: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    usersData = signal<User[] | null>(null);
    deleteSubject = new Subject();

    userServiceMock = {
      users: usersData.asReadonly(),
      usersLoading: signal(false).asReadonly(),
      usersRevalidating: signal(false).asReadonly(),
      usersError: signal<unknown>(null).asReadonly(),
      ensureUsers: vi.fn(),
      refreshUsers: vi.fn(),
      createUser: vi.fn().mockReturnValue(new Subject().asObservable()),
      updateUser: vi.fn().mockReturnValue(new Subject().asObservable()),
      deleteUser: vi.fn().mockReturnValue(deleteSubject.asObservable()),
    };

    authServiceMock = { user: signal<User | null>(null).asReadonly() };

    toastServiceMock = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
    confirmDialogServiceMock = { confirm: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [UserManagerComponent],
      providers: [
        { provide: UserService, useValue: userServiceMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: ToastService, useValue: toastServiceMock },
        { provide: ConfirmDialogService, useValue: confirmDialogServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('deactivateUser() cleanup', () => {
    beforeEach(() => {
      usersData.set([USER_1, USER_2]);
      TestBed.flushEffects();
    });

    it('clears expandedUserId and resets draft after success, so opening another row does not trigger the unsaved-changes dialog', async () => {
      component.expandedUserId.set(USER_1.id);
      component.drafts[USER_1.id].displayName = 'Edited but not saved';

      await component.deactivateUser(USER_1);
      deleteSubject.next();
      deleteSubject.complete();

      expect(component.expandedUserId()).toBeNull();
      expect(component.hasDraftChanges(USER_1.id)).toBe(false);

      await component.onCollapseToggle(new Event('click'), USER_2.id);

      expect(confirmDialogServiceMock.confirm).toHaveBeenCalledTimes(1);
      expect(component.expandedUserId()).toBe(USER_2.id);
    });

    it('does NOT clear expanded state on error', async () => {
      component.expandedUserId.set(USER_1.id);
      component.drafts[USER_1.id].displayName = 'Edited';

      await component.deactivateUser(USER_1);
      deleteSubject.error(new Error('boom'));

      expect(component.expandedUserId()).toBe(USER_1.id);
      expect(component.hasDraftChanges(USER_1.id)).toBe(true);
    });
  });

  describe('permanentDeleteUser() cleanup', () => {
    it('clears expandedInactiveId after success', async () => {
      const inactive: User = { ...USER_1, id: 5, active: false };
      usersData.set([inactive]);
      TestBed.flushEffects();
      component.expandedInactiveId.set(inactive.id);

      await component.permanentDeleteUser(inactive);
      deleteSubject.next();
      deleteSubject.complete();

      expect(component.expandedInactiveId()).toBeNull();
      expect(component.drafts[inactive.id]).toBeUndefined();
    });
  });
});
