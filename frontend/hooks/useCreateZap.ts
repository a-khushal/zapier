import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { CreateZapRequest, CreateZapResponse } from '@/types/zap';

export function useCreateZap() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const createZap = async (zapData: CreateZapRequest) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await axios.post<CreateZapResponse>(
        'http://localhost:8080/api/v1/zap',
        zapData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token
          }
        }
      );

      router.push('/dashboard');
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create Zap';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return { createZap, isLoading, error };
}
