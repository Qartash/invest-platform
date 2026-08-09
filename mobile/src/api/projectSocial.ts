import { apiClient } from './client';
import { LocalizedText } from '../types';

/**
 * Questions, answers and the updates feed — the public conversation on a
 * project, as opposed to its finances.
 */

export type VoteKind = 'up' | 'helpful' | 'not_answer';
export type QuestionSort = 'top' | 'new' | 'unanswered';
export type ContentTarget = 'question' | 'answer' | 'update';

export interface SocialAuthor {
  id: string;
  /** Already masked by the server when the person keeps their name private. */
  fullName: string | null;
  avatarUrl: string | null;
  avatarEmoji: string | null;
  role: string;
}

export interface Answer {
  id: string;
  questionId: string;
  body: string;
  /** Null when the account is gone — the app renders a deleted user. */
  author: SocialAuthor | null;
  fromFounder: boolean;
  helpfulCount: number;
  notAnswerCount: number;
  hidden: boolean;
  hiddenReason: string | null;
  mine: boolean;
  myVotes: VoteKind[];
  createdAt: string;
}

export interface Question {
  id: string;
  projectId: string;
  /** Null when hidden from someone who is not its author. */
  body: string | null;
  author: SocialAuthor | null;
  upvoteCount: number;
  pinned: boolean;
  answered: boolean;
  answeredAt: string | null;
  hidden: boolean;
  hiddenReason: string | null;
  mine: boolean;
  /** Still amendable — the server refuses once anybody has replied. */
  editable: boolean;
  following: boolean;
  myVotes: VoteKind[];
  answers: Answer[];
  createdAt: string;
}

export interface QuestionPage {
  items: Question[];
  total: number;
  page: number;
  pageSize: number;
  unanswered: number;
}

export interface SimilarQuestion {
  id: string;
  body: string;
  answered: boolean;
  upvoteCount: number;
  createdAt: string;
}

export interface ProjectUpdate {
  id: string;
  projectId: string;
  title: string;
  body: string;
  photos: string[];
  /** Written by the platform when a financial report was published. */
  auto: boolean;
  autoPayload: {
    kind?: string;
    reportId?: string;
    questionId?: string;
    revenue?: number | null;
    dividends?: number | null;
    holders?: number | null;
  } | null;
  author: SocialAuthor | null;
  helpfulCount: number;
  readCount: number;
  editedAt: string | null;
  mine: boolean;
  editable: boolean;
  myVotes: VoteKind[];
  createdAt: string;
}

export interface UpdatePage {
  items: ProjectUpdate[];
  total: number;
  page: number;
  pageSize: number;
}

export interface VoteResult {
  voted: boolean;
  count: number;
}

// ── Questions ────────────────────────────────────────────────────────────────

export function fetchQuestions(projectId: string, sort: QuestionSort = 'top', page = 1) {
  return apiClient
    .get<QuestionPage>(`/projects/${projectId}/questions`, { params: { sort, page } })
    .then((r) => r.data);
}

export function fetchSimilarQuestions(projectId: string, text: string) {
  return apiClient
    .get<SimilarQuestion[]>(`/projects/${projectId}/questions/similar`, { params: { q: text } })
    .then((r) => r.data);
}

export function askQuestion(projectId: string, body: string) {
  return apiClient.post<Question>(`/projects/${projectId}/questions`, { body }).then((r) => r.data);
}

export function fetchQuestion(questionId: string) {
  return apiClient.get<Question>(`/questions/${questionId}`).then((r) => r.data);
}

export function editQuestion(questionId: string, body: string) {
  return apiClient.patch<Question>(`/questions/${questionId}`, { body }).then((r) => r.data);
}

export function deleteQuestion(questionId: string) {
  return apiClient.delete(`/questions/${questionId}`).then((r) => r.data);
}

/**
 * One call for both meanings: from the founder this is the answer, from anyone
 * else a follow-up. `alsoPostAsUpdate` and `pin` are founder-only and the server
 * refuses them from anybody else.
 */
export function answerQuestion(
  questionId: string,
  body: string,
  options: { alsoPostAsUpdate?: boolean; pin?: boolean } = {},
) {
  return apiClient.post<Answer>(`/questions/${questionId}/answers`, { body, ...options }).then((r) => r.data);
}

export function followQuestion(questionId: string, on: boolean) {
  return on
    ? apiClient.post(`/questions/${questionId}/follow`).then((r) => r.data)
    : apiClient.delete(`/questions/${questionId}/follow`).then((r) => r.data);
}

// ── Votes ────────────────────────────────────────────────────────────────────
//
// One route per target type, and each is a toggle: pressing again takes the vote
// back, which is what the response's `voted` reports.

export function voteOn(target: ContentTarget, id: string, kind: VoteKind) {
  const path = target === 'question' ? 'questions' : target === 'answer' ? 'answers' : 'updates';
  return apiClient.post<VoteResult>(`/${path}/${id}/vote`, { kind }).then((r) => r.data);
}

// ── Updates ──────────────────────────────────────────────────────────────────

export function fetchUpdates(projectId: string, page = 1) {
  return apiClient.get<UpdatePage>(`/projects/${projectId}/updates`, { params: { page } }).then((r) => r.data);
}

export function postUpdate(
  projectId: string,
  input: { title: string; body: string; photos?: string[]; notifyHolders?: boolean },
) {
  return apiClient.post<ProjectUpdate>(`/projects/${projectId}/updates`, input).then((r) => r.data);
}

export function editUpdate(
  updateId: string,
  input: { title?: string; body?: string; photos?: string[] },
) {
  return apiClient.patch<ProjectUpdate>(`/updates/${updateId}`, input).then((r) => r.data);
}

export function markUpdateRead(updateId: string) {
  return apiClient.post(`/updates/${updateId}/read`).then((r) => r.data);
}

// ── Reporting and moderation ─────────────────────────────────────────────────

export type ReportReason = 'off_platform' | 'contacts' | 'spam' | 'not_an_answer' | 'other';

export function reportContent(target: ContentTarget, id: string, reason: ReportReason, comment?: string) {
  const path = target === 'question' ? 'questions' : target === 'answer' ? 'answers' : 'updates';
  return apiClient.post(`/${path}/${id}/report`, { reason, comment }).then((r) => r.data);
}

export interface ReportGroup {
  targetType: ContentTarget;
  targetId: string;
  reportCount: number;
  reasons: string[];
  comments: string[];
  firstReportedAt: string;
  content: {
    body: string;
    author: SocialAuthor | null;
    hidden: boolean;
    fromFounder?: boolean;
    projectTitle: LocalizedText | null;
    createdAt: string;
  } | null;
}

export function fetchReports(status: 'pending' | 'hidden' | 'dismissed' = 'pending') {
  return apiClient.get<ReportGroup[]>('/moderation/reports', { params: { status } }).then((r) => r.data);
}

export interface NeglectedProject {
  projectId: string;
  title: LocalizedText;
  unansweredCount: number;
  /** Null when the founder has never posted anything at all. */
  silentDays: number | null;
}

export function fetchNeglectedProjects() {
  return apiClient.get<NeglectedProject[]>('/moderation/neglected-projects').then((r) => r.data);
}

export function resolveReport(
  target: ContentTarget,
  id: string,
  status: 'hidden' | 'dismissed',
  reason?: string,
) {
  return apiClient.post(`/moderation/${target}/${id}/resolve`, { status, reason }).then((r) => r.data);
}

export function unhideContent(target: ContentTarget, id: string) {
  return apiClient.post(`/moderation/${target}/${id}/unhide`).then((r) => r.data);
}
