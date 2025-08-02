
import { Button } from "@/components/ui/button"
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Menu, Settings, LogOut } from 'lucide-react'
import { usePocketBaseStore } from '@/stores/pocketbase-store'
import { authUtils } from '@/lib/auth-utils'
import { useNavigate } from '@tanstack/react-router'


export default function Navbar() {
    const pocketBaseStore = usePocketBaseStore();
    const navigate = useNavigate();
    const { isAuthenticated, user } = pocketBaseStore;

    const handleLogout = () => {
        authUtils.logout();
        pocketBaseStore.clearAuth();
    };

    // Desktop menu items
    const menu = [
        { title: "Dashboard", url: "/home" },
        { title: "About", url: "/about" },
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
                                                Settings
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="justify-start text-red-600 hover:text-red-700"
                                                onClick={handleLogout}
                                            >
                                                <LogOut className="w-4 h-4 mr-2" />
                                                Logout
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" size="sm" onClick={() => navigate({ to: '/login' })}>
                                    Login
                                </Button>
                                <Button size="sm" onClick={() => navigate({ to: '/signup' })}>
                                    Sign Up
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
                                                    Settings
                                                </Button>
                                                <Button variant="outline" onClick={handleLogout}>
                                                    <LogOut className="w-4 h-4 mr-2" />
                                                    Logout
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button variant="outline" onClick={() => navigate({ to: '/login' })}>Login</Button>
                                                <Button onClick={() => navigate({ to: '/signup' })}>Sign Up</Button>
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
