import axios, { AxiosError } from 'axios';
import { config } from '../config';
import logger from '../utils/logger';

export interface AIRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class AIProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor() {
    this.baseUrl = config.aiProvider.upstreamUrl;
    this.apiKey = config.aiProvider.apiKey;
    this.defaultModel = config.aiProvider.defaultModel;
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const model = request.model || this.defaultModel;
    
    logger.debug({ model, promptLength: request.prompt.length }, 'Calling AI provider');

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model,
          messages: [
            { role: 'user', content: request.prompt }
          ],
          max_tokens: request.maxTokens || config.aiProvider.maxTokens,
          temperature: request.temperature ?? 0.7,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000, // 2 minutes
        }
      );

      const data = response.data;
      
      logger.debug({ 
        model: data.model,
        usage: data.usage 
      }, 'AI response received');

      return {
        content: data.choices[0]?.message?.content || '',
        model: data.model,
        usage: data.usage,
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        
        logger.error({ 
          status, 
          error: errorData,
          model 
        }, 'AI provider error');

        if (status !== undefined) {
          if (status === 429) {
            throw new Error('RATE_LIMIT_EXCEEDED');
          }
          if (status === 401 || status === 403) {
            throw new Error('AUTH_FAILED');
          }
          if (status >= 500) {
            throw new Error('PROVIDER_ERROR');
          }
        }
      }
      
      throw error;
    }
  }

  // Decode bytes data from BAP-578 event
  static decodePrompt(data: string): string {
    try {
      // Try to decode as UTF-8 string
      const bytes = ethers.getBytes(data);
      return new TextDecoder().decode(bytes);
    } catch {
      // If decoding fails, return raw hex
      return data;
    }
  }
}

// Import for Static method
import { ethers } from 'ethers';