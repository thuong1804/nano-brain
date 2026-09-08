import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function getEmbedding(text: string): Promise<number[]> {
  if (process.env.GEMINI_API_KEY) {
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text,
    });

    if (response.embeddings && response.embeddings.length > 0 && response.embeddings[0].values) {
      return response.embeddings[0].values;
    }
  }

  // Fallback giả lập vector 768 chiều nếu chưa có key
  const fallbackDim = 768;
  const vector = new Array(fallbackDim).fill(0);
  for (let i = 0; i < text.length; i++) {
    vector[i % fallbackDim] += text.charCodeAt(i) / 1000;
  }
  return vector;
}