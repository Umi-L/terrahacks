import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePocketBaseStore } from '@/stores/pocketbase-store'
import { authUtils, pb } from '@/lib/auth-utils'
import Navbar from '@/components/Navbar'
import { motion } from 'framer-motion'
import { Download, Trash2, AlertTriangle, User, Hospital } from 'lucide-react'

export const Route = createFileRoute('/settings')({
    component: Settings,
})

function Settings() {
    const pocketBaseStore = usePocketBaseStore()
    const { user, isAuthenticated } = pocketBaseStore
    const navigate = useNavigate()

    const [healthcareProvider, setHealthcareProvider] = useState({
        name: '',
        phone: '',
        email: '',
        address: ''
    })

    const [userInfo, setUserInfo] = useState({
        age: '',
        gender: ''
    })

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showWipeConfirm, setShowWipeConfirm] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isSavingUserInfo, setIsSavingUserInfo] = useState(false)
    const [lastSaveTime, setLastSaveTime] = useState(0)

    useEffect(() => {
        let isMounted = true // Flag to prevent state updates after unmount

        const initializeSettings = async () => {
            // Check authentication on component mount
            const isAuth = authUtils.checkAuth()
            if (!isAuth) {
                if (isMounted) {
                    navigate({ to: '/login' })
                }
                return
            }

            try {
                if (isMounted) {
                    // Update store with current auth state
                    pocketBaseStore.initializeAuth()

                    // Add a small delay to prevent React StrictMode double-mounting issues
                    await new Promise(resolve => setTimeout(resolve, 100))

                    // Only proceed if component is still mounted
                    if (!isMounted) return

                    await loadHealthcareProvider(isMounted)
                    await loadUserInfo(isMounted)

                    // Check if this is a new user (no user_info) and show welcome message
                    await checkIfNewUser(isMounted)
                }
            } catch (error) {
                if (isMounted) {
                    console.log('Error initializing settings:', error)
                }
            }
        }

        initializeSettings()

        // Cleanup function
        return () => {
            isMounted = false
        }
    }, [navigate])

    const checkIfNewUser = async (isMounted: boolean = true) => {
        try {
            if (user?.id && isMounted) {
                const records = await pb.collection('user_info').getList(1, 1, {
                    filter: `user_id = "${user.id}"`
                })
                if (records.items.length === 0 && isMounted) {
                    // New user - show welcome message
                    setTimeout(() => {
                        if (isMounted) {
                            alert('Welcome to Medical Mole! Please complete your user information below to get started with personalized health insights.')
                        }
                    }, 1000)
                }
            }
        } catch (error) {
            if (isMounted) {
                console.log('Error checking user status:', error)
            }
        }
    }

    const loadUserInfo = async (isMounted: boolean = true) => {
        try {
            if (user?.id && isMounted) {
                // Try to load existing user info
                const records = await pb.collection('user_info').getList(1, 1, {
                    filter: `user_id = "${user.id}"`
                })
                if (records.items.length > 0 && isMounted) {
                    const info = records.items[0]
                    setUserInfo({
                        age: info.age?.toString() || '',
                        gender: info.gender || ''
                    })
                }
            }
        } catch (error: any) {
            if (isMounted && !error?.message?.includes('autocancelled')) {
                console.log('No user info found or error loading:', error)
            }
        }
    }

    const loadHealthcareProvider = async (isMounted: boolean = true) => {
        try {
            if (user?.id && isMounted) {
                // Try to load existing healthcare provider info
                const records = await pb.collection('healthcare_providers').getList(1, 1, {
                    filter: `user_id = "${user.id}"`
                })
                if (records.items.length > 0 && isMounted) {
                    const provider = records.items[0]
                    setHealthcareProvider({
                        name: provider.name || '',
                        phone: provider.phone || '',
                        email: provider.email || '',
                        address: provider.address || ''
                    })
                }
            }
        } catch (error: any) {
            if (isMounted && !error?.message?.includes('autocancelled')) {
                console.log('No healthcare provider found or error loading:', error)
            }
        }
    }

    const saveUserInfo = async () => {
        // Prevent rapid successive saves
        const now = Date.now()
        if (now - lastSaveTime < 1000) {
            return
        }
        setLastSaveTime(now)

        try {
            setIsSavingUserInfo(true)
            if (user?.id) {
                // Validate required fields
                if (!userInfo.age || !userInfo.gender) {
                    alert('Age and gender are required fields.')
                    return
                }

                // Check if record exists
                const records = await pb.collection('user_info').getList(1, 1, {
                    filter: `user_id = "${user.id}"`
                })

                const data = {
                    user_id: user.id,
                    age: parseInt(userInfo.age),
                    gender: userInfo.gender
                }

                if (records.items.length > 0) {
                    // Update existing record
                    await pb.collection('user_info').update(records.items[0].id, data)
                } else {
                    // Create new record
                    await pb.collection('user_info').create(data)
                }

                alert('User information saved successfully!')
            }
        } catch (error: any) {
            if (!error?.message?.includes('autocancelled') && !error?.isAbort) {
                console.error('Error saving user info:', error)
                // Check for specific PocketBase errors
                if (error?.status === 400) {
                    alert('Invalid data provided. Please check your input and try again.')
                } else if (error?.status === 403) {
                    alert('Permission denied. Please refresh the page and try again.')
                } else {
                    alert('Error saving user information. Please try again.')
                }
            }
        } finally {
            setIsSavingUserInfo(false)
        }
    }

    const saveHealthcareProvider = async () => {
        // Prevent rapid successive saves
        const now = Date.now()
        if (now - lastSaveTime < 1000) {
            return
        }
        setLastSaveTime(now)

        try {
            setIsLoading(true)
            if (user?.id) {
                // Check if record exists
                const records = await pb.collection('healthcare_providers').getList(1, 1, {
                    filter: `user_id = "${user.id}"`
                })

                const data = {
                    user_id: user.id,
                    name: healthcareProvider.name,
                    phone: healthcareProvider.phone,
                    email: healthcareProvider.email,
                    address: healthcareProvider.address
                }

                if (records.items.length > 0) {
                    // Update existing record
                    await pb.collection('healthcare_providers').update(records.items[0].id, data)
                } else {
                    // Create new record
                    await pb.collection('healthcare_providers').create(data)
                }

                alert('Healthcare provider information saved successfully!')
            }
        } catch (error: any) {
            if (!error?.message?.includes('autocancelled') && !error?.isAbort) {
                console.error('Error saving healthcare provider:', error)
                // Check for specific PocketBase errors
                if (error?.status === 400) {
                    alert('Invalid data provided. Please check your input and try again.')
                } else if (error?.status === 403) {
                    alert('Permission denied. Please refresh the page and try again.')
                } else {
                    alert('Error saving healthcare provider information. Please try again.')
                }
            }
        } finally {
            setIsLoading(false)
        }
    }

    const exportData = async () => {
        try {
            setIsLoading(true)
            if (user?.id) {
                // Get all user's health events
                const events = await pb.collection('health_events').getList(1, 1000, {
                    filter: `user_id = "${user.id}"`,
                    sort: '-date'
                })

                // Get healthcare provider info
                const providers = await pb.collection('healthcare_providers').getList(1, 1, {
                    filter: `user_id = "${user.id}"`
                })

                const exportData = {
                    user: {
                        name: user.name,
                        email: user.email
                    },
                    healthcareProvider: providers.items.length > 0 ? providers.items[0] : null,
                    healthEvents: events.items,
                    exportDate: new Date().toISOString(),
                    summary: {
                        totalEvents: events.items.length,
                        dateRange: events.items.length > 0 ? {
                            from: events.items[events.items.length - 1].date,
                            to: events.items[0].date
                        } : null
                    }
                }

                // Create and download file
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `medical-mole-data-${new Date().toISOString().split('T')[0]}.json`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
            }
        } catch (error: any) {
            if (!error?.message?.includes('autocancelled')) {
                console.error('Error exporting data:', error)
                alert('Error exporting data. Please try again.')
            }
        } finally {
            setIsLoading(false)
        }
    }

    const wipeData = async () => {
        try {
            setIsLoading(true)
            if (user?.id) {
                // Delete all health events
                const events = await pb.collection('health_events').getList(1, 1000, {
                    filter: `user_id = "${user.id}"`
                })

                for (const event of events.items) {
                    await pb.collection('health_events').delete(event.id)
                }

                // Delete healthcare provider info
                const providers = await pb.collection('healthcare_providers').getList(1, 1, {
                    filter: `user_id = "${user.id}"`
                })

                for (const provider of providers.items) {
                    await pb.collection('healthcare_providers').delete(provider.id)
                }

                // Delete user info
                const userInfoRecords = await pb.collection('user_info').getList(1, 1, {
                    filter: `user_id = "${user.id}"`
                })

                for (const info of userInfoRecords.items) {
                    await pb.collection('user_info').delete(info.id)
                }

                setHealthcareProvider({ name: '', phone: '', email: '', address: '' })
                setUserInfo({ age: '', gender: '' })
                alert('All data has been wiped successfully!')
            }
        } catch (error: any) {
            if (!error?.message?.includes('autocancelled')) {
                console.error('Error wiping data:', error)
                alert('Error wiping data. Please try again.')
            }
        } finally {
            setIsLoading(false)
            setShowWipeConfirm(false)
        }
    }

    const deleteAccount = async () => {
        try {
            setIsLoading(true)
            if (user?.id) {
                // First wipe all data
                await wipeData()

                // Then delete the user account
                await pb.collection('users').delete(user.id)

                // Logout and redirect
                authUtils.logout()
                pocketBaseStore.clearAuth()
                navigate({ to: '/' })
            }
        } catch (error: any) {
            if (!error?.message?.includes('autocancelled')) {
                console.error('Error deleting account:', error)
                alert('Error deleting account. Please try again.')
            }
        } finally {
            setIsLoading(false)
            setShowDeleteConfirm(false)
        }
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

            <motion.div
                className="container mx-auto px-4 py-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="max-w-4xl mx-auto">
                    <motion.div
                        className="mb-8"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
                        <p className="text-muted-foreground">Manage your account and healthcare information</p>
                    </motion.div>

                    <div className="grid gap-6">
                        {/* User Information */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                        >
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <User className="w-5 h-5" />
                                        User Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="user-age">Age *</Label>
                                            <Input
                                                id="user-age"
                                                type="number"
                                                min="0"
                                                max="120"
                                                value={userInfo.age}
                                                onChange={(e) => setUserInfo(prev => ({ ...prev, age: e.target.value }))}
                                                placeholder="25"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="user-gender">Gender *</Label>
                                            <select
                                                id="user-gender"
                                                value={userInfo.gender}
                                                onChange={(e) => setUserInfo(prev => ({ ...prev, gender: e.target.value }))}
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                required
                                            >
                                                <option value="">Select gender</option>
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        * Required fields for personalized health insights
                                    </p>
                                    <Button onClick={saveUserInfo} disabled={isSavingUserInfo}>
                                        {isSavingUserInfo ? 'Saving...' : 'Save User Information'}
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Healthcare Provider Information */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                        >
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Hospital className="w-5 h-5" />
                                        Healthcare Provider Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="provider-name">Provider Name</Label>
                                            <Input
                                                id="provider-name"
                                                value={healthcareProvider.name}
                                                onChange={(e) => setHealthcareProvider(prev => ({ ...prev, name: e.target.value }))}
                                                placeholder="Dr. Smith or City Hospital"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="provider-phone">Phone Number</Label>
                                            <Input
                                                id="provider-phone"
                                                value={healthcareProvider.phone}
                                                onChange={(e) => setHealthcareProvider(prev => ({ ...prev, phone: e.target.value }))}
                                                placeholder="(555) 123-4567"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="provider-email">Email</Label>
                                            <Input
                                                id="provider-email"
                                                type="email"
                                                value={healthcareProvider.email}
                                                onChange={(e) => setHealthcareProvider(prev => ({ ...prev, email: e.target.value }))}
                                                placeholder="provider@example.com"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="provider-address">Address</Label>
                                            <Input
                                                id="provider-address"
                                                value={healthcareProvider.address}
                                                onChange={(e) => setHealthcareProvider(prev => ({ ...prev, address: e.target.value }))}
                                                placeholder="123 Medical St, City, State"
                                            />
                                        </div>
                                    </div>
                                    <Button onClick={saveHealthcareProvider} disabled={isLoading}>
                                        {isLoading ? 'Saving...' : 'Save Provider Information'}
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Data Management */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                        >
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Download className="w-5 h-5" />
                                        Data Management
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <h3 className="font-semibold mb-2">Export Your Data</h3>
                                        <p className="text-sm text-muted-foreground mb-3">
                                            Download all your health data in a readable format that you can share with healthcare providers.
                                        </p>
                                        <Button variant="outline" onClick={exportData} disabled={isLoading}>
                                            <Download className="w-4 h-4 mr-2" />
                                            {isLoading ? 'Exporting...' : 'Export Data'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Danger Zone */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.5 }}
                        >
                            <Card className="border-red-200">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-red-600">
                                        <AlertTriangle className="w-5 h-5" />
                                        Danger Zone
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <h3 className="font-semibold mb-2">Wipe All Data</h3>
                                        <p className="text-sm text-muted-foreground mb-3">
                                            Permanently delete all your health events and provider information. This cannot be undone.
                                        </p>
                                        {!showWipeConfirm ? (
                                            <Button variant="outline" onClick={() => setShowWipeConfirm(true)} className="text-red-600 border-red-300 hover:bg-red-50">
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Wipe All Data
                                            </Button>
                                        ) : (
                                            <div className="flex gap-2">
                                                <Button variant="destructive" onClick={wipeData} disabled={isLoading}>
                                                    {isLoading ? 'Wiping...' : 'Yes, Wipe All Data'}
                                                </Button>
                                                <Button variant="outline" onClick={() => setShowWipeConfirm(false)}>
                                                    Cancel
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t pt-4">
                                        <h3 className="font-semibold mb-2">Delete Account</h3>
                                        <p className="text-sm text-muted-foreground mb-3">
                                            Permanently delete your account and all associated data. This cannot be undone.
                                        </p>
                                        {!showDeleteConfirm ? (
                                            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                                                <User className="w-4 h-4 mr-2" />
                                                Delete Account
                                            </Button>
                                        ) : (
                                            <div className="flex gap-2">
                                                <Button variant="destructive" onClick={deleteAccount} disabled={isLoading}>
                                                    {isLoading ? 'Deleting...' : 'Yes, Delete Account'}
                                                </Button>
                                                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                                                    Cancel
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
