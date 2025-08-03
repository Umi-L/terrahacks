import { useState, useRef, useCallback, useEffect } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { useTranslation } from 'react-i18next'
import { useHealthModels } from './useHealthModels'

export interface ChatMessage {
    id: string
    content: string
    isUser: boolean
    timestamp: Date
    type?: 'text' | 'analysis' | 'recommendations' | 'appointment'
}

export const useGeminiChat = () => {

    const { t, i18n } = useTranslation()
    const { callPhysicalModel, callMentalModel, physicalModelSymptoms, mentalModelSymptoms } = useHealthModels()

    // Get user's preferred language
    const userLanguage = i18n.language || 'en'
    const languageNames: Record<string, string> = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese',
        'ar': 'Arabic',
        'hi': 'Hindi',
        'ta': 'Tamil',
    }

    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            content: t("home.chatWelcome"),
            isUser: false,
            timestamp: new Date(),
            type: 'text'
        }
    ])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const genAI = useRef<GoogleGenerativeAI | null>(null)

    // Update welcome message when language changes
    useEffect(() => {
        setMessages(prev => {
            const updatedMessages = [...prev]
            // Find and update the welcome message (usually the first message with id '1')
            const welcomeMessageIndex = updatedMessages.findIndex(msg => msg.id === '1' && !msg.isUser)
            if (welcomeMessageIndex !== -1) {
                updatedMessages[welcomeMessageIndex] = {
                    ...updatedMessages[welcomeMessageIndex],
                    content: t("home.chatWelcome")
                }
            }
            return updatedMessages
        })
    }, [i18n.language, t])

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

    // Function to analyze symptoms in user message and call appropriate ML model
    const analyzeSymptoms = async (userMessage: string) => {
        // Don't analyze if message is too short or doesn't seem health-related
        if (!userMessage || userMessage.trim().length < 5) {
            return ''
        }

        const messageLower = userMessage.toLowerCase()

        // Skip analysis for common non-symptom phrases
        const skipPhrases = [
            'how are you',
            'hello',
            'hi',
            'thanks',
            'thank you',
            'goodbye',
            'bye',
            'what is',
            'how do',
            'can you help',
            'how does this work'
        ]

        const shouldSkip = skipPhrases.some(phrase => messageLower.includes(phrase))
        if (shouldSkip) {
            return ''
        }

        try {
            if (!genAI.current && !initializeGemini()) {
                return ''
            }

            const model = genAI.current!.getGenerativeModel({ model: "gemini-2.5-flash-lite" })

            // Create symptom extraction prompt
            const extractionPrompt = `You are a medical symptom extraction assistant. Analyze the following user message and extract any symptoms that match the provided symptom lists.
The user's preferred language is ${languageNames[userLanguage] || 'English'}.
Ensure your responses are done in the user's preferred language.

User message: "${userMessage}"

Available Physical Symptoms:
${physicalModelSymptoms.join(', ')}

Available Mental Health Symptoms:
${mentalModelSymptoms.join(', ')}

Instructions:
1. Carefully read the user message
2. Identify any symptoms mentioned that EXACTLY match the symptoms in the lists above
3. Return ONLY the exact symptom names from the lists (no variations or interpretations)
4. Separate physical and mental symptoms
5. If no symptoms are found, return empty arrays

Return your response in this EXACT JSON format:
{
  "physicalSymptoms": ["symptom1", "symptom2"],
  "mentalSymptoms": ["symptom1", "symptom2"]
}

Only include symptoms that are explicitly mentioned or clearly implied in the user's message and that EXACTLY match the symptom names in the provided lists.`

            const extractionResult = await model.generateContent(extractionPrompt)
            const extractionResponse = await extractionResult.response
            const extractionText = extractionResponse.text()

            console.log('🔍 Symptom extraction response:', extractionText)

            // Parse the JSON response
            const cleanedText = extractionText.replace(/```json\n?|\n?```/g, '').trim()
            const extractedSymptoms = JSON.parse(cleanedText)

            const detectedPhysicalSymptoms = extractedSymptoms.physicalSymptoms || []
            const detectedMentalSymptoms = extractedSymptoms.mentalSymptoms || []

            console.log('🔬 Extracted physical symptoms:', detectedPhysicalSymptoms)
            console.log('🧠 Extracted mental symptoms:', detectedMentalSymptoms)

            let mlResults = ''

            // Only call models if we have detected symptoms and they meet minimum criteria
            const minSymptomsForAnalysis = 3 // Minimum number of symptoms to trigger analysis

            // Call physical model if physical symptoms detected
            if (detectedPhysicalSymptoms.length >= minSymptomsForAnalysis) {
                console.log('🔬 Calling physical model with symptoms:', detectedPhysicalSymptoms)

                try {
                    const physicalResult = await callPhysicalModel(detectedPhysicalSymptoms)
                    if (physicalResult.success && physicalResult.data) {
                        mlResults += `\n\n**🔬 AI Physical Health Analysis** (based on symptoms: ${detectedPhysicalSymptoms.join(', ')}):\n${physicalResult.data}\n\n*⚠️ This is an AI analysis tool, NOT a medical diagnosis. Please consult with your healthcare provider for proper evaluation and treatment.*`
                        console.log('✅ Physical model analysis completed')
                    } else {
                        console.log('❌ Physical model failed or returned no data')
                    }
                } catch (error) {
                    console.error('❌ Error calling physical model:', error)
                }
            }

            // Call mental model if mental symptoms detected
            if (detectedMentalSymptoms.length >= minSymptomsForAnalysis) {
                console.log('🧠 Calling mental model with symptoms:', detectedMentalSymptoms)

                try {
                    const mentalResult = await callMentalModel(detectedMentalSymptoms)
                    if (mentalResult.success && mentalResult.data) {
                        mlResults += `\n\n**🧠 AI Mental Health Analysis** (based on symptoms: ${detectedMentalSymptoms.join(', ')}):\n${mentalResult.data}\n\n*⚠️ This is an AI analysis tool, NOT a medical diagnosis. Please consult with a mental health professional for proper evaluation and treatment.*`
                        console.log('✅ Mental model analysis completed')
                    } else {
                        console.log('❌ Mental model failed or returned no data')
                    }
                } catch (error) {
                    console.error('❌ Error calling mental model:', error)
                }
            }

            return mlResults

        } catch (error) {
            console.error('❌ Error in symptom extraction:', error)
            return ''
        }
    }

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

            const model = genAI.current!.getGenerativeModel({ model: "gemini-2.5-flash-lite" })

            // Analyze symptoms using ML models
            const mlAnalysis = await analyzeSymptoms(userMessage)

            // Get current date context
            const currentDate = new Date()
            const currentDateStr = currentDate.toISOString().split('T')[0]
            const currentTimeStr = currentDate.toTimeString().slice(0, 5)

            console.log("users preferred language:", userLanguage, languageNames[userLanguage])

            // Create context-aware prompt
            let prompt = `You are a helpful health assistant focused on symptom tracking and health management.

The user's preferred language is ${languageNames[userLanguage] || 'English'}.
Ensure your responses are done in the user's preferred language.

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
- Provide questions users can ask their healthcare provider for further discussion
- If the user asks about health data, provide general advice on how to interpret trends

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

For single events:
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

For multiple events (when user mentions multiple symptoms/events):
EVENT_SUGGESTION:
[
  {
    "title": "First event title",
    "type": "pain|symptom|medication-reminder|medical-appointment|exercise|other",
    "description": "Brief description",
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "duration": 30,
    "eventData": { /* relevant data */ }
  },
  {
    "title": "Second event title",
    "type": "pain|symptom|medication-reminder|medical-appointment|exercise|other",
    "description": "Brief description", 
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "duration": 30,
    "eventData": { /* relevant data */ }
  }
]

Examples of when to suggest events:
- "I have a headache right now" → Check if headache already logged today, if not, suggest pain event for current time
- "I had a migraine yesterday at 3pm" → Check if migraine already logged for yesterday, if not, suggest pain event for yesterday 3pm
- "I took my medication this morning" → Check if medication already logged today, if not, suggest medication event for this morning
- "I have a doctor appointment tomorrow at 2pm" → Check if appointment already scheduled for tomorrow 2pm, if not, suggest appointment
- "I'm feeling nauseous" → Check if nausea already logged today, if not, suggest symptom event for current time
- "My back hurt during my workout this morning" → Check if back pain already logged for this morning, if not, suggest pain event

Examples of when to suggest MULTIPLE events:
- "I had a headache and felt nauseous this morning" → Suggest array with both headache (pain) and nausea (symptom) events for this morning
- "Yesterday I took my morning medication and had a doctor appointment at 3pm" → Suggest array with medication event for morning and appointment for 3pm
- "I've been having back pain and anxiety all week" → Suggest array with pain and symptom events for recent days
- "This morning I exercised, then had a migraine, and took my medication" → Suggest array with exercise, pain, and medication events

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

            // Add ML analysis results if available
            if (mlAnalysis) {
                prompt += `\nMachine Learning Analysis Results:\n${mlAnalysis}\nDisregard this input if the symptoms are too vague or the disease seems too severe for the given symptoms.\n\nPlease consider this AI analysis as additional context for your response, but always emphasize that this is NOT a medical diagnosis and the user should consult with healthcare professionals.`
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

            // Combine Gemini response with ML analysis if available
            let finalContent = responseText
            if (mlAnalysis) {
                finalContent += mlAnalysis
            }

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                content: finalContent,
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
    }, [initializeGemini, callPhysicalModel, callMentalModel, physicalModelSymptoms, mentalModelSymptoms])

    // Clear chat history
    const clearChat = useCallback(() => {
        setMessages([
            {
                id: '1',
                content: t("home.chatWelcome"),
                isUser: false,
                timestamp: new Date(),
                type: 'text'
            }
        ])
        setError(null)
    }, [t])

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
