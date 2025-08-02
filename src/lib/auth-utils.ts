import PocketBase from 'pocketbase'

// Create a singleton PocketBase instance
export const pb = new PocketBase('http://192.168.0.131:8090')

export const authUtils = {
    login: async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            await pb.collection('users').authWithPassword(email, password)
            return { success: true }
        } catch (error: any) {
            console.error('Login failed:', error)
            let errorMessage = 'Login failed. Please try again.'

            // Handle specific PocketBase errors
            if (error?.status === 400) {
                errorMessage = 'Invalid email or password.'
            } else if (error?.data?.message) {
                errorMessage = error.data.message
            }

            return { success: false, error: errorMessage }
        }
    },

    signup: async (email: string, password: string, passwordConfirm: string, name?: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const data = {
                email,
                password,
                passwordConfirm,
                name: name || email.split('@')[0], // Use email prefix as default name
            }

            // Create the user
            await pb.collection('users').create(data)

            // Then login automatically
            await pb.collection('users').authWithPassword(email, password)

            // // Optional: Request email verification
            // try {
            //     await pb.collection('users').requestVerification(email)
            // } catch (verificationError) {
            //     console.warn('Email verification request failed:', verificationError)
            //     // Don't fail the signup if verification request fails
            // }

            return { success: true }
        } catch (error: any) {
            console.error('Signup failed:', error)
            let errorMessage = 'Failed to create account. Please try again.'

            // Handle specific PocketBase errors
            if (error?.status === 400) {
                if (error?.data?.email?.message) {
                    errorMessage = `Email: ${error.data.email.message}`
                } else if (error?.data?.password?.message) {
                    errorMessage = `Password: ${error.data.password.message}`
                } else if (error?.data?.message) {
                    errorMessage = error.data.message
                }
            } else if (error?.data?.message) {
                errorMessage = error.data.message
            }

            return { success: false, error: errorMessage }
        }
    },

    logout: (): void => {
        pb.authStore.clear()
    },

    checkAuth: (): boolean => {
        return pb.authStore.isValid
    },

    getCurrentUser: () => {
        return pb.authStore.model
    }
}
