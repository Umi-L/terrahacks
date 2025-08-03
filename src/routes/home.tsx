import { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Navbar from '@/components/Navbar'
import { motion } from 'framer-motion'
import { Calendar, Views, momentLocalizer } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import moment from 'moment'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import '../styles/calendar.css'
import { usePocketBaseStore } from '@/stores/pocketbase-store'
import { useGeminiChat } from '@/hooks/useGeminiChat'
import { useHealthModels } from '@/hooks/useHealthModels'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { useTranslation } from 'react-i18next'
import {
    fetchUserCalendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    subscribeToCalendarEvents,
    type CalendarEvent
} from '@/lib/calendar-data'

/*
SQL Database Schema for symptom_events table:

CREATE TABLE symptom_events (
    id BIGINT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    start_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_symptom_events_date ON symptom_events(start_datetime);
CREATE INDEX idx_symptom_events_type ON symptom_events(event_type);
*/

export const Route = createFileRoute('/home')({
    component: Home,
})

const localizer = momentLocalizer(moment)
const DragAndDropCalendar = withDragAndDrop(Calendar)

// Simple Markdown renderer component
const MarkdownRenderer = ({ content }: { content: string }) => {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkBreaks]}
            components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
                blockquote: ({ children }) => <blockquote className="border-l-4 border-muted pl-4 italic">{children}</blockquote>,
                h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
            }}
        >
            {content}
        </ReactMarkdown>
    )
}

// Define the event types and their colors
type EventType = 'pain' | 'symptom' | 'event' | 'medical-appointment' | 'medication-reminder'
type PainLevel = 'mild' | 'moderate' | 'severe'

interface SymptomEvent {
    id: number
    title: string
    start: Date
    end: Date
    type: EventType
    description?: string
    eventData?: {
        painLevel?: PainLevel
        location?: string
        severity?: number
        medication?: string
        dosage?: string
        frequency?: string
        doctorName?: string
        appointmentType?: string
        notes?: string
        [key: string]: any
    }
}

function Home() {
    const { t } = useTranslation()
    const { user, isAuthenticated } = usePocketBaseStore()

    // Define event type colors with translated labels
    const eventTypeColors = useMemo(() => ({
        'pain': { bg: '#ef4444', border: '#dc2626', label: t('eventTypes.pain') },
        'symptom': { bg: '#8b5cf6', border: '#7c3aed', label: t('eventTypes.symptom') },
        'event': { bg: '#06b6d4', border: '#0891b2', label: t('eventTypes.event') },
        'medical-appointment': { bg: '#ec4899', border: '#db2777', label: t('eventTypes.medical-appointment') },
        'medication-reminder': { bg: '#517d0c', border: '#446e09ff', label: t('eventTypes.medication-reminder') }
    }), [t])

    const painLevelColors = useMemo(() => ({
        'mild': { bg: '#10b981', border: '#059669', label: t('pain.mild') },
        'moderate': { bg: '#f59e0b', border: '#d97706', label: t('pain.moderate') },
        'severe': { bg: '#ef4444', border: '#dc2626', label: t('pain.severe') }
    }), [t])

    const [myEvents, setMyEvents] = useState<CalendarEvent[]>([])
    const [showQuickAdd, setShowQuickAdd] = useState(false)
    const [showSQLLogs, setShowSQLLogs] = useState(false)
    const [showEventDetails, setShowEventDetails] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Chat functionality
    const { messages, isLoading: isChatLoading, sendMessage, clearChat, clearAnalysisMessages } = useGeminiChat()
    const [currentMessage, setCurrentMessage] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Health models functionality
    const { callPhysicalModel, callMentalModel } = useHealthModels()

    // Abnormal symptom analysis state
    const [abnormalDateRanges, setAbnormalDateRanges] = useState<Array<{ start: Date, end: Date }>>([])
    const [hasAnalyzed, setHasAnalyzed] = useState(false)

    const [contextMenu, setContextMenu] = useState<{
        visible: boolean
        x: number
        y: number
        event: CalendarEvent | null
    }>({
        visible: false,
        x: 0,
        y: 0,
        event: null
    })
    const [quickAddForm, setQuickAddForm] = useState({
        title: '',
        type: 'symptom' as EventType,
        description: '',
        date: new Date().toISOString().split('T')[0],
        time: '12:00',
        endDate: '',
        endTime: '',
        // Pain-specific fields
        painLevel: 'mild' as PainLevel,
        location: '',
        severity: 5,
        // Medication-specific fields
        medication: '',
        dosage: '',
        frequency: '',
        // Recurring medication fields
        isRecurring: false,
        recurringPattern: 'daily' as 'daily' | 'weekly' | 'custom',
        recurringDays: [] as string[], // For weekly pattern: ['monday', 'tuesday', etc.]
        recurringInterval: 1, // Every N days/weeks
        recurringEndDate: '',
        recurringTimes: [''] as string[], // Multiple times per day
        // Medical appointment-specific fields
        doctorName: '',
        appointmentType: '',
        // General notes
        notes: ''
    })

    // State for editing existing events
    const [editForm, setEditForm] = useState({
        title: '',
        type: 'symptom' as EventType,
        description: '',
        date: '',
        time: '',
        endDate: '',
        endTime: '',
        // Pain-specific fields
        painLevel: 'mild' as PainLevel,
        location: '',
        severity: 5,
        // Medication-specific fields
        medication: '',
        dosage: '',
        frequency: '',
        // Recurring medication fields
        isRecurring: false,
        recurringPattern: 'daily' as 'daily' | 'weekly' | 'custom',
        recurringDays: [] as string[],
        recurringInterval: 1,
        recurringEndDate: '',
        recurringTimes: [''] as string[],
        // Medical appointment-specific fields
        doctorName: '',
        appointmentType: '',
        // General notes
        notes: ''
    })

    // Load events from PocketBase on component mount
    useEffect(() => {
        let isMounted = true // Flag to prevent state updates after unmount
        let unsubscribeRealtime: (() => void) | null = null
        let timeoutId: NodeJS.Timeout

        const initializeCalendar = async () => {
            if (!isAuthenticated || !user) {
                if (isMounted) {
                    setMyEvents([])
                    setIsLoading(false)
                }
                return
            }

            try {
                if (isMounted) {
                    setIsLoading(true)
                    setError(null)
                }

                // Add a small delay to prevent React StrictMode double-mounting issues
                await new Promise(resolve => setTimeout(resolve, 100))

                // Only proceed if component is still mounted
                if (!isMounted) return

                const events = await fetchUserCalendarEvents()

                // Only update state if component is still mounted
                if (isMounted) {
                    setMyEvents(events)

                    // Analyze symptom patterns after events are loaded
                    if (events.length > 0) {
                        analyzeSymptomPatterns(events)
                    }
                }

                // Setup realtime subscription with delay
                if (isMounted) {
                    timeoutId = setTimeout(async () => {
                        if (isMounted) {
                            const unsubscribe = await setupRealtimeSubscription()
                            unsubscribeRealtime = unsubscribe || null
                        }
                    }, 200)
                }
            } catch (err: any) {
                console.error('Failed to load calendar events:', err)
                if (isMounted && err.status !== 0) { // Don't show error for cancelled requests
                    setError(t('home.errorLoading'))
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false)
                }
            }
        }

        initializeCalendar()

        // Cleanup function
        return () => {
            isMounted = false
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
            if (unsubscribeRealtime) {
                unsubscribeRealtime()
            }
        }
    }, [isAuthenticated, user])

    // Handle keyboard events for context menu
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && contextMenu.visible) {
                handleCloseContextMenu()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [contextMenu.visible])

    // Re-analyze symptoms when events change and user is authenticated
    useEffect(() => {
        console.log('useEffect for analysis triggered:', {
            isAuthenticated,
            eventsLength: myEvents.length,
            hasAnalyzed,
            canAnalyze: isAuthenticated && myEvents.length > 0 && !hasAnalyzed
        })

        if (isAuthenticated && myEvents.length > 0 && !hasAnalyzed) {
            console.log('Setting timeout for analysis...')
            // Add a small delay to avoid rapid re-analysis
            const timeoutId = setTimeout(() => {
                console.log('Timeout fired, calling analyzeSymptomPatterns')
                analyzeSymptomPatterns(myEvents)
            }, 1000)

            return () => {
                console.log('Clearing analysis timeout')
                clearTimeout(timeoutId)
            }
        }
    }, [myEvents, isAuthenticated, hasAnalyzed])

    const setupRealtimeSubscription = async (): Promise<(() => void) | null> => {
        try {
            const unsubscribe = await subscribeToCalendarEvents((action, eventOrId) => {
                if (action === 'create' || action === 'update') {
                    const event = eventOrId as CalendarEvent
                    setMyEvents(prev => {
                        const filtered = prev.filter(e => e.id !== event.id)
                        return [...filtered, event]
                    })
                } else if (action === 'delete') {
                    const eventId = eventOrId as string
                    setMyEvents(prev => prev.filter(e => e.id !== eventId))
                }
            })

            return unsubscribe
        } catch (err) {
            console.error('Failed to setup realtime subscription:', err)
            return null
        }
    }

    const moveEvent = useCallback(
        async ({ event, start, end }: any) => {
            try {
                // Optimistic update - update UI immediately
                const updatedEvents = ((prev) => {
                    const filtered = prev.filter((ev) => ev.id !== event.id)
                    return [...filtered, { ...event, start, end }]
                })(myEvents)

                setMyEvents(updatedEvents)

                // Update the backend
                const updatedEvent = await updateCalendarEvent(event.id, { start, end })

                // Don't update state again - the optimistic update handles UI
                // Real-time subscription will sync any server-side changes

                // Keep SQL logging for compatibility
                logEventForSQL('UPDATE', {
                    id: parseInt(event.id, 10),
                    title: updatedEvent.title,
                    start: updatedEvent.start,
                    end: updatedEvent.end,
                    type: updatedEvent.type as EventType,
                    description: updatedEvent.description
                })

                // Reset analysis state to trigger re-analysis
                setHasAnalyzed(false)
                setAbnormalDateRanges([])
            } catch (err) {
                console.error('Failed to move event:', err)
                setError(t('home.errorUpdating'))

                // Revert optimistic update on error by refetching
                try {
                    const events = await fetchUserCalendarEvents()
                    setMyEvents(events)
                } catch (fetchErr) {
                    console.error('Failed to refresh events after error:', fetchErr)
                }
            }
        },
        [myEvents]
    )

    const resizeEvent = useCallback(
        async ({ event, start, end }: any) => {
            try {
                const updatedEvent = await updateCalendarEvent(event.id, { start, end })
                const updatedEvents = ((prev) => {
                    const filtered = prev.filter((ev) => ev.id !== event.id)
                    return [...filtered, updatedEvent]
                })(myEvents)

                setMyEvents(updatedEvents)

                // Keep SQL logging for compatibility
                logEventForSQL('UPDATE', {
                    id: parseInt(event.id, 10),
                    title: updatedEvent.title,
                    start: updatedEvent.start,
                    end: updatedEvent.end,
                    type: updatedEvent.type as EventType,
                    description: updatedEvent.description
                })

                // Reset analysis state to trigger re-analysis
                setHasAnalyzed(false)
                setAbnormalDateRanges([])
            } catch (err) {
                console.error('Failed to resize event:', err)
                setError(t('home.errorUpdating'))
            }
        },
        [myEvents]
    )

    const defaultDate = useMemo(() => new Date(2025, 7, 2), [])

    // Handle right-click on events to show context menu
    const handleEventRightClick = (event: any, e: React.MouseEvent) => {
        e.preventDefault()
        const calendarEvent = event as CalendarEvent
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            event: calendarEvent
        })
    }

    // Close context menu when clicking elsewhere
    const handleCloseContextMenu = () => {
        setContextMenu({
            visible: false,
            x: 0,
            y: 0,
            event: null
        })
    }

    // Handle context menu actions
    const handleContextMenuEdit = () => {
        if (contextMenu.event) {
            handleEventClick(contextMenu.event)
        }
        handleCloseContextMenu()
    }

    const handleContextMenuDelete = async () => {
        if (contextMenu.event && confirm(t('home.confirmDeleteEvent'))) {
            await deleteEvent(contextMenu.event.id)
        }
        handleCloseContextMenu()
    }

    // Auto-scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Handle AI event suggestions (single event or multiple events)
    const handleAIEventSuggestion = async (eventData: any) => {
        try {
            // Check if eventData is an array of events or a single event
            const eventsToAdd = Array.isArray(eventData) ? eventData : [eventData]
            console.log('AI suggested events:', eventsToAdd)

            const addedEvents: string[] = []
            const warnings: string[] = []
            const errors: string[] = []

            // Process each event
            for (const singleEventData of eventsToAdd) {
                try {
                    // Parse date and time
                    const eventDate = singleEventData.date || new Date().toISOString().split('T')[0]
                    const eventTime = singleEventData.time || new Date().toTimeString().slice(0, 5)
                    const duration = singleEventData.duration || 30 // default 30 minutes

                    const [hours, minutes] = eventTime.split(':').map(Number)
                    const dateParts = eventDate.split('-').map(Number)
                    const startDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hours, minutes)
                    const endDate = new Date(startDate.getTime() + duration * 60000) // Add duration in minutes

                    // Check for existing similar events on the same date (additional safety check)
                    const sameDate = myEvents.filter(event => {
                        const eventDate = new Date(event.start)
                        return eventDate.toDateString() === startDate.toDateString() &&
                            event.type === singleEventData.type &&
                            event.title.toLowerCase().includes(singleEventData.title.toLowerCase().split(' ')[0])
                    })

                    if (sameDate.length > 0) {
                        warnings.push(`⚠️ Similar ${singleEventData.type} event ("${sameDate[0].title}") already exists for ${eventDate}`)
                        continue // Skip this event but continue with others
                    }

                    // Create the event
                    const newEvent = await createCalendarEvent({
                        title: singleEventData.title,
                        start: startDate,
                        end: endDate,
                        type: singleEventData.type || 'symptom',
                        description: singleEventData.description || '',
                        eventData: singleEventData.eventData || {}
                    })

                    // Log for SQL compatibility
                    logEventForSQL('INSERT', {
                        id: parseInt(newEvent.id, 10) || Date.now(),
                        title: newEvent.title,
                        start: newEvent.start,
                        end: newEvent.end,
                        type: newEvent.type as EventType,
                        description: newEvent.description,
                        eventData: newEvent.eventData
                    })

                    addedEvents.push(`"${singleEventData.title}" for ${eventDate} at ${eventTime}`)

                } catch (eventErr) {
                    console.error('Failed to create individual event:', eventErr)
                    errors.push(`Failed to add "${singleEventData.title}"`)
                }
            }

            // Reset analysis state to trigger re-analysis if any events were added
            if (addedEvents.length > 0) {
                setHasAnalyzed(false)
                setAbnormalDateRanges([])
            }

            // Create comprehensive status message
            let statusMessage = ''

            if (addedEvents.length > 0) {
                if (addedEvents.length === 1) {
                    statusMessage += `✅ I've added ${addedEvents[0]} to your calendar.`
                } else {
                    statusMessage += `✅ I've added ${addedEvents.length} events to your calendar:\n${addedEvents.map(event => `• ${event}`).join('\n')}`
                }
            }

            if (warnings.length > 0) {
                if (statusMessage) statusMessage += '\n\n'
                statusMessage += warnings.join('\n')
            }

            if (errors.length > 0) {
                if (statusMessage) statusMessage += '\n\n'
                statusMessage += `❌ ${errors.join(', ')}. You can add these manually using the + button.`
            }

            if (!statusMessage) {
                statusMessage = '❌ No events could be added. You can add them manually using the + button.'
            }

            sendMessage('', { analysisResult: statusMessage }, () => { }) // Empty callback to prevent recursive suggestions

        } catch (err) {
            console.error('Failed to process AI-suggested events:', err)
            const errorMsg = `❌ I wasn't able to process the suggested events. You can add them manually using the + button.`
            sendMessage('', { analysisResult: errorMsg }, () => { }) // Empty callback to prevent recursive suggestions
        }
    }

    // Chat handlers
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!currentMessage.trim() || isChatLoading) return

        // Create comprehensive health context for AI decision making
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const threeDaysAgo = new Date(today.getTime() - (3 * 24 * 60 * 60 * 1000))
        const threeDaysFromNow = new Date(today.getTime() + (3 * 24 * 60 * 60 * 1000))

        // Get recent events (last 2 weeks) for general context
        const recentEvents = myEvents
            .filter(event => event.start >= new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000)))
            .map(event => ({
                title: event.title,
                type: event.type,
                date: event.start.toISOString().split('T')[0],
                time: event.start.toTimeString().slice(0, 5),
                description: event.description,
                eventData: event.eventData
            }))

        // Get events around current time period (3 days before to 3 days after today)
        const nearbyEvents = myEvents
            .filter(event => event.start >= threeDaysAgo && event.start <= threeDaysFromNow)
            .map(event => ({
                title: event.title,
                type: event.type,
                date: event.start.toISOString().split('T')[0],
                time: event.start.toTimeString().slice(0, 5),
                description: event.description,
                severity: event.eventData?.severity,
                painLevel: event.eventData?.painLevel,
                location: event.eventData?.location,
                medication: event.eventData?.medication,
                notes: event.eventData?.notes
            }))

        const healthContext = {
            recentEvents,
            nearbyEvents,
            currentDate: now.toISOString().split('T')[0],
            currentTime: now.toTimeString().slice(0, 5)
        }

        await sendMessage(currentMessage, healthContext, handleAIEventSuggestion)
        setCurrentMessage('')
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage(e as any)
        }
    }

    // Handle clicking on an event to view/edit details
    const handleEventClick = (event: any) => {
        const calendarEvent = event as CalendarEvent
        setSelectedEvent(calendarEvent)
        setShowEventDetails(true)

        // Populate edit form with event data
        const startDate = new Date(calendarEvent.start)
        const endDate = new Date(calendarEvent.end)

        setEditForm({
            title: calendarEvent.title,
            type: calendarEvent.type as EventType,
            description: calendarEvent.description || '',
            date: startDate.toISOString().split('T')[0],
            time: startDate.toTimeString().slice(0, 5),
            endDate: endDate.toISOString().split('T')[0],
            endTime: endDate.toTimeString().slice(0, 5),
            painLevel: (calendarEvent.eventData?.painLevel as PainLevel) || 'mild',
            location: calendarEvent.eventData?.location || '',
            severity: calendarEvent.eventData?.severity || 5,
            medication: calendarEvent.eventData?.medication || '',
            dosage: calendarEvent.eventData?.dosage || '',
            frequency: calendarEvent.eventData?.frequency || '',
            // Recurring medication fields
            isRecurring: calendarEvent.eventData?.isRecurring || false,
            recurringPattern: (calendarEvent.eventData?.recurringPattern as 'daily' | 'weekly' | 'custom') || 'daily',
            recurringDays: calendarEvent.eventData?.recurringDays || [],
            recurringInterval: calendarEvent.eventData?.recurringInterval || 1,
            recurringEndDate: calendarEvent.eventData?.recurringEndDate || '',
            recurringTimes: calendarEvent.eventData?.recurringTimes || [''],
            doctorName: calendarEvent.eventData?.doctorName || '',
            appointmentType: calendarEvent.eventData?.appointmentType || '',
            notes: calendarEvent.eventData?.notes || ''
        })
    }

    // Update an existing event
    const updateEvent = async () => {
        if (!selectedEvent || isSubmitting) return

        try {
            setIsSubmitting(true)
            setError(null)

            const [hours, minutes] = editForm.time.split(':').map(Number)
            const [endHours, endMinutes] = editForm.endTime.split(':').map(Number)

            // Parse dates properly
            const dateParts = editForm.date.split('-').map(Number)
            const endDateParts = editForm.endDate.split('-').map(Number)

            const startDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hours, minutes)
            const endDate = new Date(endDateParts[0], endDateParts[1] - 1, endDateParts[2], endHours, endMinutes)

            // Prepare event-specific data
            const eventData: Record<string, any> = {}

            if (editForm.type === 'pain') {
                eventData.painLevel = editForm.painLevel
                if (editForm.location) eventData.location = editForm.location
                eventData.severity = editForm.severity
            } else if (editForm.type === 'medication-reminder') {
                if (editForm.medication) eventData.medication = editForm.medication
                if (editForm.dosage) eventData.dosage = editForm.dosage
                if (editForm.frequency) eventData.frequency = editForm.frequency
            } else if (editForm.type === 'medical-appointment') {
                if (editForm.doctorName) eventData.doctorName = editForm.doctorName
                if (editForm.appointmentType) eventData.appointmentType = editForm.appointmentType
            }

            // Add general notes if provided
            if (editForm.notes) eventData.notes = editForm.notes

            const updatedEvent = await updateCalendarEvent(selectedEvent.id, {
                title: editForm.title,
                start: startDate,
                end: endDate,
                type: editForm.type,
                description: editForm.description,
                eventData: Object.keys(eventData).length > 0 ? eventData : undefined
            })

            // Update local state optimistically
            setMyEvents(prev => {
                const filtered = prev.filter(ev => ev.id !== selectedEvent.id)
                return [...filtered, updatedEvent]
            })

            // Log for SQL compatibility
            logEventForSQL('UPDATE', {
                id: parseInt(selectedEvent.id, 10) || Date.now(),
                title: updatedEvent.title,
                start: updatedEvent.start,
                end: updatedEvent.end,
                type: updatedEvent.type as EventType,
                description: updatedEvent.description,
                eventData: updatedEvent.eventData
            })

            setShowEventDetails(false)
            setSelectedEvent(null)

            // Reset analysis state so it can re-analyze with updated events
            setHasAnalyzed(false)
            setAbnormalDateRanges([])
        } catch (err) {
            console.error('Failed to update event:', err)
            setError(t('home.errorUpdating'))
        } finally {
            setIsSubmitting(false)
        }
    }

    // Analyze symptoms for abnormal patterns using Gemini
    const analyzeSymptomPatterns = async (events: CalendarEvent[]) => {
        console.log('analyzeSymptomPatterns called with:', events.length, 'events, hasAnalyzed:', hasAnalyzed)

        if (!events.length || hasAnalyzed) {
            console.log('Skipping analysis - no events or already analyzed')
            return
        }

        console.log('Starting symptom analysis with', events.length, 'events')

        try {
            // Filter symptom and pain events for analysis
            const symptomEvents = events.filter(event =>
                event.type === 'pain' || event.type === 'symptom'
            ).map(event => ({
                startDate: event.start.toISOString().split('T')[0],
                endDate: event.end.toISOString().split('T')[0],
                startTime: event.start.toISOString().split('T')[1].split('.')[0],
                endTime: event.end.toISOString().split('T')[1].split('.')[0],
                type: event.type,
                title: event.title,
                severity: event.eventData?.severity || 'unknown',
                painLevel: event.eventData?.painLevel || 'unknown',
                location: event.eventData?.location || 'unknown',
                description: event.description || 'No description',
                notes: event.eventData?.notes || 'No notes'
            }))

            if (symptomEvents.length === 0) {
                setHasAnalyzed(true)
                return
            }

            // Sort events by date for better analysis
            symptomEvents.sort((a, b) => a.startDate.localeCompare(b.startDate))

            // Create analysis prompt for Gemini
            const analysisPrompt = `You are a medical symptom analysis assistant. Analyze the following chronological symptom/pain events for concerning patterns:

SYMPTOM DATA:
${JSON.stringify(symptomEvents, null, 2)}

ANALYSIS INSTRUCTIONS:
1. Look for concerning patterns such as:
   - Multiple symptoms occurring within a short timeframe (clusters)
   - High severity symptoms (7+ on 10-point scale)
   - Recurring symptoms in the same location
   - Progressive worsening of symptoms
   - Chest pain (always concerning regardless of severity)

2. For date ranges, consider:
   - If multiple symptoms occur on consecutive days, group them as a range
   - If a single severe symptom occurs, the range can be just that day
   - Include buffer days before/after clusters if appropriate for monitoring

3. Provide specific, actionable recommendations based on the severity and type of symptoms found.

REQUIRED OUTPUT FORMAT (JSON only, no markdown):
{
  "abnormalRanges": [
    {
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD", 
      "reason": "Specific description of the concerning pattern found in this period"
    }
  ],
  "recommendation": "Specific medical advice based on the symptoms (max 2 sentences)"
}

IMPORTANT: 
- Only flag genuinely concerning patterns
- If no concerning patterns exist, return empty abnormalRanges array
- Always include both startDate and endDate (can be same day for single-day events)
- Be specific about WHY each period is concerning
`
            // Import and initialize Gemini if needed
            const { GoogleGenerativeAI } = await import('@google/generative-ai')
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY

            console.log('Gemini API key configured:', apiKey ? 'Yes' : 'No')

            if (!apiKey || apiKey === 'your_gemini_api_key_here') {
                console.warn('Gemini API key not configured for symptom analysis')
                setHasAnalyzed(true)
                return
            }

            const genAI = new GoogleGenerativeAI(apiKey)
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" })

            const result = await model.generateContent(analysisPrompt)
            const response = await result.response
            const text = response.text()

            // Parse the JSON response - remove markdown code blocks if present
            const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim()
            console.log('Gemini analysis response:', cleanedText)

            const analysis = JSON.parse(cleanedText)
            console.log('Parsed analysis:', analysis)

            // Convert date strings to Date objects and update state
            const abnormalRanges = analysis.abnormalRanges?.map((range: any) => ({
                start: new Date(range.startDate + 'T00:00:00'),
                end: new Date(range.endDate + 'T00:00:00'),
                reason: range.reason
            })) || []

            console.log('Processed abnormal ranges:', abnormalRanges)
            setAbnormalDateRanges(abnormalRanges)

            // Debug: Log the abnormal ranges
            if (abnormalRanges.length > 0) {
                console.log('Abnormal date ranges:', abnormalRanges.map((range: any) => ({
                    start: range.start.toISOString().split('T')[0],
                    startTime: range.start.getTime(),
                    end: range.end.toISOString().split('T')[0],
                    endTime: range.end.getTime(),
                    reason: range.reason
                })))
            }

            // Add analysis message to chat if there are abnormal patterns or recommendations
            if (abnormalRanges.length > 0 || analysis.recommendation) {
                let analysisMessage = ''
                if (abnormalRanges.length > 0) {
                    analysisMessage = '⚠️ Symptom Analysis: I have identified ' + abnormalRanges.length + ' period(s) with concerning symptom patterns (highlighted in red on your calendar). ' + (analysis.recommendation || 'Consider consulting with your healthcare provider about these patterns.')
                } else {
                    analysisMessage = 'Symptom Analysis: No concerning patterns detected in your recent symptoms. ' + (analysis.recommendation || 'Keep up the good work tracking your health!')
                }

                console.log('Adding analysis message to chat:', analysisMessage)

                // Remove any existing analysis messages before adding the new one
                clearAnalysisMessages()

                // Add the analysis message to chat
                sendMessage('', { analysisResult: analysisMessage }, handleAIEventSuggestion)
            } else {
                console.log('No analysis message to add - no abnormal ranges or recommendations')
            }

            setHasAnalyzed(true)

        } catch (error) {
            console.error('Error analyzing symptom patterns:', error)
            setHasAnalyzed(true) // Mark as analyzed even if it failed to prevent retries
            // Silently fail - don't disrupt the user experience
        }
    }

    const deleteEvent = async (eventId: string) => {
        setIsSubmitting(true)
        try {
            await deleteCalendarEvent(eventId)

            // Update local state optimistically
            setMyEvents(prev => prev.filter(ev => ev.id !== eventId))

            // Log for SQL compatibility
            logEventForSQL('DELETE', {
                id: parseInt(eventId, 10) || Date.now(),
                title: '',
                start: new Date(),
                end: new Date(),
                type: 'symptom',
                description: '',
                eventData: undefined
            })

            // Reset analysis state so it can re-analyze with updated events
            setHasAnalyzed(false)
            setAbnormalDateRanges([])
        } catch (err) {
            console.error('Failed to delete event:', err)
            setError('Failed to delete event')
        } finally {
            setIsSubmitting(false)
        }
    }

    // Mark medication as taken
    const markMedicationTaken = async (eventId: string, taken: boolean = true) => {
        try {
            const event = myEvents.find(e => e.id === eventId)
            if (!event) return

            const updatedEventData = {
                ...event.eventData,
                taken,
                takenAt: taken ? new Date().toISOString() : undefined
            }

            const updatedEvent = await updateCalendarEvent(eventId, {
                eventData: updatedEventData
            })

            // Update local state
            setMyEvents(prev => prev.map(e => e.id === eventId ? updatedEvent : e))

        } catch (err) {
            console.error('Failed to mark medication as taken:', err)
            setError('Failed to update medication status')
        }
    }

    // Custom event component to handle right-clicks and medication status
    const CustomEvent = ({ event }: any) => {
        const isMedication = event.type === 'medication-reminder'
        const wasTaken = event.eventData?.taken || false
        const isPast = new Date(event.end) < new Date()

        return (
            <div
                onContextMenu={(e) => handleEventRightClick(event, e)}
                className="h-full w-full cursor-pointer relative"
            >
                <div className="flex items-center justify-between h-full">
                    <span className="flex-1 truncate text-xs">{event.title}</span>
                    {isMedication && (
                        <div className="flex items-center gap-1">
                            {wasTaken && (
                                <span className="text-xs">✓</span>
                            )}
                            {isMedication && isPast && !wasTaken && (
                                <span className="text-xs text-red-300">!</span>
                            )}
                            {isMedication && !isPast && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        markMedicationTaken(event.id, !wasTaken)
                                    }}
                                    className="text-xs bg-white/20 hover:bg-white/40 rounded px-1"
                                    title={wasTaken ? "Mark as not taken" : "Mark as taken"}
                                >
                                    {wasTaken ? "✓" : "○"}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Custom event style based on type and pain level
    const eventStyleGetter = (event: any) => {
        let colors = eventTypeColors[event.type as EventType] || eventTypeColors.symptom

        // Override colors for pain events based on pain level
        if (event.type === 'pain' && event.eventData?.painLevel) {
            colors = painLevelColors[event.eventData.painLevel as PainLevel] || colors
        }

        return {
            style: {
                backgroundColor: colors.bg,
                borderColor: colors.border,
                color: 'white',
                border: '1px solid ' + colors.border,
                borderRadius: '5px',
            }
        }
    }

    // Custom day styling for abnormal symptom periods
    const dayPropGetter = (date: Date) => {
        const isAbnormalDate = abnormalDateRanges.some(range => {
            // Convert all dates to YYYY-MM-DD strings for simpler comparison
            const currentDateStr = date.toISOString().split('T')[0]
            const startDateStr = range.start.toISOString().split('T')[0]
            const endDateStr = range.end.toISOString().split('T')[0]

            const isInRange = currentDateStr >= startDateStr && currentDateStr <= endDateStr
            return isInRange
        })

        if (isAbnormalDate) {
            return {
                style: {
                    border: '2px solid #ef4444',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)'
                }
            }
        }

        return {}
    }

    // SQL Event Log Interface
    interface SQLEventLog {
        id: number
        title: string
        event_type: string
        start_datetime: string // ISO format for SQL datetime
        end_datetime: string
        description: string | null
        created_at: string
        updated_at: string
    }

    // Convert event to SQL format
    const eventToSQL = (event: SymptomEvent): SQLEventLog => {
        const now = new Date().toISOString()
        return {
            id: event.id,
            title: event.title,
            event_type: event.type,
            start_datetime: event.start.toISOString(),
            end_datetime: event.end.toISOString(),
            description: event.description || null,
            created_at: now,
            updated_at: now
        }
    }

    // Log event changes for SQL database
    const logEventForSQL = (action: 'INSERT' | 'UPDATE' | 'DELETE', event: SymptomEvent) => {
        const sqlEvent = eventToSQL(event)
        const logEntry = {
            action,
            timestamp: new Date().toISOString(),
            event: sqlEvent,
            eventData: event.eventData,
            sql_insert: 'INSERT INTO symptom_events (id, title, event_type, start_datetime, end_datetime, description, created_at, updated_at) VALUES (' + sqlEvent.id + ', \'' + sqlEvent.title.replace(/'/g, "''") + '\', \'' + sqlEvent.event_type + '\', \'' + sqlEvent.start_datetime + '\', \'' + sqlEvent.end_datetime + '\', ' + (sqlEvent.description ? '\'' + sqlEvent.description.replace(/'/g, "''") + '\'' : 'NULL') + ', \'' + sqlEvent.created_at + '\', \'' + sqlEvent.updated_at + '\');',
            sql_update: 'UPDATE symptom_events SET title=\'' + sqlEvent.title.replace(/'/g, "''") + '\', event_type=\'' + sqlEvent.event_type + '\', start_datetime=\'' + sqlEvent.start_datetime + '\', end_datetime=\'' + sqlEvent.end_datetime + '\', description=' + (sqlEvent.description ? '\'' + sqlEvent.description.replace(/'/g, "''") + '\'' : 'NULL') + ', updated_at=\'' + sqlEvent.updated_at + '\' WHERE id=' + sqlEvent.id + ';',
            sql_delete: 'DELETE FROM symptom_events WHERE id=' + sqlEvent.id + ';'
        }

        // Log to console for now - in production, this would go to your backend
        console.log('SQL Event Log:', logEntry)

        // Store in localStorage for demonstration
        const existingLogs = JSON.parse(localStorage.getItem('sqlEventLogs') || '[]')
        existingLogs.push(logEntry)
        localStorage.setItem('sqlEventLogs', JSON.stringify(existingLogs))
    }

    // Generate recurring medication events
    const generateRecurringMedicationEvents = (formData: typeof quickAddForm) => {
        const events: any[] = []
        const startDate = new Date(formData.date)
        const endDate = formData.recurringEndDate ? new Date(formData.recurringEndDate) : new Date(startDate.getTime() + (90 * 24 * 60 * 60 * 1000)) // Default 90 days

        // Handle multiple times per day
        const times = formData.recurringTimes.filter(time => time.trim() !== '')
        if (times.length === 0) times.push(formData.time) // Fallback to main time

        let currentDate = new Date(startDate)

        while (currentDate <= endDate) {
            let shouldCreateEvent = false

            if (formData.recurringPattern === 'daily') {
                shouldCreateEvent = true
            } else if (formData.recurringPattern === 'weekly') {
                const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
                shouldCreateEvent = formData.recurringDays.includes(dayName)
            } else if (formData.recurringPattern === 'custom') {
                // For custom pattern, check if current date matches the interval
                const daysDiff = Math.floor((currentDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
                shouldCreateEvent = daysDiff % formData.recurringInterval === 0
            }

            if (shouldCreateEvent) {
                // Create events for each time of day
                times.forEach(timeStr => {
                    const [hours, minutes] = timeStr.split(':').map(Number)
                    const eventStart = new Date(currentDate)
                    eventStart.setHours(hours, minutes, 0, 0)

                    const eventEnd = new Date(eventStart)
                    eventEnd.setMinutes(eventEnd.getMinutes() + 30) // 30 minute duration

                    events.push({
                        title: formData.title,
                        start: eventStart,
                        end: eventEnd,
                        type: 'medication-reminder',
                        description: formData.description,
                        eventData: {
                            medication: formData.medication,
                            dosage: formData.dosage,
                            frequency: formData.frequency,
                            notes: formData.notes,
                            isRecurring: true,
                            recurringId: `${formData.medication}-${startDate.getTime()}` // Group related events
                        }
                    })
                })
            }

            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1)
        }

        return events
    }

    // Get medication adherence summary
    const getMedicationAdherence = () => {
        const medicationGroups: Record<string, {
            name: string,
            total: number,
            taken: number,
            missed: number,
            upcomingToday: number
        }> = {}

        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const oneWeekAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000))

        // Group medication events by recurring ID or medication name
        myEvents
            .filter(event => event.type === 'medication-reminder' && event.start >= oneWeekAgo)
            .forEach(event => {
                const medicationName = event.eventData?.medication || event.title
                const recurringId = event.eventData?.recurringId || medicationName

                if (!medicationGroups[recurringId]) {
                    medicationGroups[recurringId] = {
                        name: medicationName,
                        total: 0,
                        taken: 0,
                        missed: 0,
                        upcomingToday: 0
                    }
                }

                medicationGroups[recurringId].total++

                // Check if medication was taken (you could add a "taken" field to eventData)
                const wasTaken = event.eventData?.taken || false
                const isPast = event.end < now
                const isToday = event.start >= today && event.start < new Date(today.getTime() + 24 * 60 * 60 * 1000)

                if (isPast) {
                    if (wasTaken) {
                        medicationGroups[recurringId].taken++
                    } else {
                        medicationGroups[recurringId].missed++
                    }
                } else if (isToday) {
                    medicationGroups[recurringId].upcomingToday++
                }
            })

        return medicationGroups
    }

    // Add new event with proper date handling
    const addQuickEvent = async () => {
        if (!isAuthenticated) {
            setError(t('home.notAuthenticated'))
            return
        }

        if (isSubmitting) return // Prevent double submission

        try {
            setIsSubmitting(true)
            setError(null)

            const [hours, minutes] = quickAddForm.time.split(':').map(Number)

            // Parse start date properly to avoid timezone issues
            const dateParts = quickAddForm.date.split('-').map(Number)
            const startDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hours, minutes)

            // Check if this is a recurring medication reminder
            if (quickAddForm.type === 'medication-reminder' && quickAddForm.isRecurring) {
                // Generate all recurring events
                const recurringEvents = generateRecurringMedicationEvents(quickAddForm)

                // Create all recurring events
                for (const eventInfo of recurringEvents) {
                    try {
                        const newEvent = await createCalendarEvent(eventInfo)

                        // Log for SQL compatibility
                        logEventForSQL('INSERT', {
                            id: parseInt(newEvent.id, 10) || Date.now(),
                            title: newEvent.title,
                            start: newEvent.start,
                            end: newEvent.end,
                            type: newEvent.type as EventType,
                            description: newEvent.description,
                            eventData: newEvent.eventData
                        })
                    } catch (err) {
                        console.error('Failed to create recurring event:', err)
                        // Continue with next event even if one fails
                    }
                }

                // Reset form and close modal
                setQuickAddForm({
                    title: '',
                    type: 'symptom',
                    description: '',
                    date: new Date().toISOString().split('T')[0],
                    time: '12:00',
                    endDate: '',
                    endTime: '',
                    painLevel: 'mild',
                    location: '',
                    severity: 5,
                    medication: '',
                    dosage: '',
                    frequency: '',
                    isRecurring: false,
                    recurringPattern: 'daily',
                    recurringDays: [],
                    recurringInterval: 1,
                    recurringEndDate: '',
                    recurringTimes: [''],
                    doctorName: '',
                    appointmentType: '',
                    notes: ''
                })
                setShowQuickAdd(false)

                // Reset analysis state
                setHasAnalyzed(false)
                setAbnormalDateRanges([])

                return // Exit early for recurring medications
            }

            // Handle end date
            let endDate: Date
            if (quickAddForm.endDate && quickAddForm.endTime) {
                const [endHours, endMinutes] = quickAddForm.endTime.split(':').map(Number)
                const endDateParts = quickAddForm.endDate.split('-').map(Number)
                endDate = new Date(endDateParts[0], endDateParts[1] - 1, endDateParts[2], endHours, endMinutes)
            } else {
                // Default 1 hour duration if no end date specified
                endDate = new Date(startDate)
                endDate.setHours(hours + 1, minutes)
            }

            // Prepare event-specific data
            const eventData: Record<string, any> = {}

            if (quickAddForm.type === 'pain') {
                eventData.painLevel = quickAddForm.painLevel
                if (quickAddForm.location) eventData.location = quickAddForm.location
                eventData.severity = quickAddForm.severity
            } else if (quickAddForm.type === 'medication-reminder') {
                if (quickAddForm.medication) eventData.medication = quickAddForm.medication
                if (quickAddForm.dosage) eventData.dosage = quickAddForm.dosage
                if (quickAddForm.frequency) eventData.frequency = quickAddForm.frequency
            } else if (quickAddForm.type === 'medical-appointment') {
                if (quickAddForm.doctorName) eventData.doctorName = quickAddForm.doctorName
                if (quickAddForm.appointmentType) eventData.appointmentType = quickAddForm.appointmentType
            }

            // Add general notes if provided
            if (quickAddForm.notes) eventData.notes = quickAddForm.notes

            const newEvent = await createCalendarEvent({
                title: quickAddForm.title,
                start: startDate,
                end: endDate,
                type: quickAddForm.type,
                description: quickAddForm.description,
                allDay: false,
                eventData: Object.keys(eventData).length > 0 ? eventData : undefined
            })

            // REMOVED: Don't manually add to state - let real-time subscription handle it
            // setMyEvents(prev => [...prev, newEvent])

            // Keep SQL logging for compatibility
            logEventForSQL('INSERT', {
                id: parseInt(newEvent.id, 10) || Date.now(),
                title: newEvent.title,
                start: newEvent.start,
                end: newEvent.end,
                type: newEvent.type as EventType,
                description: newEvent.description,
                eventData: newEvent.eventData
            })

            setQuickAddForm({
                title: '',
                type: 'symptom',
                description: '',
                date: new Date().toISOString().split('T')[0],
                time: '12:00',
                endDate: '',
                endTime: '',
                painLevel: 'mild',
                location: '',
                severity: 5,
                medication: '',
                dosage: '',
                frequency: '',
                isRecurring: false,
                recurringPattern: 'daily',
                recurringDays: [],
                recurringInterval: 1,
                recurringEndDate: '',
                recurringTimes: [''],
                doctorName: '',
                appointmentType: '',
                notes: ''
            })
            setShowQuickAdd(false)

            // Reset analysis state so it can re-analyze with new events
            setHasAnalyzed(false)
            setAbnormalDateRanges([])
        } catch (err) {
            console.error('Failed to create event:', err)
            setError(t('home.errorCreating'))
        } finally {
            setIsSubmitting(false)
        }
    }

    // Get SQL logs from localStorage
    const getSQLLogs = () => {
        return JSON.parse(localStorage.getItem('sqlEventLogs') || '[]')
    }

    // Clear SQL logs
    const clearSQLLogs = () => {
        localStorage.removeItem('sqlEventLogs')
        // Force re-render by updating state
        setShowSQLLogs(false)
        setTimeout(() => setShowSQLLogs(true), 100)
    }

    // console.log('Available functions:', { deleteEvent, getSQLLogs, clearSQLLogs })

    return (
        <div className="min-h-screen bg-background" onClick={handleCloseContextMenu}>
            <Navbar />

            {/* Error Display */}
            {error && (
                <motion.div
                    className="px-4 py-2"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                >
                    <motion.div
                        className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-sm"
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.2, delay: 0.1 }}
                    >
                        {error}
                        <button
                            onClick={() => setError(null)}
                            className="ml-2 hover:bg-destructive/20 rounded px-2 py-1 transition-colors"
                        >
                            ×
                        </button>
                    </motion.div>
                </motion.div>
            )}

            <motion.div
                className="px-4 py-4 flex flex-col lg:flex-row gap-4 min-h-[calc(100vh-70px)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
            >
                {/* Calendar Section - Left Side on desktop, Top on mobile */}
                <motion.div
                    className="flex-1 h-[calc(100vh-120px)] lg:h-[calc(100vh-120px)] min-h-[600px]"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    <div className="h-full w-full rounded-lg overflow-hidden bg-background relative">
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
                                    <p className="text-muted-foreground">{t('home.loadingEvents')}</p>
                                </div>
                            </div>
                        ) : !isAuthenticated ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center">
                                    <h2 className="text-xl font-semibold mb-2">Please Log In</h2>
                                    <p className="text-muted-foreground">You need to log in to view your calendar events.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <DragAndDropCalendar
                                    defaultDate={defaultDate}
                                    defaultView={Views.MONTH}
                                    views={[Views.MONTH, Views.WEEK, Views.DAY]}
                                    events={myEvents}
                                    localizer={localizer}
                                    onEventDrop={moveEvent}
                                    onEventResize={resizeEvent}
                                    onSelectEvent={handleEventClick}
                                    components={{
                                        event: CustomEvent
                                    }}
                                    popup
                                    resizable
                                    selectable
                                    eventPropGetter={eventStyleGetter}
                                    dayPropGetter={dayPropGetter}
                                    className="rbc-calendar h-full"
                                    style={{ height: '100%' }}
                                    toolbar={true}
                                    showMultiDayTimes={true}
                                />

                                {/* Floating Action Button - positioned relative to calendar */}
                                <motion.button
                                    onClick={() => setShowQuickAdd(!showQuickAdd)}
                                    className="absolute bottom-4 right-4 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-sm hover:bg-primary/90 hover:shadow-md transition-all duration-200 flex items-center justify-center z-40 hover:cursor-pointer"
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ duration: 0.5, delay: 0.8, type: "spring", stiffness: 200 }}
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <motion.div
                                        animate={{ rotate: showQuickAdd ? 45 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {showQuickAdd ? (
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        ) : (
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                        )}
                                    </motion.div>
                                </motion.button>

                                {/* SQL Logs Button */}
                                {/* <button
                                    onClick={() => setShowSQLLogs(!showSQLLogs)}
                                    className="absolute bottom-4 right-20 w-12 h-12 bg-secondary text-secondary-foreground rounded-full shadow-lg hover:bg-secondary/90 hover:shadow-xl transition-all duration-200 flex items-center justify-center z-40 hover:cursor-pointer"
                                    title="View SQL Logs"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </button> */}
                            </>
                        )}
                    </div>
                </motion.div>

                {/* Fullscreen Quick Add Modal */}
                {showQuickAdd && (
                    <motion.div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={(e) => e.target === e.currentTarget && setShowQuickAdd(false)}
                    >
                        <motion.div
                            className="bg-card border border-border rounded-lg p-6 w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden"
                            initial={{ scale: 0.8, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0, y: 20 }}
                            transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
                        >
                            <motion.div
                                className="flex items-center justify-between mb-4"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: 0.1 }}
                            >
                                <h3 className="text-lg font-semibold">{t('home.quickAdd')}</h3>
                                <motion.button
                                    onClick={() => setShowQuickAdd(false)}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </motion.button>
                            </motion.div>
                            <motion.div
                                className="space-y-4 max-h-[70vh] overflow-y-auto px-1"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3, delay: 0.2 }}
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground block mb-2">Title</label>
                                        <input
                                            type="text"
                                            value={quickAddForm.title}
                                            onChange={(e) => setQuickAddForm(prev => ({ ...prev, title: e.target.value }))}
                                            placeholder={t('home.eventTitle')}
                                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground block mb-2">{t('home.type')}</label>
                                        <select
                                            value={quickAddForm.type}
                                            onChange={(e) => setQuickAddForm(prev => ({ ...prev, type: e.target.value as EventType }))}
                                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                        >
                                            {Object.entries(eventTypeColors).map(([type, colors]) => (
                                                <option key={type} value={type}>{colors.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Pain-specific fields */}
                                {quickAddForm.type === 'pain' && (
                                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                                        <h4 className="text-sm font-semibold text-red-900 dark:text-red-100 mb-3">Pain Details</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium block mb-2">Pain Level</label>
                                                <select
                                                    value={quickAddForm.painLevel}
                                                    onChange={(e) => setQuickAddForm(prev => ({ ...prev, painLevel: e.target.value as PainLevel }))}
                                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                                >
                                                    {Object.entries(painLevelColors).map(([level, colors]) => (
                                                        <option key={level} value={level}>{colors.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium block mb-2">Location</label>
                                                <input
                                                    type="text"
                                                    value={quickAddForm.location}
                                                    onChange={(e) => setQuickAddForm(prev => ({ ...prev, location: e.target.value }))}
                                                    placeholder={t('home.locationPlaceholder')}
                                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <label className="text-sm font-medium block mb-2">{t('home.severity')} (1-10): {quickAddForm.severity}</label>
                                            <input
                                                type="range"
                                                min="1"
                                                max="10"
                                                value={quickAddForm.severity}
                                                onChange={(e) => setQuickAddForm(prev => ({ ...prev, severity: parseInt(e.target.value) }))}
                                                className="w-full"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Medication-specific fields */}
                                {quickAddForm.type === 'medication-reminder' && (
                                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                                        <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-3">Medication Details</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium block mb-2">Medication</label>
                                                <input
                                                    type="text"
                                                    value={quickAddForm.medication}
                                                    onChange={(e) => setQuickAddForm(prev => ({ ...prev, medication: e.target.value }))}
                                                    placeholder="Medication name"
                                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium block mb-2">Dosage</label>
                                                <input
                                                    type="text"
                                                    value={quickAddForm.dosage}
                                                    onChange={(e) => setQuickAddForm(prev => ({ ...prev, dosage: e.target.value }))}
                                                    placeholder="e.g., 500mg, 2 tablets"
                                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <label className="text-sm font-medium block mb-2">Frequency</label>
                                            <input
                                                type="text"
                                                value={quickAddForm.frequency}
                                                onChange={(e) => setQuickAddForm(prev => ({ ...prev, frequency: e.target.value }))}
                                                placeholder="e.g., twice daily, every 6 hours"
                                                className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                            />
                                        </div>

                                        {/* Recurring medication options */}
                                        <div className="mt-4 border-t border-green-200 dark:border-green-700 pt-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <input
                                                    type="checkbox"
                                                    id="isRecurring"
                                                    checked={quickAddForm.isRecurring}
                                                    onChange={(e) => setQuickAddForm(prev => ({ ...prev, isRecurring: e.target.checked }))}
                                                    className="rounded border-border"
                                                />
                                                <label htmlFor="isRecurring" className="text-sm font-medium">Set up recurring reminders</label>
                                            </div>

                                            {quickAddForm.isRecurring && (
                                                <div className="space-y-4 bg-green-100 dark:bg-green-800/30 p-3 rounded">
                                                    <div>
                                                        <label className="text-sm font-medium block mb-2">Repeat Pattern</label>
                                                        <select
                                                            value={quickAddForm.recurringPattern}
                                                            onChange={(e) => setQuickAddForm(prev => ({ ...prev, recurringPattern: e.target.value as 'daily' | 'weekly' | 'custom' }))}
                                                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                                        >
                                                            <option value="daily">Daily</option>
                                                            <option value="weekly">Weekly (specific days)</option>
                                                            <option value="custom">Every N days</option>
                                                        </select>
                                                    </div>

                                                    {quickAddForm.recurringPattern === 'weekly' && (
                                                        <div>
                                                            <label className="text-sm font-medium block mb-2">Days of the week</label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                                                                    <label key={day} className="flex items-center gap-1 text-xs">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={quickAddForm.recurringDays.includes(day)}
                                                                            onChange={(e) => {
                                                                                if (e.target.checked) {
                                                                                    setQuickAddForm(prev => ({ ...prev, recurringDays: [...prev.recurringDays, day] }))
                                                                                } else {
                                                                                    setQuickAddForm(prev => ({ ...prev, recurringDays: prev.recurringDays.filter(d => d !== day) }))
                                                                                }
                                                                            }}
                                                                            className="rounded border-border"
                                                                        />
                                                                        {day.slice(0, 3)}
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {quickAddForm.recurringPattern === 'custom' && (
                                                        <div>
                                                            <label className="text-sm font-medium block mb-2">Every N days</label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max="30"
                                                                value={quickAddForm.recurringInterval}
                                                                onChange={(e) => setQuickAddForm(prev => ({ ...prev, recurringInterval: parseInt(e.target.value) || 1 }))}
                                                                className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                                            />
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-sm font-medium block mb-2">End Date</label>
                                                            <input
                                                                type="date"
                                                                value={quickAddForm.recurringEndDate}
                                                                onChange={(e) => setQuickAddForm(prev => ({ ...prev, recurringEndDate: e.target.value }))}
                                                                className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="text-sm font-medium block mb-2">Times per day</label>
                                                        {quickAddForm.recurringTimes.map((time, index) => (
                                                            <div key={index} className="flex items-center gap-2 mb-2">
                                                                <input
                                                                    type="time"
                                                                    value={time}
                                                                    onChange={(e) => {
                                                                        const newTimes = [...quickAddForm.recurringTimes]
                                                                        newTimes[index] = e.target.value
                                                                        setQuickAddForm(prev => ({ ...prev, recurringTimes: newTimes }))
                                                                    }}
                                                                    className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                                                />
                                                                {quickAddForm.recurringTimes.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newTimes = quickAddForm.recurringTimes.filter((_, i) => i !== index)
                                                                            setQuickAddForm(prev => ({ ...prev, recurringTimes: newTimes }))
                                                                        }}
                                                                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            onClick={() => setQuickAddForm(prev => ({ ...prev, recurringTimes: [...prev.recurringTimes, ''] }))}
                                                            className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                                                        >
                                                            Add Time
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Medical appointment-specific fields */}
                                {quickAddForm.type === 'medical-appointment' && (
                                    <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg border border-pink-200 dark:border-pink-800">
                                        <h4 className="text-sm font-semibold text-pink-900 dark:text-pink-100 mb-3">Appointment Details</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium block mb-2">Doctor Name</label>
                                                <input
                                                    type="text"
                                                    value={quickAddForm.doctorName}
                                                    onChange={(e) => setQuickAddForm(prev => ({ ...prev, doctorName: e.target.value }))}
                                                    placeholder="Dr. Smith"
                                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium block mb-2">Appointment Type</label>
                                                <input
                                                    type="text"
                                                    value={quickAddForm.appointmentType}
                                                    onChange={(e) => setQuickAddForm(prev => ({ ...prev, appointmentType: e.target.value }))}
                                                    placeholder="e.g., Check-up, Follow-up"
                                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Date and time fields */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground block mb-2">{t('home.startDate')}</label>
                                        <input
                                            type="date"
                                            value={quickAddForm.date}
                                            onChange={(e) => setQuickAddForm(prev => ({ ...prev, date: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground block mb-2">{t('home.startTime')}</label>
                                        <input
                                            type="time"
                                            value={quickAddForm.time}
                                            onChange={(e) => setQuickAddForm(prev => ({ ...prev, time: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground block mb-2">{t('home.endDate')}</label>
                                        <input
                                            type="date"
                                            value={quickAddForm.endDate}
                                            onChange={(e) => setQuickAddForm(prev => ({ ...prev, endDate: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground block mb-2">{t('home.endTime')}</label>
                                        <input
                                            type="time"
                                            value={quickAddForm.endTime}
                                            onChange={(e) => setQuickAddForm(prev => ({ ...prev, endTime: e.target.value }))}
                                            disabled={!quickAddForm.endDate}
                                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-foreground block mb-2">{t('home.description')}</label>
                                    <textarea
                                        value={quickAddForm.description}
                                        onChange={(e) => setQuickAddForm(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder={t('home.additionalDetails')}
                                        rows={3}
                                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                    />
                                </div>

                                {/* General notes field */}
                                <div>
                                    <label className="text-sm font-medium text-foreground block mb-2">{t('home.notes')}</label>
                                    <textarea
                                        value={quickAddForm.notes}
                                        onChange={(e) => setQuickAddForm(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder={t('home.additionalNotes')}
                                        rows={2}
                                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => setShowQuickAdd(false)}
                                        className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                                    >
                                        {t('home.cancel')}
                                    </button>
                                    <button
                                        onClick={addQuickEvent}
                                        disabled={!quickAddForm.title || isSubmitting}
                                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting && (
                                            <div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full"></div>
                                        )}
                                        {isSubmitting ? t('home.adding') : t('home.addEvent')}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    </motion.div>
                )}

                {/* Event Details Modal */}
                {showEventDetails && selectedEvent && (
                    <motion.div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={(e) => e.target === e.currentTarget && setShowEventDetails(false)}
                    >
                        <motion.div
                            className="bg-card border border-border rounded-lg p-6 w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden"
                            initial={{ scale: 0.8, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0, y: 20 }}
                            transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
                        >
                            <motion.div
                                className="flex items-center justify-between mb-4"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: 0.1 }}
                            >
                                <h3 className="text-lg font-semibold">{t('home.editEvent')}</h3>
                                <div className="flex gap-2">
                                    <motion.button
                                        onClick={async () => {
                                            if (confirm('Are you sure you want to delete this event?')) {
                                                await deleteEvent(selectedEvent.id)
                                                setShowEventDetails(false)
                                                setSelectedEvent(null)
                                            }
                                        }}
                                        className="px-3 py-1 bg-destructive text-destructive-foreground rounded text-sm hover:bg-destructive/90 transition-colors"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        Delete
                                    </motion.button>
                                    <motion.button
                                        onClick={() => {
                                            setShowEventDetails(false)
                                            setSelectedEvent(null)
                                        }}
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </motion.button>
                                </div>
                            </motion.div>

                            <motion.div
                                className="space-y-4 max-h-[70vh] overflow-y-auto px-1"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3, delay: 0.2 }}
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground block mb-2">{t('home.title')}</label>
                                        <input
                                            type="text"
                                            value={editForm.title}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                            placeholder={t('home.eventTitle')}
                                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground block mb-2">{t('home.type')}</label>
                                        <select
                                            value={editForm.type}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value as EventType }))}
                                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                        >
                                            {Object.entries(eventTypeColors).map(([type, colors]) => (
                                                <option key={type} value={type}>{colors.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Pain-specific fields */}
                                {editForm.type === 'pain' && (
                                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                                        <h4 className="text-sm font-semibold text-red-900 dark:text-red-100 mb-3">Pain Details</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium block mb-2">Pain Level</label>
                                                <select
                                                    value={editForm.painLevel}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, painLevel: e.target.value as PainLevel }))}
                                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                                >
                                                    {Object.entries(painLevelColors).map(([level, colors]) => (
                                                        <option key={level} value={level}>{colors.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium block mb-2">Location</label>
                                                <input
                                                    type="text"
                                                    value={editForm.location}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                                                    placeholder="e.g., head, back, knee"
                                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <label className="text-sm font-medium block mb-2">Severity (1-10): {editForm.severity}</label>
                                            <input
                                                type="range"
                                                min="1"
                                                max="10"
                                                value={editForm.severity}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, severity: parseInt(e.target.value) }))}
                                                className="w-full"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Medication-specific fields */}
                                {editForm.type === 'medication-reminder' && (
                                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                                        <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-3">Medication Details</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium block mb-2">Medication</label>
                                                <input
                                                    type="text"
                                                    value={editForm.medication}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, medication: e.target.value }))}
                                                    placeholder="Medication name"
                                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium block mb-2">Dosage</label>
                                                <input
                                                    type="text"
                                                    value={editForm.dosage}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, dosage: e.target.value }))}
                                                    placeholder="e.g., 500mg, 2 tablets"
                                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <label className="text-sm font-medium block mb-2">Frequency</label>
                                            <input
                                                type="text"
                                                value={editForm.frequency}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, frequency: e.target.value }))}
                                                placeholder="e.g., twice daily, every 6 hours"
                                                className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Medical appointment-specific fields */}
                                {editForm.type === 'medical-appointment' && (
                                    <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg border border-pink-200 dark:border-pink-800">
                                        <h4 className="text-sm font-semibold text-pink-900 dark:text-pink-100 mb-3">Appointment Details</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium block mb-2">Doctor Name</label>
                                                <input
                                                    type="text"
                                                    value={editForm.doctorName}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, doctorName: e.target.value }))}
                                                    placeholder="Dr. Smith"
                                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium block mb-2">Appointment Type</label>
                                                <input
                                                    type="text"
                                                    value={editForm.appointmentType}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, appointmentType: e.target.value }))}
                                                    placeholder="e.g., Check-up, Follow-up"
                                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Date and time fields */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground block mb-2">{t('home.startDate')}</label>
                                        <input
                                            type="date"
                                            value={editForm.date}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground block mb-2">{t('home.startTime')}</label>
                                        <input
                                            type="time"
                                            value={editForm.time}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, time: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground block mb-2">{t('home.endDate')}</label>
                                        <input
                                            type="date"
                                            value={editForm.endDate}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, endDate: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground block mb-2">{t('home.endTime')}</label>
                                        <input
                                            type="time"
                                            value={editForm.endTime}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, endTime: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-foreground block mb-2">{t('home.description')}</label>
                                    <textarea
                                        value={editForm.description}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder={t('home.additionalDetails')}
                                        rows={3}
                                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-foreground block mb-2">{t('home.notes')}</label>
                                    <textarea
                                        value={editForm.notes}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder={t('home.additionalNotes')}
                                        rows={2}
                                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => {
                                            setShowEventDetails(false)
                                            setSelectedEvent(null)
                                        }}
                                        className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                                    >
                                        {t('home.cancel')}
                                    </button>
                                    <button
                                        onClick={updateEvent}
                                        disabled={!editForm.title || isSubmitting}
                                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting && (
                                            <div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full"></div>
                                        )}
                                        {isSubmitting ? t('home.saving') : t('home.saveChanges')}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    </motion.div>
                )}

                {/* SQL Logs Modal */}
                {showSQLLogs && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-card border border-border rounded-lg p-6 w-full max-w-4xl max-h-[80vh] shadow-2xl flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">SQL Event Logs</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={clearSQLLogs}
                                        className="px-3 py-1 bg-destructive text-destructive-foreground rounded text-sm hover:bg-destructive/90 transition-colors"
                                    >
                                        Clear Logs
                                    </button>
                                    <button
                                        onClick={() => setShowSQLLogs(false)}
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <div className="space-y-4">
                                    {getSQLLogs().length === 0 ? (
                                        <p className="text-muted-foreground text-center py-8">No logs yet. Add, edit, or delete events to see SQL logs.</p>
                                    ) : (
                                        getSQLLogs().reverse().map((log: any, index: number) => (
                                            <div key={index} className="bg-background border border-border rounded-lg p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${log.action === 'INSERT' ? 'bg-green-100 text-green-800' :
                                                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-red-100 text-red-800'
                                                        }`}>
                                                        {log.action}
                                                    </span>
                                                    <span className="text-sm text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                                                </div>
                                                <div className="space-y-2">
                                                    <div>
                                                        <p className="text-sm font-medium">Event: {log.event.title} ({log.event.event_type})</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {new Date(log.event.start_datetime).toLocaleString()} - {new Date(log.event.end_datetime).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-muted-foreground mb-1">SQL Query:</p>
                                                        <code className="block p-2 bg-muted rounded text-xs overflow-x-auto">
                                                            {log.action === 'INSERT' ? log.sql_insert :
                                                                log.action === 'UPDATE' ? log.sql_update :
                                                                    log.sql_delete}
                                                        </code>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Right-click Context Menu */}
                {contextMenu.visible && (
                    <div
                        className="fixed bg-card border border-border rounded-lg shadow-lg py-2 z-50"
                        style={{
                            left: `${contextMenu.x}px`,
                            top: `${contextMenu.y}px`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={handleContextMenuEdit}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            {t('home.contextMenu.edit')}
                        </button>
                        <button
                            onClick={handleContextMenuDelete}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2 text-destructive"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            {t('home.contextMenu.delete')}
                        </button>
                    </div>
                )}

                {/* Chat/Recommendations Section - Right Side on desktop, Bottom on mobile */}
                <motion.div
                    className="w-full lg:w-96 flex flex-col h-[calc(100vh-120px)] lg:h-[calc(100vh-120px)] min-h-[600px] "
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                >
                    {/* Event Types Legend - Compact */}
                    <motion.div
                        className="bg-card border border-border rounded-lg p-2 mb-3 flex-shrink-0"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.6 }}
                    >
                        <motion.h3
                            className="text-s font-semibold mb-1.5"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3, delay: 0.7 }}
                        >
                            Legend
                        </motion.h3>
                        <motion.div
                            className="space-y-1.5"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3, delay: 0.8 }}
                        >
                            <div className="flex flex-wrap gap-1.5">
                                {Object.entries(eventTypeColors).map(([type, colors], index) => (
                                    <motion.div
                                        key={type}
                                        className="flex items-center gap-1"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.2, delay: 0.9 + (index * 0.05) }}
                                    >
                                        <motion.div
                                            className="w-2.5 h-2.5 rounded"
                                            style={{ backgroundColor: colors.bg }}
                                            whileHover={{ scale: 1.2 }}
                                        />
                                        <span className="text-xs text-foreground">{colors.label}</span>
                                    </motion.div>
                                ))}
                            </div>
                            <div className="border-t border-border pt-1.5">
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(painLevelColors).map(([level, colors], index) => (
                                        <motion.div
                                            key={level}
                                            className="flex items-center gap-1"
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ duration: 0.2, delay: 1.2 + (index * 0.05) }}
                                        >
                                            <motion.div
                                                className="w-2.5 h-2.5 rounded"
                                                style={{ backgroundColor: colors.bg }}
                                                whileHover={{ scale: 1.2 }}
                                            />
                                            <span className="text-xs text-foreground">{colors.label}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>

                    <Card className="border shadow-lg outline outline-1 outline-border flex-1 flex flex-col min-h-0">
                        <CardHeader className="pb-4 border-b border-border flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center">
                                        <span className="text-primary-foreground font-semibold text-sm"><img src="/MedicalMole.svg" alt="Logo" className="w-6 h-6 object-contain" /></span>
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">{t('home.chatTitle')}</CardTitle>
                                        <p className="text-sm text-muted-foreground">{t('home.chatSubtitle')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Debug buttons for health models */}
                                    <button
                                        onClick={() => callPhysicalModel(['fatigue', 'headache', 'nausea'])}
                                        className="text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded text-xs border border-border"
                                        title="Test Physical Model"
                                    >
                                        Physical
                                    </button>
                                    <button
                                        onClick={() => callMentalModel(['anxiety', 'depression', 'mood swings'])}
                                        className="text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded text-xs border border-border"
                                        title="Test Mental Model"
                                    >
                                        Mental
                                    </button>
                                    <button
                                        onClick={clearChat}
                                        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                                        title="Clear chat"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </CardHeader>

                        {/* Chat Messages */}
                        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                            <div className="space-y-4">
                                {messages.length === 0 && (
                                    <motion.div
                                        className="bg-background border border-border rounded-lg p-3 mr-8 text-sm text-muted-foreground"
                                        initial={{ opacity: 0, y: 20, x: -20 }}
                                        animate={{ opacity: 1, y: 0, x: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <div className="prose prose-sm max-w-none dark:prose-invert">
                                            {t('home.chatWelcome')}
                                        </div>
                                    </motion.div>
                                )}
                                {messages.map((message, index) => (
                                    <motion.div
                                        key={message.id}
                                        className={`rounded-lg p-3 text-sm ${message.isUser
                                            ? 'bg-muted border border-border ml-8'
                                            : 'bg-background border border-border mr-8 text-muted-foreground'
                                            }`}
                                        initial={{ opacity: 0, y: 20, x: message.isUser ? 20 : -20 }}
                                        animate={{ opacity: 1, y: 0, x: 0 }}
                                        transition={{
                                            duration: 0.3,
                                            delay: index * 0.1,
                                            type: "spring",
                                            stiffness: 200
                                        }}
                                        layout
                                    >
                                        <motion.div
                                            className="prose prose-sm max-w-none dark:prose-invert"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.2, delay: 0.1 }}
                                        >
                                            <MarkdownRenderer content={message.content} />
                                        </motion.div>
                                        <motion.div
                                            className="text-xs text-muted-foreground mt-1"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.2, delay: 0.2 }}
                                        >
                                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </motion.div>
                                    </motion.div>
                                ))}

                                {isChatLoading && (
                                    <motion.div
                                        className="bg-background border border-border rounded-lg p-3 mr-8 text-sm text-muted-foreground"
                                        initial={{ opacity: 0, y: 20, x: -20 }}
                                        animate={{ opacity: 1, y: 0, x: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <motion.div
                                                className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full"
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                            ></motion.div>
                                            <motion.span
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ duration: 0.3, delay: 0.1 }}
                                            >
                                                Thinking...
                                            </motion.span>
                                        </div>
                                    </motion.div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </CardContent>

                        {/* Input Area */}
                        <motion.div
                            className="p-4 border-t border-border flex-shrink-0"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 1.4 }}
                        >
                            <form onSubmit={handleSendMessage} className="flex gap-2">
                                <motion.input
                                    type="text"
                                    value={currentMessage}
                                    onChange={(e) => setCurrentMessage(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    placeholder={t('home.chatPlaceholder')}
                                    disabled={isChatLoading}
                                    className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.3, delay: 1.5 }}
                                    whileFocus={{ scale: 1.02 }}
                                />
                                <motion.button
                                    type="submit"
                                    disabled={isChatLoading || !currentMessage.trim()}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3, delay: 1.6 }}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    {isChatLoading ? (
                                        <motion.div
                                            className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full"
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                        ></motion.div>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                    )}
                                </motion.button>
                            </form>
                            <div className="mt-3 text-xs text-muted-foreground text-center px-2">
                                <strong>{t('home.disclaimer')}</strong>
                            </div>
                        </motion.div>
                    </Card>
                </motion.div>
            </motion.div>
        </div>
    )
}
