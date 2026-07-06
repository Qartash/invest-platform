import { Platform } from 'react-native';
import { apiClient } from './client';
import { AuthUser, InvestorProfile } from '../types';

export function fetchMe() {
  return apiClient.get<AuthUser>('/users/me').then((r) => r.data);
}

export function updateMe(data: {
  fullName?: string;
  phone?: string;
  telegram?: string;
  birthDate?: string;
  gender?: string;
  bio?: string;
  occupation?: string;
  linkedin?: string;
  shareContactsPublicly?: boolean;
  avatarEmoji?: string;
}) {
  return apiClient.patch<AuthUser>('/users/me', data).then((r) => r.data);
}

export async function uploadAvatar(file: { uri: string; name: string; type: string }) {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const blob = await fetch(file.uri).then((r) => r.blob());
    formData.append('file', blob, file.name);
  } else {
    formData.append('file', file as unknown as Blob);
  }
  return apiClient
    .post<AuthUser>('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
}

export function fetchInvestorProfile(id: string) {
  return apiClient.get<InvestorProfile>(`/users/${id}/investor-profile`).then((r) => r.data);
}
