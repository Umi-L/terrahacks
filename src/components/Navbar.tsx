
import { Link } from '@tanstack/react-router'
import { Button } from "@/components/ui/button"
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
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
        ...(isAuthenticated ? [{ title: "Profile", url: "/dashboard" }] : []),
    ];

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
                                <span className="text-sm text-muted-foreground">
                                    {user?.name || user?.email}
                                </span>
                                <Button variant="outline" size="sm" onClick={handleLogout}>
                                    Logout
                                </Button>
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
                                                <span className="text-sm text-muted-foreground mb-2">
                                                    {user?.name || user?.email}
                                                </span>
                                                <Button variant="outline" onClick={handleLogout}>
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
