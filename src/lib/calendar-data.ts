import { pb } from '@/lib/auth-utils'
import { type RecordModel } from 'pocketbase'

// Simple debounce utility to prevent rapid API calls
const debounceMap = new Map<string, NodeJS.Timeout>()

function debounce(key: string, fn: () => void, delay: number = 100) {
    if (debounceMap.has(key)) {
        clearTimeout(debounceMap.get(key)!)
    }

    const timeout = setTimeout(() => {
        fn()
        debounceMap.delete(key)
    }, delay)

    debounceMap.set(key, timeout)
}

// Calendar data interface matching PocketBase schema
export interface CalendarDataRecord extends RecordModel {
    id: string
    user_id: string
    title: string
    event_type: string
    description: string
    start_date: string // ISO datetime string
    end_date: string   // ISO datetime string
    all_day: boolean
    event_data: Record<string, any> // JSON field for additional data
    created: string
    updated: string
}

// Local event interface for the calendar component
export interface CalendarEvent {
    id: string
    title: string
    start: Date
    end: Date
    type: string
    description?: string
    allDay?: boolean
    eventData?: Record<string, any>
}

// Convert PocketBase record to calendar event
export function recordToEvent(record: CalendarDataRecord): CalendarEvent {
    return {
        id: record.id,
        title: record.title,
        start: new Date(record.start_date),
        end: new Date(record.end_date),
        type: record.event_type,
        description: record.description,
        allDay: record.all_day,
        eventData: record.event_data
    }
}

// Convert calendar event to PocketBase record data
export function eventToRecordData(event: CalendarEvent, userId: string): Partial<CalendarDataRecord> {
    return {
        user_id: userId,
        title: event.title,
        event_type: event.type,
        description: event.description || '',
        start_date: event.start.toISOString(),
        end_date: event.end.toISOString(),
        all_day: event.allDay || false,
        event_data: event.eventData || {}
    }
}

// Get current user ID from auth store
export function getCurrentUserId(): string | null {
    return pb.authStore.model?.id || null
}

// Fetch all calendar events for the current user
export async function fetchUserCalendarEvents(): Promise<CalendarEvent[]> {
    const userId = getCurrentUserId()
    if (!userId) {
        throw new Error('User not authenticated')
    }

    try {
        // Add a small delay to prevent rapid successive calls in StrictMode
        await new Promise(resolve => setTimeout(resolve, 50))

        const records = await pb.collection('calendar_data').getFullList<CalendarDataRecord>({
            filter: `user_id = "${userId}"`,
            sort: 'start_date',
            requestKey: `calendar_events_${userId}` // Use requestKey to prevent auto-cancellation
        })

        return records.map(recordToEvent)
    } catch (error: any) {
        console.error('Error fetching calendar events:', error)

        // Don't throw error for cancelled requests (status 0)
        if (error.status === 0) {
            console.warn('Request was cancelled, likely due to React StrictMode')
            return []
        }

        throw new Error('Failed to fetch calendar events')
    }
}

// Create a new calendar event
export async function createCalendarEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    const userId = getCurrentUserId()
    if (!userId) {
        throw new Error('User not authenticated')
    }

    try {
        const recordData = eventToRecordData({ ...event, id: '' }, userId)
        const record = await pb.collection('calendar_data').create<CalendarDataRecord>(recordData, {
            requestKey: `create_event_${Date.now()}` // Unique key to prevent cancellation
        })
        return recordToEvent(record)
    } catch (error: any) {
        console.error('Error creating calendar event:', error)

        // Handle specific PocketBase errors
        if (error.status === 0) {
            throw new Error('Request cancelled - please try again')
        }

        throw new Error('Failed to create calendar event')
    }
}

// Update an existing calendar event
export async function updateCalendarEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const userId = getCurrentUserId()
    if (!userId) {
        throw new Error('User not authenticated')
    }

    try {
        // First verify the event belongs to the current user
        const existingRecord = await pb.collection('calendar_data').getOne<CalendarDataRecord>(eventId)
        if (existingRecord.user_id !== userId) {
            throw new Error('Unauthorized: Event does not belong to current user')
        }

        // Prepare update data
        const updateData: Partial<CalendarDataRecord> = {}
        if (updates.title) updateData.title = updates.title
        if (updates.type) updateData.event_type = updates.type
        if (updates.description !== undefined) updateData.description = updates.description
        if (updates.start) updateData.start_date = updates.start.toISOString()
        if (updates.end) updateData.end_date = updates.end.toISOString()
        if (updates.allDay !== undefined) updateData.all_day = updates.allDay
        if (updates.eventData) updateData.event_data = updates.eventData

        const record = await pb.collection('calendar_data').update<CalendarDataRecord>(eventId, updateData)
        return recordToEvent(record)
    } catch (error) {
        console.error('Error updating calendar event:', error)
        throw new Error('Failed to update calendar event')
    }
}

// Delete a calendar event
export async function deleteCalendarEvent(eventId: string): Promise<void> {
    const userId = getCurrentUserId()
    if (!userId) {
        throw new Error('User not authenticated')
    }

    try {
        // First verify the event belongs to the current user
        const existingRecord = await pb.collection('calendar_data').getOne<CalendarDataRecord>(eventId)
        if (existingRecord.user_id !== userId) {
            throw new Error('Unauthorized: Event does not belong to current user')
        }

        await pb.collection('calendar_data').delete(eventId)
    } catch (error) {
        console.error('Error deleting calendar event:', error)
        throw new Error('Failed to delete calendar event')
    }
}

// Subscribe to real-time updates for calendar events
export function subscribeToCalendarEvents(
    onUpdate: (action: 'create' | 'update' | 'delete', event: CalendarEvent | string) => void
): Promise<() => void> {
    const userId = getCurrentUserId()
    if (!userId) {
        console.warn('Cannot subscribe to calendar events: User not authenticated')
        return Promise.resolve(() => { })
    }

    return pb.collection('calendar_data').subscribe<CalendarDataRecord>('*', (e) => {
        // Only process events for the current user
        if (e.record?.user_id === userId) {
            if (e.action === 'create' || e.action === 'update') {
                onUpdate(e.action, recordToEvent(e.record))
            } else if (e.action === 'delete') {
                onUpdate('delete', e.record.id)
            }
        }
    })
}

// Batch operations for initial sync
export async function syncLocalEventsToDatabase(localEvents: CalendarEvent[]): Promise<void> {
    const userId = getCurrentUserId()
    if (!userId) {
        throw new Error('User not authenticated')
    }

    try {
        // Create all local events in the database
        const promises = localEvents.map(event =>
            createCalendarEvent({
                title: event.title,
                start: event.start,
                end: event.end,
                type: event.type,
                description: event.description,
                allDay: event.allDay,
                eventData: event.eventData
            })
        )

        await Promise.all(promises)
    } catch (error) {
        console.error('Error syncing local events to database:', error)
        throw new Error('Failed to sync events to database')
    }
}
