import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePocketBaseStore } from '@/stores/pocketbase-store'
import { authUtils, pb } from '@/lib/auth-utils'
import Navbar from '@/components/Navbar'

export const Route = createFileRoute('/signup')({
    component: Signup,
})

function Signup() {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        passwordConfirm: '',
        name: ''
    })
    const [isLoading, setIsLoading] = useState(false)
    const [errors, setErrors] = useState({
        email: '',
        password: '',
        passwordConfirm: '',
        general: ''
    })

    const pocketBaseStore = usePocketBaseStore()
    const navigate = useNavigate()

    const validateForm = () => {
        const newErrors = {
            email: '',
            password: '',
            passwordConfirm: '',
            general: ''
        }

        if (!formData.email) {
            newErrors.email = 'Email is required'
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email is invalid'
        }

        if (!formData.password) {
            newErrors.password = 'Password is required'
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters long'
        }

        if (!formData.passwordConfirm) {
            newErrors.passwordConfirm = 'Password confirmation is required'
        } else if (formData.password !== formData.passwordConfirm) {
            newErrors.passwordConfirm = 'Passwords do not match'
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
            const result = await authUtils.signup(
                formData.email,
                formData.password,
                formData.passwordConfirm,
                formData.name || undefined
            )

            if (result.success) {
                // Update the store with the new auth state
                pocketBaseStore.setAuth(pb.authStore.model, true)
                // Redirect to settings for new users to complete required information
                navigate({ to: '/settings' })
            } else {
                setErrors(prev => ({
                    ...prev,
                    general: result.error || 'Failed to create account. Please try again.'
                }))
            }
        } catch (error) {
            console.error('Registration error:', error)
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
                        <CardTitle className="text-2xl text-center">Create account</CardTitle>
                        <p className="text-center text-sm text-muted-foreground">
                            Enter your details to create your account
                        </p>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name (optional)</Label>
                                <Input
                                    id="name"
                                    type="text"
                                    placeholder="Your name"
                                    value={formData.name}
                                    onChange={handleInputChange('name')}
                                    disabled={isLoading}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
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
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="At least 8 characters"
                                    value={formData.password}
                                    onChange={handleInputChange('password')}
                                    disabled={isLoading}
                                    className={errors.password ? 'border-red-500' : ''}
                                />
                                {errors.password && (
                                    <p className="text-sm text-red-500">{errors.password}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="passwordConfirm">Confirm Password</Label>
                                <Input
                                    id="passwordConfirm"
                                    type="password"
                                    placeholder="Confirm your password"
                                    value={formData.passwordConfirm}
                                    onChange={handleInputChange('passwordConfirm')}
                                    disabled={isLoading}
                                    className={errors.passwordConfirm ? 'border-red-500' : ''}
                                />
                                {errors.passwordConfirm && (
                                    <p className="text-sm text-red-500">{errors.passwordConfirm}</p>
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
                                {isLoading ? 'Creating account...' : 'Create account'}
                            </Button>
                        </form>

                        <div className="mt-4 text-center text-sm">
                            Already have an account?{' '}
                            <Link to="/login" className="underline hover:text-primary">
                                Sign in
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
