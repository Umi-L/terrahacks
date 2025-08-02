import { createFileRoute } from '@tanstack/react-router'
import Navbar from '@/components/Navbar'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute('/about')({
    component: About,
})

function About() {
    return (
        <div className="min-h-screen bg-background">
            <Navbar />

            <div className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-foreground mb-4">
                            About Our Platform
                        </h1>
                        <p className="text-xl text-muted-foreground">
                            Empowering sustainable decisions through comprehensive environmental data
                        </p>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Our Mission</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground leading-relaxed">
                                We are dedicated to providing accurate, real-time environmental data
                                and insights to help individuals, businesses, and communities make
                                informed decisions for a sustainable future. Our platform aggregates
                                data from multiple sources to present comprehensive ECO health reports.
                            </p>
                        </CardContent>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>What We Track</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-muted-foreground">
                                    <li>• Carbon footprint and emissions</li>
                                    <li>• Water usage and quality</li>
                                    <li>• Renewable energy adoption</li>
                                    <li>• Waste management and recycling</li>
                                    <li>• Air quality indices</li>
                                    <li>• Biodiversity measurements</li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Technology</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground leading-relaxed">
                                    Built with modern web technologies including React, TypeScript,
                                    and real-time data processing to ensure you have access to the
                                    most current environmental information available.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}