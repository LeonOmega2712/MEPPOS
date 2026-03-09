import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import type { ApiResponse, User, CreateUserPayload, UpdateUserPayload } from '../models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  getUsers(): Observable<User[]> {
    return this.http
      .get<ApiResponse<User[]>>(this.baseUrl)
      .pipe(map((response) => response.data));
  }

  createUser(data: CreateUserPayload): Observable<User> {
    return this.http
      .post<ApiResponse<User>>(this.baseUrl, data)
      .pipe(map((response) => response.data));
  }

  updateUser(id: number, data: UpdateUserPayload): Observable<User> {
    return this.http
      .put<ApiResponse<User>>(`${this.baseUrl}/${id}`, data)
      .pipe(map((response) => response.data));
  }

  deleteUser(id: number, permanent = false): Observable<void> {
    const url = permanent
      ? `${this.baseUrl}/${id}?permanent=true`
      : `${this.baseUrl}/${id}`;
    return this.http
      .delete<ApiResponse<void>>(url)
      .pipe(map(() => undefined));
  }
}
