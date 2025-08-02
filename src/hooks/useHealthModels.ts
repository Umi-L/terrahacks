import { useState } from 'react'
import { pb } from '@/lib/auth-utils'

interface ModelResponse {
    success: boolean
    data?: any
    error?: string
}

export const useHealthModels = () => {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const callPhysicalModel = async (symptoms: string[]): Promise<ModelResponse> => {
        try {
            setIsLoading(true)
            setError(null)

            console.log('Calling physical model with symptoms:', symptoms)

            const response = await pb.send('/physical-model/', {
                method: 'POST',
                body: JSON.stringify({ symptoms: symptoms })
            })

            console.log('Physical model response:', response)

            const decodedData = atob(response.result);
            return {
                success: true,
                data: decodedData
            }
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to call physical model'
            console.error('Physical model error:', err)
            setError(errorMessage)

            return {
                success: false,
                error: errorMessage
            }
        } finally {
            setIsLoading(false)
        }
    }

    const callMentalModel = async (symptoms: string[]): Promise<ModelResponse> => {
        try {
            setIsLoading(true)
            setError(null)

            console.log('Calling mental model with symptoms:', symptoms)

            const response = await pb.send('/mental-model/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ symptoms: symptoms })
            })

            console.log('Mental model response:', response)
            const decodedData = atob(response.result);
            return {
                success: true,
                data: decodedData
            }
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to call mental model'
            console.error('Mental model error:', err)
            setError(errorMessage)

            return {
                success: false,
                error: errorMessage
            }
        } finally {
            setIsLoading(false)
        }
    }

    return {
        callPhysicalModel,
        callMentalModel,
        isLoading,
        error
    }
}
