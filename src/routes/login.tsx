import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePocketBaseStore } from '@/stores/pocketbase-store'
import { authUtils, pb } from '@/lib/auth-utils'
import Navbar from '@/components/Navbar'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/login')({
    component: Login,
})

function Login() {
    const { t } = useTranslation()
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    })
    const [isLoading, setIsLoading] = useState(false)
    const [errors, setErrors] = useState({
        email: '',
        password: '',
        general: ''
    })

    const pocketBaseStore = usePocketBaseStore()
    const navigate = useNavigate()

    const validateForm = () => {
        const newErrors = {
            email: '',
            password: '',
            general: ''
        }

        if (!formData.email) {
            newErrors.email = t('auth.email') + ' is required'
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = t('auth.email') + ' is invalid'
        }

        if (!formData.password) {
            newErrors.password = t('auth.password') + ' is required'
        }

        setErrors(newErrors)
        return !Object.values(newErrors).some(error => error !== '')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateForm()) {
            return
        }

        setIsLoading(true)
        setErrors(prev => ({ ...prev, general: '' }))

        try {
            const result = await authUtils.login(formData.email, formData.password)

            if (result.success) {
                // Update the store with the new auth state
                pocketBaseStore.setAuth(pb.authStore.model, true)
                // Redirect to home after successful login
                navigate({ to: '/home' })
            } else {
                setErrors(prev => ({
                    ...prev,
                    general: result.error || 'Login failed. Please try again.'
                }))
            }
        } catch (error) {
            console.error('Login error:', error)
            setErrors(prev => ({
                ...prev,
                general: 'An unexpected error occurred. Please try again.'
            }))
        }

        setIsLoading(false)
    }

    const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [field]: e.target.value }))
        // Clear error when user starts typing
        if (errors[field as keyof typeof errors]) {
            setErrors(prev => ({ ...prev, [field]: '' }))
        }
    }

    return (
        <div className="min-h-screen bg-background">
            <Navbar />

            <div className="flex items-center justify-center px-4 py-12">
                <Card className="w-full max-w-md">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl text-center">{t('auth.login')}</CardTitle>
                        <p className="text-center text-sm text-muted-foreground">
                            {t('auth.email')} and {t('auth.password')} to sign in
                        </p>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">{t('auth.email')}</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={formData.email}
                                    onChange={handleInputChange('email')}
                                    disabled={isLoading}
                                    className={errors.email ? 'border-red-500' : ''}
                                />
                                {errors.email && (
                                    <p className="text-sm text-red-500">{errors.email}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">{t('auth.password')}</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder={t('auth.password')}
                                    value={formData.password}
                                    onChange={handleInputChange('password')}
                                    disabled={isLoading}
                                    className={errors.password ? 'border-red-500' : ''}
                                />
                                {errors.password && (
                                    <p className="text-sm text-red-500">{errors.password}</p>
                                )}
                            </div>

                            {errors.general && (
                                <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
                                    {errors.general}
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Signing in...' : t('auth.loginButton')}
                            </Button>
                        </form>

                        <div className="mt-4 text-center text-sm">
                            {t('auth.dontHaveAccount')}{' '}
                            <Link to="/signup" className="underline hover:text-primary">
                                {t('auth.signup')}
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
