import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { CategoryService } from './category.service';
import { ProductService } from './product.service';
import { UserService } from './user.service';
import type { ApiResponse, AuthUser, AuthResponse, LoginRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly categoryService = inject(CategoryService);
  private readonly productService = inject(ProductService);
  private readonly userService = inject(UserService);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  private readonly _accessToken = signal<string | null>(null);
  private readonly _user = signal<AuthUser | null>(null);
  private readonly _initialized = signal(false);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._accessToken());
  readonly isAdmin = computed(() => this._user()?.role === 'ADMIN');
  readonly initialized = this._initialized.asReadonly();

  get accessToken(): string | null {
    return this._accessToken();
  }

  login(credentials: LoginRequest): Observable<AuthUser> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.baseUrl}/login`, credentials, {
        withCredentials: true,
      })
      .pipe(
        map((response) => {
          this._accessToken.set(response.data.accessToken);
          this._user.set(response.data.user);
          return response.data.user;
        }),
      );
  }

  logout(): void {
    this.http
      .post(`${this.baseUrl}/logout`, {}, { withCredentials: true })
      .subscribe();
    this._accessToken.set(null);
    this._user.set(null);
    this.categoryService.invalidateCategories();
    this.productService.invalidateProducts();
    this.userService.invalidateUsers();
    this.router.navigate(['/login']);
  }

  refresh(): Observable<boolean> {
    return this.http
      .post<ApiResponse<AuthResponse>>(
        `${this.baseUrl}/refresh`,
        {},
        { withCredentials: true },
      )
      .pipe(
        tap((response) => {
          this._accessToken.set(response.data.accessToken);
          this._user.set(response.data.user);
        }),
        map(() => true),
        catchError(() => {
          this._accessToken.set(null);
          this._user.set(null);
          return of(false);
        }),
      );
  }

  initialize(): Observable<boolean> {
    return this.refresh().pipe(
      tap(() => this._initialized.set(true)),
    );
  }
}
