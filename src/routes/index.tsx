import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FaReact } from 'react-icons/fa'
import { SiPocketbase, SiPytorch, SiShadcnui, SiFramer } from 'react-icons/si'
import { Button } from "@/components/ui/button"
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar'
import { usePocketBaseStore } from '@/stores/pocketbase-store'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/')({
    component: Index,
})

function Index() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { isAuthenticated } = usePocketBaseStore()

    const handleGetStarted = () => {
        if (isAuthenticated) {
            // User is authenticated, redirect to dashboard or main app
            navigate({ to: '/home' })
        } else {
            // User is not authenticated, redirect to login
            navigate({ to: '/login' })
        }
    }

    return (
        <>
            <Navbar />
            <motion.section
                className="relative flex flex-col w-full px-4 py-16 md:py-28 items-center justify-center bg-[var(--background)]"
                style={{ position: 'relative', overflow: 'hidden' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
            >
                {/* Blurred grid background */}
                <motion.div
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
                    animate={{
                        backgroundPosition: ['0 0', '40px 40px', '0 0'],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                />
                {/* Logo */}
                <motion.div
                    className="z-10 flex flex-col items-center mb-8"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                >
                    <motion.div
                        className="rounded-xl bg-[var(--card)] shadow p-4 mb-6"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{
                            duration: 0.8,
                            delay: 0.4,
                            type: "spring",
                            stiffness: 200
                        }}
                        whileHover={{
                            scale: 1.1,
                            rotate: 5,
                            transition: { duration: 0.2 }
                        }}
                    >
                        <motion.img
                            src="/MedicalMole.svg"
                            alt="Logo"
                            className="w-16 h-16 object-contain"
                            animate={{
                                y: [0, -2, 0],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        />
                    </motion.div>
                    <motion.h1
                        className="text-5xl sm:text-6xl lg:text-7xl font-extrabold mb-6 tracking-tight leading-tight text-center"
                        style={{ color: 'var(--foreground)' }}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                    >
                        {t('index.title').split(' ')[0]} <motion.span
                            style={{ color: 'var(--primary)', fontWeight: 'bold' }}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.8 }}
                            whileHover={{
                                scale: 1.05,
                                transition: { duration: 0.2 }
                            }}
                        >
                            {t('index.title').split(' ')[1]}
                        </motion.span>
                    </motion.h1>
                    <motion.p
                        className="text-2xl mb-10 max-w-2xl text-center"
                        style={{ color: 'var(--muted-foreground)' }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.9 }}
                    >
                        {t('index.subtitle')}
                    </motion.p>
                    <motion.div
                        className="flex flex-col sm:flex-row gap-4 mb-16 w-full sm:w-auto justify-center"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 1.1 }}
                    >
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: 1.3 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Button
                                size="lg"
                                className="text-xl px-10 py-7 w-full sm:w-auto"
                                onClick={handleGetStarted}
                            >
                                {t('index.getStarted')}
                            </Button>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: 1.4 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Button variant="outline" size="lg" className="text-xl px-10 py-7 w-full sm:w-auto flex items-center gap-2">
                                {t('index.learnMore')}
                                <motion.svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth="1.5"
                                    stroke="currentColor"
                                    className="w-5 h-5"
                                    animate={{ x: [0, 3, 0] }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L21 10.5m0 0l-3.75 3.75M21 10.5H3" />
                                </motion.svg>
                            </Button>
                        </motion.div>
                    </motion.div>
                </motion.div>

                {/* Tech stack/info row */}
                <motion.div
                    className="z-10 flex flex-col items-center mt-8"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1.6 }}
                >
                    <motion.span
                        className="text-lg mb-4"
                        style={{ color: 'var(--muted-foreground)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 1.8 }}
                    >
                        {t('index.builtWith')}
                    </motion.span>
                    <motion.div
                        className="flex flex-row gap-4"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 2.0 }}
                    >
                        {/* React */}
                        <a href="https://react.dev/" target="_blank" rel="noopener noreferrer" title="React">
                            <motion.div
                                className="rounded-lg bg-[var(--card)] shadow p-3 flex items-center justify-center"
                                animate={{ y: [0, -3, 0], rotate: [0, 8, 0, -8, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
                                whileHover={{ scale: 1.1, rotate: 10, transition: { duration: 0.2 } }}
                            >
                                <FaReact size={28} color="#61DAFB" />
                            </motion.div>
                        </a>
                        {/* PocketBase */}
                        <a href="https://pocketbase.io/" target="_blank" rel="noopener noreferrer" title="PocketBase">
                            <motion.div
                                className="rounded-lg bg-[var(--card)] shadow p-3 flex items-center justify-center"
                                animate={{ y: [0, -4, 0], rotate: [0, -6, 0, 6, 0] }}
                                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                                whileHover={{ scale: 1.1, rotate: -10, transition: { duration: 0.2 } }}
                            >
                                <SiPocketbase size={28} color="#F9A826" />
                            </motion.div>
                        </a>
                        {/* PyTorch */}
                        <a href="https://pytorch.org/" target="_blank" rel="noopener noreferrer" title="PyTorch">
                            <motion.div
                                className="rounded-lg bg-[var(--card)] shadow p-3 flex items-center justify-center"
                                animate={{ y: [0, -2, 0], rotate: [0, 4, 0, -4, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                                whileHover={{ scale: 1.1, rotate: 8, transition: { duration: 0.2 } }}
                            >
                                <SiPytorch size={28} color="#EE4C2C" />
                            </motion.div>
                        </a>
                        {/* Shadcn */}
                        <a href="https://ui.shadcn.com/" target="_blank" rel="noopener noreferrer" title="Shadcn UI">
                            <motion.div
                                className="rounded-lg bg-[var(--card)] shadow p-3 flex items-center justify-center"
                                animate={{ y: [0, -5, 0], rotate: [0, -8, 0, 8, 0] }}
                                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
                                whileHover={{ scale: 1.1, rotate: -12, transition: { duration: 0.2 } }}
                            >
                                <SiShadcnui size={28} color="#6366F1" />
                            </motion.div>
                        </a>
                        {/* Framer Motion */}
                        <a href="https://www.framer.com/motion/" target="_blank" rel="noopener noreferrer" title="Framer Motion">
                            <motion.div
                                className="rounded-lg bg-[var(--card)] shadow p-3 flex items-center justify-center"
                                animate={{ y: [0, -6, 0], rotate: [0, 10, 0, -10, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.9 }}
                                whileHover={{ scale: 1.1, rotate: 14, transition: { duration: 0.2 } }}
                            >
                                <SiFramer size={28} color="#0055FF" />
                            </motion.div>
                        </a>
                    </motion.div>
                </motion.div>
            </motion.section>
        </>
    )
}