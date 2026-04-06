/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Injectable, PLATFORM_ID, inject} from '@angular/core';
import {Router} from '@angular/router';
import {UserModel, UserRolesEnum} from '../models/user.model';
import {HttpClient, HttpHeaders, HttpErrorResponse} from '@angular/common/http';
import {environment} from '../../../environments/environment';
import {Auth, IdTokenResult} from '@angular/fire/auth';
import {UserService} from '../services/user.service';
import {
  OAuthProvider,
  signInWithPopup,
  UserCredential,
} from '@angular/fire/auth';
import {Observable, from, throwError, of} from 'rxjs';
import {catchError, tap, map, switchMap} from 'rxjs/operators';
import {isPlatformBrowser} from '@angular/common';

// Declare the 'google' global object from the Google Identity Services script
declare const google: any;

const FIREBASE_SESSION_KEY = 'firebase_session';
const USER_DETAILS = 'USER_DETAILS';
const LOGIN_ROUTE = '/login';

interface FirebaseSession {
  token: string;
  expiry: number; // Expiration timestamp in milliseconds
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth: Auth = inject(Auth);
  private platformId = inject(PLATFORM_ID);
  private readonly provider = new OAuthProvider('microsoft.com');

  // Store token temporarily in memory for the session
  private currentOAuthAccessToken: string | null = null;
  private firebaseIdToken: string | null = null; // To store the Firebase token for the test
  private firebaseTokenExpiry: number | null = null; // To store token expiration time (in ms)

  constructor(
    private router: Router,
    private httpClient: HttpClient,
    private userService: UserService,
  ) {
    this.provider.setCustomParameters({
      // Set custom params for the provider
      prompt: 'select_account',
    });
    this.loadSessionFromStorage();
  }

  /**
   * Sign-in method using Firebase OAuthProvider for Microsoft.
   *
   * @returns An Observable that emits the Firebase-compatible ID token.
   */
  signInWithMicrosoft(): Observable<string> {
    console.log('AuthService: signInWithMicrosoft started.');
    return from(signInWithPopup(this.auth, this.provider)).pipe(
      switchMap((userCredential: UserCredential) => {
        if (!userCredential.user) {
          console.error('AuthService: Firebase user not found after sign-in.');
          return throwError(
            () => new Error('Firebase user not found after sign-in.'),
          );
        }
        console.log('AuthService: Sign-in successful, retrieving ID token result.');
        return from(userCredential.user.getIdTokenResult());
      }),
      switchMap((idTokenResult: IdTokenResult) => {
        const token = idTokenResult.token;
        const expirationTime = Date.parse(idTokenResult.expirationTime);

        console.log('AuthService: ID token retrieved. Length:', token.length);

        this.firebaseIdToken = token;
        this.firebaseTokenExpiry = expirationTime;
        const session: FirebaseSession = {token, expiry: expirationTime};
        localStorage.setItem(FIREBASE_SESSION_KEY, JSON.stringify(session));

        console.log('AuthService: Syncing with backend...');
        return this.syncUserWithBackend$(token).pipe(
          map(() => token),
        );
      }),
      catchError((error: any) => {
        console.error('AuthService: Error during sign-in process:', error);
        return throwError(
          () => new Error(`Sign-in failed. Please try again. ${error}`),
        );
      }),
    );
  }

  /**
   * Asynchronously gets a valid Firebase token.
   * 1. Checks for a valid, non-expired token in memory/cache.
   * 2. If expired or missing, attempts a silent refresh.
   * 3. If silent refresh fails, it emits an error, signaling a required re-login.
   */
  getValidFirebaseToken$(): Observable<string> {
    console.log('AuthService: getValidFirebaseToken$ check.');
    if (!this.isLoggedIn()) {
      console.warn('AuthService: User context not valid or expired.');
      return throwError(
        () => new Error('User session is not valid or has expired. 1'),
      );
    }

    const currentUser = this.auth.currentUser;
    if (currentUser) {
      console.log('AuthService: currentUser found, forcing token refresh.');
      return from(currentUser.getIdToken(true)).pipe(
        tap((token: string) => {
          console.log('AuthService: token refreshed. Length:', token.length);
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expiry = payload.exp * 1000;

          this.firebaseIdToken = token;
          this.firebaseTokenExpiry = expiry;

          const session: FirebaseSession = {token, expiry};
          localStorage.setItem(FIREBASE_SESSION_KEY, JSON.stringify(session));
        }),
      );
    }

    console.log('AuthService: currentUser NOT found, falling back to cached token in localStorage.');
    return of(this.firebaseIdToken!);
  }



  /**
   * Asynchronously gets a valid Identity Platform token.
   * 1. Checks for a valid, non-expired token in memory/cache.
   * 2. If expired or missing, attempts a silent refresh.
   * 3. If silent refresh fails, it emits an error, signaling a required re-login.
   */
  getValidIdentityPlatformToken$(): Observable<string> {
    // First, check our own session info which is loaded from localStorage.
    // This is synchronous and tells us if we have a valid, non-expired token.
    if (!this.isLoggedIn()) {
      return of();
    }

    // Fallback case: The Firebase Auth instance is not yet initialized, but we
    // have a valid token from localStorage. We can use this for the current
    // request. The next request will likely hit the ideal case above.
    return of(this.firebaseIdToken!);
  }

  private syncUserWithBackend$(token: string): Observable<UserModel> {
    console.log('AuthService: syncUserWithBackend$ calling /users/me without manual Authorization header.');
    return this.httpClient
      .get<UserModel>(`${environment.backendURL}/users/me`)
      .pipe(
        tap((userDetails: UserModel) => {
          // The backend is the source of truth. Save the returned profile to local storage.
          localStorage.setItem(USER_DETAILS, JSON.stringify(userDetails));
          console.log('User profile successfully synced with backend.');
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Failed to sync user with backend', error);
          // This is a critical error, so we should propagate it.
          return throwError(
            () =>
              new Error(
                error?.error?.detail ||
                  `Could not synchronize user profile with the server. ${error?.error?.detail}`,
              ),
          );
        }),
      );
  }

  async logout(route: string = LOGIN_ROUTE) {
    return this.auth
      .signOut()
      .then(() => {
        this.currentOAuthAccessToken = null; // Clear stored token on logout
        // Clear Firebase session data
        this.firebaseIdToken = null;
        this.firebaseTokenExpiry = null;
        localStorage.removeItem(FIREBASE_SESSION_KEY);
        localStorage.removeItem(USER_DETAILS);
        localStorage.removeItem('showTooltip');
        void this.router.navigateByUrl(route);
      })
      .catch(e => {
        console.error('Sign Out Error', e);
        localStorage.removeItem(FIREBASE_SESSION_KEY);
        localStorage.removeItem(USER_DETAILS);
        localStorage.removeItem('showTooltip');
        void this.router.navigate([LOGIN_ROUTE]);
      });
  }

  isLoggedIn() {
    if (!isPlatformBrowser(this.platformId)) return false;

    // Check if the in-memory token is valid
    const now = Date.now();
    const isTokenValid = !!(
      this.firebaseIdToken &&
      this.firebaseTokenExpiry &&
      this.firebaseTokenExpiry > now
    );

    if (!isTokenValid && this.router.url !== LOGIN_ROUTE) {
      void this.router.navigate([LOGIN_ROUTE]);
    }

    return isTokenValid;
  }

  private loadSessionFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const sessionStr = localStorage.getItem(FIREBASE_SESSION_KEY);
    if (sessionStr) {
      const session: FirebaseSession = JSON.parse(sessionStr);
      // Check if the stored session is still valid
      if (session.expiry > Date.now()) {
        this.firebaseIdToken = session.token;
        this.firebaseTokenExpiry = session.expiry;
      } else {
        // If expired, remove it from storage.
        localStorage.removeItem(FIREBASE_SESSION_KEY);
      }
    }
  }

  isUserLoggedIn() {
    if (!isPlatformBrowser(this.platformId)) return false;

    const isUserLoggedIn = localStorage.getItem(FIREBASE_SESSION_KEY) !== null;
    return isUserLoggedIn;
  }

  isUserAdmin() {
    if (!isPlatformBrowser(this.platformId)) return false;

    const user_role = this.userService.getUserDetails()?.roles;
    return user_role?.includes(UserRolesEnum.ADMIN) || false;
  }

  getToken() {
    return this.firebaseIdToken;
  }

  setOAuthAccessToken(token: string | null): void {
    this.currentOAuthAccessToken = token;
  }

  getOAuthAccessToken(): string | null {
    // Renamed from getAccessToken for clarity
    return this.currentOAuthAccessToken;
  }

  /**
   * Retrieves the currently stored access token.
   */
  getAccessToken(): string | null {
    // Note: Tokens expire (usually after 1 hour).
    // A robust implementation would check expiry or refresh the token.
    // Firebase Auth automatically handles ID token refresh, but OAuth access token
    // refresh requires re-authentication or more complex flows not covered here.
    // For a simple deploy button click, getting a fresh token on sign-in might suffice.
    return this.currentOAuthAccessToken;
  }
}
