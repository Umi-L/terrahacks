import { create } from 'zustand'
import { type AuthModel } from 'pocketbase'
import { pb } from '@/lib/auth-utils'

interface PocketBaseState {
    user: AuthModel | null
    isAuthenticated: boolean
    setAuth: (user: AuthModel | null, isAuthenticated: boolean) => void
    clearAuth: () => void
    initializeAuth: () => void
}

export const usePocketBaseStore = create<PocketBaseState>((set) => {
    const store = {
        user: pb.authStore.model,
        isAuthenticated: pb.authStore.isValid,

        setAuth: (user: AuthModel | null, isAuthenticated: boolean) => {
            set({ user, isAuthenticated })
        },

        clearAuth: () => {
            set({ user: null, isAuthenticated: false })
        },

        initializeAuth: () => {
            const isValid = pb.authStore.isValid
            const user = pb.authStore.model
            set({ user, isAuthenticated: isValid })
        }
    }

    // Initialize on creation
    store.initializeAuth()

    return store
})
