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

            return {
                success: true,
                data: response
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
                body: JSON.stringify({ symptoms })
            })

            console.log('Mental model response:', response)

            return {
                success: true,
                data: response
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

    const callBothModels = async (symptoms: string[]) => {
        try {
            setIsLoading(true)
            setError(null)

            console.log('Calling both models with symptoms:', symptoms)

            const [physicalResult, mentalResult] = await Promise.allSettled([
                callPhysicalModel(symptoms),
                callMentalModel(symptoms)
            ])

            const results = {
                physical: physicalResult.status === 'fulfilled' ? physicalResult.value : { success: false, error: 'Physical model failed' },
                mental: mentalResult.status === 'fulfilled' ? mentalResult.value : { success: false, error: 'Mental model failed' }
            }

            console.log('Both models results:', results)

            return results
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to call health models'
            console.error('Health models error:', err)
            setError(errorMessage)

            return {
                physical: { success: false, error: errorMessage },
                mental: { success: false, error: errorMessage }
            }
        } finally {
            setIsLoading(false)
        }
    }

    const prepareSymptomData = (events: any[]): string[] => {
        return events
            .filter(event => event.type === 'symptom' || event.type === 'pain')
            .map(event => event.title)
    }

    return {
        callPhysicalModel,
        callMentalModel,
        callBothModels,
        prepareSymptomData,
        isLoading,
        error
    }
}
