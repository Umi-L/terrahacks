import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { usePocketBaseStore } from '@/stores/pocketbase-store'
import { authUtils } from '@/lib/auth-utils'
import Navbar from '@/components/Navbar'

export const Route = createFileRoute('/profile')({
    component: Profile,
})

function Profile() {
    const pocketBaseStore = usePocketBaseStore()
    const { user, isAuthenticated } = pocketBaseStore
    const navigate = useNavigate()

    useEffect(() => {
        // Check authentication on component mount
        const isAuth = authUtils.checkAuth()
        if (!isAuth) {
            navigate({ to: '/login' })
        } else {
            // Update store with current auth state
            pocketBaseStore.initializeAuth()
        }
    }, [navigate])

    const handleLogout = () => {
        authUtils.logout()
        pocketBaseStore.clearAuth()
        navigate({ to: '/' })
    }

    if (!isAuthenticated || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            <Navbar />

            <div className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-foreground mb-2">
                            Welcome, {user?.name || user?.email || 'User'}!
                        </h1>
                        <p className="text-muted-foreground">
                            Manage your account and preferences
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Account Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                                    <p className="text-foreground">{user?.email}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Name</p>
                                    <p className="text-foreground">{user?.name || 'Not provided'}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">User ID</p>
                                    <p className="text-foreground font-mono text-sm">{user?.id}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Account Created</p>
                                    <p className="text-foreground">
                                        {user?.created ? new Date(user.created).toLocaleDateString() : 'Unknown'}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Quick Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-muted-foreground mb-4">
                                    You are successfully authenticated! This is your secure dashboard area.
                                </p>
                                <div className="space-y-2">
                                    <Button variant="outline" className="w-full justify-start">
                                        Edit Profile
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start">
                                        Change Password
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start">
                                        View Activity
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-red-600 hover:text-red-700"
                                        onClick={handleLogout}
                                    >
                                        Logout
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
