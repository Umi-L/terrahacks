import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Navbar from '../components/Navbar'
import { usePocketBaseStore } from '@/stores/pocketbase-store'

export const Route = createFileRoute('/')({
    component: Index,
})

function Index() {
    const navigate = useNavigate()
    const { isAuthenticated } = usePocketBaseStore()

    const handleGetStarted = () => {
        if (isAuthenticated) {
            // User is authenticated, redirect to dashboard or main app
            navigate({ to: '/dashboard' })
        } else {
            // User is not authenticated, redirect to login
            navigate({ to: '/login' })
        }
    }

    return (
        <>
            <Navbar />
            <section
                className="relative flex flex-col w-full px-4 py-16 md:py-28 items-center justify-center bg-[var(--background)]"
                style={{ position: 'relative', overflow: 'hidden' }}
            >
                {/* Blurred grid background */}
                <div
                    aria-hidden="true"
                    style={{
                        pointerEvents: 'none',
                        position: 'absolute',
                        inset: 0,
                        zIndex: 0,
                        filter: 'blur(1.5px)',
                        WebkitFilter: 'blur(1.5px)',
                        backgroundImage: `
                        linear-gradient(to right, var(--card) 1px, transparent 1px),
                        linear-gradient(to bottom, var(--card) 1px, transparent 1px)
                    `,
                        backgroundSize: '40px 40px',
                        backgroundPosition: '0 0',
                    }}
                />
                {/* Logo */}
                <div className="z-10 flex flex-col items-center mb-8">
                    <div className="rounded-xl bg-[var(--card)] shadow p-4 mb-6">
                        <img src="/MedicalMole.svg" alt="Logo" className="w-16 h-16 object-contain" />
                    </div>
                    <h1
                        className="text-5xl sm:text-6xl lg:text-7xl font-extrabold mb-6 tracking-tight leading-tight text-center"
                        style={{ color: 'var(--foreground)' }}
                    >
                        Medical <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Mole</span>
                    </h1>
                    <p className="text-2xl mb-10 max-w-2xl text-center" style={{ color: 'var(--muted-foreground)' }}>
                        Track your symptoms, get instant AI-powered health insights, and take control of your wellbeing. Medical Mole helps you log daily symptoms, visualize trends, and chat with an AI assistant for personalized advice.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 mb-16 w-full sm:w-auto justify-center">
                        <Button
                            size="lg"
                            className="text-xl px-10 py-7 w-full sm:w-auto"
                            onClick={handleGetStarted}
                        >
                            Get Started
                        </Button>
                        <Button variant="outline" size="lg" className="text-xl px-10 py-7 w-full sm:w-auto flex items-center gap-2">
                            Learn more
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L21 10.5m0 0l-3.75 3.75M21 10.5H3" />
                            </svg>
                        </Button>
                    </div>
                </div>

                {/* Tech stack/info row */}
                <div className="z-10 flex flex-col items-center mt-8">
                    <span className="text-lg mb-4" style={{ color: 'var(--muted-foreground)' }}>Built with open-source technologies</span>
                    <div className="flex flex-row gap-4">
                        <div className="rounded-lg bg-[var(--card)] shadow p-3 flex items-center justify-center">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--foreground)]"><path d="M16 3h5v5" /><path d="M8 21H3v-5" /><rect width="14" height="14" x="5" y="5" rx="2" /></svg>
                        </div>
                        <div className="rounded-lg bg-[var(--card)] shadow p-3 flex items-center justify-center">
                            <span className="text-xl font-bold text-[var(--foreground)]">TS</span>
                        </div>
                        <div className="rounded-lg bg-[var(--card)] shadow p-3 flex items-center justify-center">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--foreground)]"><circle cx="12" cy="12" r="10" /><path d="M8 12h.01" /><path d="M16 12h.01" /><path d="M12 16h.01" /></svg>
                        </div>
                        <div className="rounded-lg bg-[var(--card)] shadow p-3 flex items-center justify-center">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--foreground)]"><path d="M4 4h16v16H4z" /><path d="M9 9h6v6H9z" /></svg>
                        </div>
                    </div>
                </div>
            </section>
        </>
    )
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
    return (
        <div
            className="rounded-xl border p-6 shadow-sm flex flex-col items-center"
            style={{
                background: 'rgba(var(--card), 0.85)',
                borderColor: 'var(--border)',
            }}
        >
            <div className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>{title}</div>
            <div className="text-center" style={{ color: 'var(--muted-foreground)' }}>{desc}</div>
        </div>
    )
}