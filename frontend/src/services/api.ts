import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'
});

export interface HardwareProfile {
  gpu?: {
    name?: string | null;
    total_vram_gb?: number | null;
    free_vram_gb?: number | null;
    utilization_percent?: number | null;
  } | null;
  cpu: {
    model?: string | null;
    cores_physical?: number | null;
    cores_logical?: number | null;
    instruction_sets: string[];
  };
  memory: {
    total_gb?: number | null;
    available_gb?: number | null;
  };
  os: string;
}

export interface LocalModel {
  id: string;
  name: string;
  modality: string;
  version?: string | null;
  path: string;
  size_bytes?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  model_metadata: Record<string, unknown>;
}

export interface LocalModelListResponse {
  models: LocalModel[];
}

export interface CreateModelPayload {
  source_id: string;
  modality: string;
  executor: string;
  auto_start?: boolean;
}

export interface DiscoveredModel {
  repo_id: string;
  name?: string | null;
  task?: string | null;
  likes?: number | null;
  tags: string[];
  downloads?: number | null;
  compatibility?: {
    status: 'compatible' | 'marginal' | 'incompatible';
    score: number;
    reason: string;
  } | null;
}

export interface ModelSearchFilters {
  query?: string | null;
  task?: string | null;
  limit?: number;
  include_compatibility?: boolean;
}

export interface ModelSearchResponse {
  items: DiscoveredModel[];
}

export type DownloadStatus = 'queued' | 'downloading' | 'completed' | 'failed';

export interface DownloadTask {
  task_id: string;
  source_id: string;
  modality: string;
  executor: string;
  status: DownloadStatus;
  progress: number;
  error?: string | null;
  model_id?: string | null;
}

interface DownloadTaskListResponse {
  items: DownloadTask[];
}

export interface ExecutorStatus {
  name: string;
  is_running: boolean;
  healthy: boolean;
  detail: Record<string, unknown>;
}

export interface ExecutorStatusResponse {
  executor: ExecutorStatus;
}

export interface ExecutionRequest {
  model_id?: string | null;
  parameters: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

export interface ExecutionResponse {
  task_id?: string | null;
  result: Record<string, unknown> | null;
  status: string;
  metadata?: Record<string, unknown>;
}

// Hardware API
export async function fetchHardwareProfile(): Promise<HardwareProfile> {
  const { data } = await api.get<HardwareProfile>('/hardware');
  return data;
}

// Model Management API
export async function fetchLocalModels(): Promise<LocalModel[]> {
  const { data } = await api.get<LocalModelListResponse>('/models/local');
  return data.models;
}

export async function scheduleDownload(payload: CreateModelPayload): Promise<DownloadTask> {
  const { data } = await api.post<DownloadTask>('/models/download', payload);
  return data;
}

export async function fetchDownloads(): Promise<DownloadTask[]> {
  const { data } = await api.get<DownloadTaskListResponse>('/models/downloads');
  return data.items;
}

export async function discoverModels(filters: ModelSearchFilters): Promise<DiscoveredModel[]> {
  const { data } = await api.post<ModelSearchResponse>('/models/discover', filters);
  return data.items;
}

export async function deleteModel(modelId: string): Promise<void> {
  await api.delete(`/models/${modelId}`);
}

export async function scanLocalModels(): Promise<{ success: boolean; message: string; counts: Record<string, number> }> {
  const { data } = await api.post('/models/scan');
  return data;
}

// Executor API
export async function getExecutorStatus(executorName: string): Promise<ExecutorStatus> {
  const { data } = await api.get<ExecutorStatusResponse>(`/executors/${executorName}/status`);
  return data.executor;
}

export async function executeJob(
  executorName: string,
  request: ExecutionRequest
): Promise<ExecutionResponse> {
  const { data } = await api.post<ExecutionResponse>(
    `/executors/${executorName}/execute`,
    request
  );
  return data;
}

export async function getTaskStatus(
  executorName: string,
  taskId: string
): Promise<ExecutionResponse> {
  const { data } = await api.get<ExecutionResponse>(
    `/executors/${executorName}/tasks/${taskId}`
  );
  return data;
}

export async function startExecutor(executorName: string): Promise<{ status: string; executor: string; pid?: number }> {
  const { data } = await api.post(`/executors/${executorName}/start`);
  return data;
}

export async function loadModelIntoExecutor(executorName: string, modelName: string): Promise<{ status: string; model: string; info?: any }> {
  const { data } = await api.post(`/executors/${executorName}/load-model`, { model_name: modelName });
  return data;
}

export async function getModelInfo(executorName: string, modelName: string): Promise<{ model_name: string; default_parameters: any; info?: any }> {
  const { data } = await api.get(`/executors/${executorName}/model-info`, { params: { model_name: modelName } });
  return data;
}

// STT API
export interface STTExecutor {
  name: string;
  runtime: string;
  is_running: boolean;
  healthy: boolean;
  device?: string;
  compute_type?: string;
  detail: Record<string, unknown>;
}

export interface STTExecutorsResponse {
  executors: Record<string, STTExecutor>;
  recommended: string;
  description: Record<string, string>;
}

export interface WhisperModel {
  name: string;
  params: string;
  vram: string;
  speed: string;
  use_case: string;
}

export interface STTModelsResponse {
  models: WhisperModel[];
  recommendation: string;
}

export interface STTTranscriptionRequest {
  audio: File;
  executor?: string;
  language?: string | null;
  task?: 'transcribe' | 'translate';
  temperature?: number;
  word_timestamps?: boolean;
  initial_prompt?: string | null;
  vad_filter?: boolean;
  beam_size?: number;
}

export interface STTSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: Array<{
    start: number;
    end: number;
    word: string;
    probability?: number;
  }>;
}

export interface STTTranscriptionResponse {
  text: string;
  language: string | null;
  segments: STTSegment[];
  metadata: Record<string, unknown>;
}

export async function getSTTExecutors(): Promise<STTExecutorsResponse> {
  const { data } = await api.get<STTExecutorsResponse>('/stt/executors');
  return data;
}

export async function getSTTModels(): Promise<STTModelsResponse> {
  const { data } = await api.get<STTModelsResponse>('/stt/models');
  return data;
}

export async function transcribeAudio(request: STTTranscriptionRequest): Promise<STTTranscriptionResponse> {
  const formData = new FormData();
  formData.append('audio', request.audio);
  
  if (request.executor) formData.append('executor', request.executor);
  if (request.language) formData.append('language', request.language);
  if (request.task) formData.append('task', request.task);
  if (request.temperature !== undefined) formData.append('temperature', request.temperature.toString());
  if (request.word_timestamps !== undefined) formData.append('word_timestamps', request.word_timestamps.toString());
  if (request.initial_prompt) formData.append('initial_prompt', request.initial_prompt);
  if (request.vad_filter !== undefined) formData.append('vad_filter', request.vad_filter.toString());
  if (request.beam_size !== undefined) formData.append('beam_size', request.beam_size.toString());
  
  const { data } = await api.post<STTTranscriptionResponse>('/stt/transcribe', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

export async function loadSTTModel(executorName: string, modelSize: string): Promise<{ status: string }> {
  const { data } = await api.post(`/stt/load-model/${executorName}`, null, {
    params: { model_size: modelSize },
  });
  return data;
}
