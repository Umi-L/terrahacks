import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { usePocketBaseStore } from '@/stores/pocketbase-store'
import { authUtils } from '@/lib/auth-utils'

export function useAuthGuard(redirectTo: string = '/login') {
    const pocketBaseStore = usePocketBaseStore()
    const { isAuthenticated } = pocketBaseStore
    const navigate = useNavigate()

    useEffect(() => {
        const isAuth = authUtils.checkAuth()
        if (!isAuth) {
            navigate({ to: redirectTo })
        } else {
            // Update store with current auth state
            pocketBaseStore.initializeAuth()
        }
    }, [navigate, redirectTo])

    return isAuthenticated
}

export function useAuthRedirect(redirectTo: string = '/dashboard') {
    const pocketBaseStore = usePocketBaseStore()
    const { isAuthenticated } = pocketBaseStore
    const navigate = useNavigate()

    useEffect(() => {
        const isAuth = authUtils.checkAuth()
        if (isAuth) {
            navigate({ to: redirectTo })
        } else {
            // Update store with current auth state
            pocketBaseStore.initializeAuth()
        }
    }, [navigate, redirectTo])

    return !isAuthenticated
}
