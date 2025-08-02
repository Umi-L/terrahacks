import { createFileRoute } from '@tanstack/react-router'
import Navbar from '@/components/Navbar'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/about')({
    component: About,
})

function About() {
    const { t } = useTranslation()

    return (
        <div className="min-h-screen bg-background">
            <Navbar />

            <div className="container mx-auto px-4 py-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-foreground mb-4">
                            {t('about.title')}
                        </h1>
                        <p className="text-xl text-muted-foreground">
                            {t('about.subtitle')}
                        </p>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('about.ourMission')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground leading-relaxed">
                                {t('about.missionText')}
                            </p>
                        </CardContent>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('about.whatWeTrack')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-muted-foreground">
                                    <li>• {t('about.trackingItems.carbon')}</li>
                                    <li>• {t('about.trackingItems.water')}</li>
                                    <li>• {t('about.trackingItems.energy')}</li>
                                    <li>• {t('about.trackingItems.waste')}</li>
                                    <li>• {t('about.trackingItems.air')}</li>
                                    <li>• {t('about.trackingItems.biodiversity')}</li>
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t('about.technology')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground leading-relaxed">
                                    {t('about.technologyText')}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}