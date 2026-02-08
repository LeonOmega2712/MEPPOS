import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import type { ApiResponse, MenuCategory } from '../models';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getMenu(): Observable<MenuCategory[]> {
    return this.http
      .get<ApiResponse<MenuCategory[]>>(`${this.baseUrl}/menu`)
      .pipe(map((response) => response.data));
  }
}
