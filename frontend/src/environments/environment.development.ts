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

export const environment = {
  firebase: {
    apiKey: 'AIzaSyBvFqZXvhrxF9NH5Xx5WMpNa4SPk8J46CU',
    authDomain: 'test-project2-491910.firebaseapp.com',
    projectId: 'test-project2-491910',
    storageBucket: 'test-project2-491910.firebasestorage.app',
    messagingSenderId: '115764326296',
    appId: '1:115764326296:web:7626a2399c78601b8845ed',
    measurementId: 'G-1QXC10KHMX',
  },
  production: true,
  isLocal: false,
  backendURL: 'https://creative-studio-backend-115764326296.us-central1.run.app/api',
  EMAIL_REGEX:
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  ADMIN: 'admin',
  GOOGLE_CLIENT_ID: '',
};
