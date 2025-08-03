
import { Button } from "@/components/ui/button"
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Menu, Settings, LogOut, Languages } from 'lucide-react'
import { usePocketBaseStore } from '@/stores/pocketbase-store'
import { authUtils } from '@/lib/auth-utils'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'


export default function Navbar() {
    const pocketBaseStore = usePocketBaseStore();
    const navigate = useNavigate();
    const { isAuthenticated, user } = pocketBaseStore;
    const { t, i18n } = useTranslation();

    const handleLogout = () => {
        authUtils.logout();
        pocketBaseStore.clearAuth();
    };

    // Language picker functionality
    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
        localStorage.setItem('language', lng);
    };

    const currentLanguage = i18n.language || 'en';
    const languages = [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'ta', name: 'தமிழ்', flag: '🇮🇳' }
    ];

    // Desktop menu items
    const menu = [
        { title: t('nav.dashboard'), url: "/home" },
        // { title: t('nav.about'), url: "/about" },
    ];

    // Get user initials for profile picture
    const getUserInitials = () => {
        if (user?.name) {
            return user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
        }
        if (user?.email) {
            return user.email[0].toUpperCase();
        }
        return 'U';
    };

    return (
        <section className="py-4 border-b bg-background">
            <div className="container mx-auto">
                {/* Desktop Menu */}
                <nav className="hidden justify-between lg:flex w-full items-center">
                    <div className="flex items-center gap-6">
                        {/* Logo */}
                        <button onClick={() => navigate({ to: '/' })} className="flex items-center gap-2" type="button">
                            <span className="text-lg font-semibold tracking-tighter">Medical Mole</span>
                        </button>
                        <div className="flex items-center">
                            <NavigationMenu>
                                <NavigationMenuList>
                                    {menu.map((item) => (
                                        <NavigationMenuItem key={item.title}>
                                            <button
                                                type="button"
                                                onClick={() => navigate({ to: item.url })}
                                                className="bg-background hover:bg-muted hover:text-accent-foreground group inline-flex h-10 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
                                            >
                                                {item.title}
                                            </button>
                                        </NavigationMenuItem>
                                    ))}
                                </NavigationMenuList>
                            </NavigationMenu>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        {/* Language Picker */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="flex items-center gap-2">
                                    <Languages className="w-4 h-4" />
                                    <span className="hidden sm:inline">
                                        {languages.find(lang => lang.code === currentLanguage)?.flag}
                                    </span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2" align="end">
                                <div className="flex flex-col space-y-1">
                                    <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                                        {t('settings.language')}
                                    </div>
                                    <div className="h-px bg-border my-1"></div>
                                    {languages.map((language) => (
                                        <Button
                                            key={language.code}
                                            variant={currentLanguage === language.code ? "default" : "ghost"}
                                            size="sm"
                                            className="justify-start"
                                            onClick={() => changeLanguage(language.code)}
                                        >
                                            <span className="mr-2">{language.flag}</span>
                                            {language.name}
                                        </Button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>

                        {isAuthenticated ? (
                            <>
                                {/* <span className="text-sm text-muted-foreground mr-2">
                                    {user?.name || user?.email}
                                </span> */}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="lg" className="w-8 h-8 rounded-full p-0">
                                            <span className="text-xs font-semibold">
                                                {getUserInitials()}
                                            </span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 p-2" align="end">
                                        <div className="flex flex-col space-y-1">
                                            <div className="px-2 py-1.5 text-sm font-medium">
                                                {user?.name || user?.email}
                                            </div>
                                            <div className="h-px bg-border my-1"></div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="justify-start"
                                                onClick={() => navigate({ to: '/settings' })}
                                            >
                                                <Settings className="w-4 h-4 mr-2" />
                                                {t('nav.settings')}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="justify-start text-red-600 hover:text-red-700"
                                                onClick={handleLogout}
                                            >
                                                <LogOut className="w-4 h-4 mr-2" />
                                                {t('nav.logout')}
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" size="sm" onClick={() => navigate({ to: '/login' })}>
                                    {t('auth.login')}
                                </Button>
                                <Button size="sm" onClick={() => navigate({ to: '/signup' })}>
                                    {t('auth.signup')}
                                </Button>
                            </>
                        )}
                    </div>
                </nav>

                {/* Mobile Menu */}
                <div className="block lg:hidden">
                    <div className="flex items-center justify-between w-full">
                        {/* Logo */}
                        <button onClick={() => navigate({ to: '/' })} className="flex items-center gap-2" type="button">
                            <span className="text-lg font-semibold tracking-tighter">Example</span>
                        </button>
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="icon">
                                    <Menu className="size-4" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent className="overflow-y-auto">
                                <SheetHeader>
                                    <SheetTitle>
                                        <button onClick={() => navigate({ to: '/' })} className="flex items-center gap-2" type="button">
                                            <span className="text-lg font-semibold tracking-tighter">EcoHealth</span>
                                        </button>
                                    </SheetTitle>
                                </SheetHeader>
                                <div className="flex flex-col gap-6 p-4">
                                    <div className="flex flex-col gap-4">
                                        {menu.map((item) => (
                                            <button
                                                key={item.title}
                                                type="button"
                                                onClick={() => navigate({ to: item.url })}
                                                className="text-md font-semibold text-left"
                                            >
                                                {item.title}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex flex-col gap-3 mt-6">
                                        {/* Language Picker for Mobile */}
                                        <div className="mb-4">
                                            <div className="text-sm font-medium text-muted-foreground mb-2">
                                                {t('settings.language')}
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {languages.map((language) => (
                                                    <Button
                                                        key={language.code}
                                                        variant={currentLanguage === language.code ? "default" : "outline"}
                                                        size="sm"
                                                        className="justify-start"
                                                        onClick={() => changeLanguage(language.code)}
                                                    >
                                                        <span className="mr-2">{language.flag}</span>
                                                        {language.name}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>

                                        {isAuthenticated ? (
                                            <>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                                                        {getUserInitials()}
                                                    </div>
                                                    <span className="text-sm text-muted-foreground">
                                                        {user?.name || user?.email}
                                                    </span>
                                                </div>
                                                <Button variant="outline" onClick={() => navigate({ to: '/settings' })}>
                                                    <Settings className="w-4 h-4 mr-2" />
                                                    {t('nav.settings')}
                                                </Button>
                                                <Button variant="outline" onClick={handleLogout}>
                                                    <LogOut className="w-4 h-4 mr-2" />
                                                    {t('nav.logout')}
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button variant="outline" onClick={() => navigate({ to: '/login' })}>{t('auth.login')}</Button>
                                                <Button onClick={() => navigate({ to: '/signup' })}>{t('auth.signup')}</Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>
        </section>
    );
}
