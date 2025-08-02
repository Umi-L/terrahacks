import { useState, useRef, useCallback } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'

export interface ChatMessage {
    id: string
    content: string
    isUser: boolean
    timestamp: Date
    type?: 'text' | 'analysis' | 'recommendations' | 'appointment'
}

export const useGeminiChat = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            content: "Hi! I'm your health assistant. I can help you analyze your symptoms, track patterns, and provide health recommendations. How can I assist you today?",
            isUser: false,
            timestamp: new Date(),
            type: 'text'
        }
    ])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const genAI = useRef<GoogleGenerativeAI | null>(null)

    // Initialize Gemini API
    const initializeGemini = useCallback(() => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY
        if (!apiKey || apiKey === 'your_gemini_api_key_here') {
            console.warn('Gemini API key not found. Please add VITE_GEMINI_API_KEY to your .env file')
            return false
        }
        genAI.current = new GoogleGenerativeAI(apiKey)
        return true
    }, [])

    // Send message to Gemini
    const sendMessage = useCallback(async (userMessage: string, healthData?: any, onEventSuggestion?: (eventData: any) => void) => {
        // Handle automatic analysis results
        if (!userMessage.trim() && healthData?.analysisResult) {
            const analysisMsg: ChatMessage = {
                id: Date.now().toString(),
                content: healthData.analysisResult,
                isUser: false,
                timestamp: new Date(),
                type: 'analysis'
            }
            setMessages(prev => [...prev, analysisMsg])
            return
        }

        if (!userMessage.trim()) return

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            content: userMessage,
            isUser: true,
            timestamp: new Date(),
            type: 'text'
        }

        setMessages(prev => [...prev, userMsg])
        setIsLoading(true)
        setError(null)

        try {
            if (!genAI.current && !initializeGemini()) {
                throw new Error('Gemini API key not configured. Please add your API key to the .env file. See GEMINI_SETUP.md for instructions.')
            }

            const model = genAI.current!.getGenerativeModel({ model: "gemini-2.0-flash" })

            // Get current date context
            const currentDate = new Date()
            const currentDateStr = currentDate.toISOString().split('T')[0]
            const currentTimeStr = currentDate.toTimeString().slice(0, 5)

            // Create context-aware prompt
            let prompt = `You are a helpful health assistant focused on symptom tracking and health management.

Current context:
- Today's date: ${currentDateStr}
- Current time: ${currentTimeStr}
- User timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}

User message: "${userMessage}"

Guidelines:
- Provide helpful, supportive responses about health and symptom tracking
- If discussing symptoms, suggest tracking patterns and potential triggers
- Recommend consulting healthcare providers for serious concerns
- Keep responses concise but informative
- Use a caring, professional tone
- Do not provide specific medical diagnoses

IMPORTANT EVENT SUGGESTION LOGIC:
Before suggesting an event, carefully check if a similar symptom/event is already logged for the mentioned time period. Look at the user's existing events to determine if the symptom is already tracked.

ONLY suggest adding an event if:
1. The user mentions a current symptom/pain/medication that is NOT already logged for today
2. The user mentions a specific past symptom that is NOT already logged for that specific date/time
3. The user mentions a future appointment/reminder that is NOT already scheduled

DO NOT suggest events if:
- A similar symptom is already logged for the same day/time period
- The user is just discussing general health topics
- The user is asking questions about existing symptoms

To suggest an event, include this JSON structure at the end of your response:

EVENT_SUGGESTION:
{
  "title": "Brief title for the event",
  "type": "pain|symptom|medication-reminder|medical-appointment|exercise|other",
  "description": "Brief description",
  "date": "YYYY-MM-DD (default to today if not specified)",
  "time": "HH:MM (default to current time if not specified)",
  "duration": 30,
  "eventData": {
    "severity": 5,
    "painLevel": "mild|moderate|severe",
    "location": "specific body part",
    "medication": "medication name",
    "dosage": "amount",
    "frequency": "how often",
    "doctorName": "doctor name",
    "appointmentType": "type of appointment",
    "notes": "additional relevant information"
  }
}

Examples of when to suggest events:
- "I have a headache right now" → Check if headache already logged today, if not, suggest pain event for current time
- "I had a migraine yesterday at 3pm" → Check if migraine already logged for yesterday, if not, suggest pain event for yesterday 3pm
- "I took my medication this morning" → Check if medication already logged today, if not, suggest medication event for this morning
- "I have a doctor appointment tomorrow at 2pm" → Check if appointment already scheduled for tomorrow 2pm, if not, suggest appointment
- "I'm feeling nauseous" → Check if nausea already logged today, if not, suggest symptom event for current time
- "My back hurt during my workout this morning" → Check if back pain already logged for this morning, if not, suggest pain event

Examples of when NOT to suggest events:
- "Why do I keep getting headaches?" → General question, don't suggest
- User already has a headache logged today → Don't suggest duplicate
- "How should I treat my back pain?" → General advice question
- "I usually take my medication in the morning" → General routine discussion, not specific instance
- "My headaches are getting worse" → Discussion about pattern, not specific instance

CRITICAL: When user mentions a time period (yesterday, this morning, last week, etc.), extract the specific date/time and check for existing events in that exact time period before suggesting.

`

            // Add health data context if available
            if (healthData) {
                prompt += `\nUser's health data context:\n`

                if (healthData.nearbyEvents && healthData.nearbyEvents.length > 0) {
                    prompt += `\nEvents around current time period (3 days before/after today):\n${JSON.stringify(healthData.nearbyEvents, null, 2)}\n`
                }

                if (healthData.recentEvents && healthData.recentEvents.length > 0) {
                    prompt += `\nRecent events (last 2 weeks):\n${JSON.stringify(healthData.recentEvents, null, 2)}\n`
                }

                if (healthData.currentDate && healthData.currentTime) {
                    prompt += `\nCurrent date/time: ${healthData.currentDate} ${healthData.currentTime}\n`
                }

                prompt += `\nBefore suggesting any event, carefully review the existing events above to avoid duplicates. Pay special attention to events on the same date or time period mentioned by the user.`
            }

            const result = await model.generateContent(prompt)
            const response = await result.response
            const text = response.text()

            // Check for event suggestions in the response
            let responseText = text
            let eventSuggestion = null

            if (text.includes('EVENT_SUGGESTION:')) {
                const parts = text.split('EVENT_SUGGESTION:')
                responseText = parts[0].trim()

                try {
                    const suggestionJson = parts[1].trim()
                    eventSuggestion = JSON.parse(suggestionJson)
                } catch (err) {
                    console.error('Failed to parse event suggestion:', err)
                }
            }

            // Determine response type based on content
            let responseType: ChatMessage['type'] = 'text'
            if (responseText.toLowerCase().includes('pattern') || responseText.toLowerCase().includes('analysis')) {
                responseType = 'analysis'
            } else if (responseText.toLowerCase().includes('recommend') || responseText.toLowerCase().includes('suggest')) {
                responseType = 'recommendations'
            } else if (responseText.toLowerCase().includes('appointment') || responseText.toLowerCase().includes('doctor')) {
                responseType = 'appointment'
            }

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                content: responseText,
                isUser: false,
                timestamp: new Date(),
                type: responseType
            }

            setMessages(prev => [...prev, aiMsg])

            // If there's an event suggestion and callback provided, call it
            if (eventSuggestion && onEventSuggestion) {
                onEventSuggestion(eventSuggestion)
            }
        } catch (err) {
            console.error('Error sending message to Gemini:', err)
            setError('Sorry, I encountered an error. Please try again.')

            // Add error message
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
                isUser: false,
                timestamp: new Date(),
                type: 'text'
            }
            setMessages(prev => [...prev, errorMsg])
        } finally {
            setIsLoading(false)
        }
    }, [initializeGemini])

    // Clear chat history
    const clearChat = useCallback(() => {
        setMessages([
            {
                id: '1',
                content: "Hi! I'm your health assistant. I can help you analyze your symptoms, track patterns, and provide health recommendations. How can I assist you today?",
                isUser: false,
                timestamp: new Date(),
                type: 'text'
            }
        ])
        setError(null)
    }, [])

    // Clear only analysis messages
    const clearAnalysisMessages = useCallback(() => {
        setMessages(prev => prev.filter(msg => msg.type !== 'analysis'))
    }, [])

    return {
        messages,
        isLoading,
        error,
        sendMessage,
        clearChat,
        clearAnalysisMessages
    }
}
