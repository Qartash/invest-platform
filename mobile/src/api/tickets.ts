import { apiClient } from './client';
import { Ticket } from '../types';

export function fetchMyTickets() {
  return apiClient.get<Ticket[]>('/tickets/mine').then((r) => r.data);
}

export function buyTicket(projectId: string, quantity: number) {
  return apiClient.post<Ticket>('/tickets/buy', { projectId, quantity }).then((r) => r.data);
}

export function listTicketForSale(ticketIds: string[], quantity: number, askingPrice: number) {
  return apiClient.patch<Ticket[]>('/tickets/list', { ticketIds, quantity, askingPrice }).then((r) => r.data);
}

export function cancelTicketListing(ticketId: string) {
  return apiClient.patch<Ticket>(`/tickets/${ticketId}/unlist`).then((r) => r.data);
}

export function buyListing(ticketId: string, quantity?: number) {
  return apiClient.post<Ticket>(`/tickets/${ticketId}/buy-listing`, { quantity }).then((r) => r.data);
}
